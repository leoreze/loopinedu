import { query, getClient } from '../db/index.js';
import { env } from '../config/env.js';
import { PLAN_DEFINITIONS, getPlanDefinition, getTenantFeatures, explainFeatures } from '../config/plans.js';
import { createCheckoutPreference, getPayment, mercadoPagoConfigured, parseWebhookPaymentId, validateWebhookSignature } from '../services/mercadopago.service.js';

function serializeTenant(tenant) {
  if (!tenant) return null;
  return {
    ...tenant,
    features: getTenantFeatures(tenant.plan),
    feature_list: explainFeatures(getTenantFeatures(tenant.plan)),
    payment_provider: mercadoPagoConfigured() ? 'mercadopago' : 'internal',
    mercado_pago_public_key: env.mercadoPagoPublicKey || null
  };
}

function mapPaymentStatus(status) {
  if (status === 'approved') return 'paid';
  if (['rejected', 'cancelled', 'cancelled_by_user'].includes(status)) return 'failed';
  if (status === 'refunded' || status === 'charged_back') return 'refunded';
  return 'pending';
}

async function activateSubscription(client, subscription, payment = null) {
  const updatedSubscription = (await client.query(
    `UPDATE subscriptions
     SET status = 'active',
         starts_at = COALESCE(starts_at, NOW()),
         ends_at = NOW() + INTERVAL '30 days',
         paid_at = NOW(),
         updated_at = NOW(),
         provider = COALESCE($2, provider)
     WHERE id = $1
     RETURNING *`,
    [subscription.id, payment?.payment_method_id ? 'mercadopago' : null]
  )).rows[0];

  await client.query(
    `UPDATE subscriptions SET status = 'expired', updated_at = NOW()
     WHERE tenant_id = $1 AND id <> $2 AND status = 'active'`,
    [subscription.tenant_id, subscription.id]
  );

  await client.query(
    `UPDATE tenants
     SET plan = $2, status = 'active', subscription_status = 'active', trial_ends_at = NULL, current_subscription_id = $3
     WHERE id = $1`,
    [subscription.tenant_id, updatedSubscription.plan_key, updatedSubscription.id]
  );

  if (payment) {
    await client.query(
      `UPDATE payment_transactions
       SET status = 'paid', provider = 'mercadopago', provider_reference = $2, payload = $3::jsonb, updated_at = NOW()
       WHERE subscription_id = $1`,
      [subscription.id, String(payment.id), JSON.stringify(payment)]
    );
  } else {
    await client.query(
      `UPDATE payment_transactions SET status = 'paid', updated_at = NOW() WHERE subscription_id = $1`,
      [subscription.id]
    );
  }

  return updatedSubscription;
}

async function syncSubscriptionFromMercadoPago({ paymentId, externalReference, client = null }) {
  const executor = client || await getClient();
  const ownsClient = !client;
  try {
    if (ownsClient) await executor.query('BEGIN');
    const payment = await getPayment(paymentId);
    const subscription = (await executor.query(
      `SELECT * FROM subscriptions WHERE external_reference = $1 LIMIT 1`,
      [externalReference || payment.external_reference]
    )).rows[0];
    if (!subscription) {
      if (ownsClient) await executor.query('ROLLBACK');
      return { found: false, payment };
    }

    await executor.query(
      `UPDATE payment_transactions
       SET provider = 'mercadopago', provider_reference = $2, status = $3, payload = $4::jsonb, updated_at = NOW()
       WHERE subscription_id = $1`,
      [subscription.id, String(payment.id), mapPaymentStatus(payment.status), JSON.stringify(payment)]
    );

    let updatedSubscription = subscription;
    if (payment.status === 'approved') {
      updatedSubscription = await activateSubscription(executor, subscription, payment);
    } else if (['rejected', 'cancelled', 'cancelled_by_user'].includes(payment.status)) {
      updatedSubscription = (await executor.query(
        `UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [subscription.id]
      )).rows[0];
      await executor.query(
        `UPDATE tenants SET subscription_status = 'pending' WHERE id = $1`,
        [subscription.tenant_id]
      );
    }

    if (ownsClient) await executor.query('COMMIT');
    return { found: true, subscription: updatedSubscription, payment };
  } catch (error) {
    if (ownsClient) await executor.query('ROLLBACK');
    throw error;
  } finally {
    if (ownsClient) executor.release();
  }
}

export async function getPlans(req, res) {
  res.json(Object.values(PLAN_DEFINITIONS).map((plan) => ({ ...plan, feature_list: explainFeatures(plan.features) })));
}

export async function getSummary(req, res) {
  const tenantId = req.user.tenantId;
  const subscriptions = await query(
    `SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [tenantId]
  );
  const transactions = await query(
    `SELECT * FROM payment_transactions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [tenantId]
  );
  const tenant = (await query(
    `SELECT id, name, slug, plan, status, trial_ends_at, subscription_status, billing_email, current_subscription_id
     FROM tenants WHERE id = $1`,
    [tenantId]
  )).rows[0];

  res.json({
    tenant: serializeTenant(tenant),
    active_subscription: subscriptions.rows.find((item) => item.status === 'active') || null,
    pending_subscription: subscriptions.rows.find((item) => item.status === 'pending') || null,
    subscriptions: subscriptions.rows,
    transactions: transactions.rows,
    plans: Object.values(PLAN_DEFINITIONS),
    payment_provider: mercadoPagoConfigured() ? 'mercadopago' : 'internal'
  });
}



export async function getLiveStatus(req, res) {
  const tenantId = req.user.tenantId;
  const tenant = (await query(
    `SELECT id, name, slug, plan, status, trial_ends_at, subscription_status, billing_email, current_subscription_id
     FROM tenants WHERE id = $1`,
    [tenantId]
  )).rows[0];

  const latestSubscription = (await query(
    `SELECT * FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  )).rows[0] || null;

  const latestTransaction = (await query(
    `SELECT * FROM payment_transactions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  )).rows[0] || null;

  const activeSubscription = latestSubscription?.status === 'active' ? latestSubscription : null;
  const pendingSubscription = latestSubscription?.status === 'pending' ? latestSubscription : null;
  const paymentStatus = latestTransaction?.status || pendingSubscription?.status || tenant?.subscription_status || 'trial';
  const isRealtimePending = ['pending', 'in_process', 'waiting_payment'].includes(paymentStatus);
  const stage = activeSubscription
    ? 'approved'
    : (pendingSubscription ? 'awaiting_payment' : (tenant?.plan === 'trial' ? 'trial' : 'idle'));

  res.json({
    tenant: serializeTenant(tenant),
    stage,
    payment_status: paymentStatus,
    waiting_confirmation: isRealtimePending,
    active_subscription: activeSubscription,
    pending_subscription: pendingSubscription,
    latest_transaction: latestTransaction,
    message: activeSubscription
      ? 'Plano ativo e ambiente liberado.'
      : pendingSubscription
        ? 'Checkout gerado. Aguardando confirmação do pagamento.'
        : tenant?.plan === 'trial'
          ? 'Seu ambiente está em trial. Escolha um plano para garantir continuidade.'
          : 'Nenhuma cobrança pendente no momento.'
  });
}

export async function subscribe(req, res) {
  const tenantId = req.user.tenantId;
  const { plan_key, billing_email } = req.body;
  const plan = getPlanDefinition(plan_key);
  if (!plan || plan.key === 'trial') {
    return res.status(400).json({ error: 'Escolha um plano pago válido.' });
  }

  const tenant = (await query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [tenantId])).rows[0];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE tenant_id = $1 AND status = 'pending'`, [tenantId]);
    const externalReference = `LOOPINEDU-${tenantId}-${Date.now()}`;
    const provider = mercadoPagoConfigured() ? 'mercadopago' : 'internal';
    const subscription = (await client.query(
      `INSERT INTO subscriptions (tenant_id, plan_key, status, provider, amount_cents, external_reference, checkout_url, qr_code_text)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, plan.key, provider, plan.price_monthly * 100, externalReference, null, null]
    )).rows[0];

    let checkoutData = null;
    if (mercadoPagoConfigured()) {
      checkoutData = await createCheckoutPreference({
        subscription,
        tenant,
        plan,
        payerEmail: billing_email || req.tenant?.billing_email || req.user?.email || null,
        appUrl: env.appUrl
      });
      await client.query(
        `UPDATE subscriptions SET checkout_url = $2, qr_code_text = $3 WHERE id = $1`,
        [subscription.id, checkoutData.init_point || checkoutData.sandbox_init_point || null, checkoutData.id || null]
      );
    } else {
      checkoutData = {
        mode: 'internal',
        checkout_url: `/billing.html?checkout=${externalReference}`,
        pix_code: `PIX|${externalReference}|${plan.price_monthly * 100}`
      };
      await client.query(
        `UPDATE subscriptions SET checkout_url = $2, qr_code_text = $3 WHERE id = $1`,
        [subscription.id, checkoutData.checkout_url, checkoutData.pix_code]
      );
    }

    const transaction = (await client.query(
      `INSERT INTO payment_transactions (subscription_id, tenant_id, provider, amount_cents, status, provider_reference, payload)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6::jsonb) RETURNING *`,
      [subscription.id, tenantId, provider, plan.price_monthly * 100, checkoutData?.id || externalReference, JSON.stringify({ plan_key: plan.key, billing_email: billing_email || req.tenant?.billing_email || null, mercado_pago_preference: checkoutData || null })]
    )).rows[0];
    await client.query(`UPDATE tenants SET billing_email = COALESCE($2, billing_email), subscription_status = 'pending' WHERE id = $1`, [tenantId, billing_email || null]);
    await client.query('COMMIT');
    const freshSubscription = (await query(`SELECT * FROM subscriptions WHERE id = $1`, [subscription.id])).rows[0];
    res.status(201).json({
      subscription: freshSubscription,
      transaction,
      plan,
      payment_provider: provider,
      checkout: checkoutData ? {
        url: freshSubscription.checkout_url,
        preference_id: checkoutData.id || freshSubscription.qr_code_text || null,
        init_point: checkoutData.init_point || checkoutData.sandbox_init_point || freshSubscription.checkout_url || null,
        methods: ['pix', 'credit_card', 'debit_card']
      } : null
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmPayment(req, res) {
  const tenantId = req.user.tenantId;
  const { subscription_id, payment_id, external_reference } = req.body;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const subscription = (await client.query(
      `SELECT * FROM subscriptions WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [subscription_id, tenantId]
    )).rows[0];
    if (!subscription) return res.status(404).json({ error: 'Assinatura não encontrada.' });

    if (subscription.provider === 'mercadopago') {
      if (!payment_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'payment_id é obrigatório para confirmar pagamentos do Mercado Pago.' });
      }
      const syncResult = await syncSubscriptionFromMercadoPago({ paymentId: payment_id, externalReference: external_reference || subscription.external_reference, client });
      if (!syncResult.found) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Pagamento não vinculado à assinatura.' });
      }
      await client.query('COMMIT');
      return res.json({ success: syncResult.payment.status === 'approved', payment_status: syncResult.payment.status, subscription: syncResult.subscription, tenant_plan: syncResult.subscription.plan_key });
    }

    const updatedSubscription = await activateSubscription(client, subscription);
    await client.query('COMMIT');
    res.json({ success: true, subscription: updatedSubscription, tenant_plan: updatedSubscription.plan_key });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function syncPayment(req, res) {
  const tenantId = req.user.tenantId;
  const { payment_id, external_reference, subscription_id } = req.body || {};
  if (!payment_id) return res.status(400).json({ error: 'payment_id é obrigatório.' });

  const subscription = subscription_id ? (await query(`SELECT * FROM subscriptions WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [subscription_id, tenantId])).rows[0] : null;
  if (subscription_id && !subscription) return res.status(404).json({ error: 'Assinatura não encontrada.' });

  const result = await syncSubscriptionFromMercadoPago({ paymentId: payment_id, externalReference: external_reference || subscription?.external_reference });
  if (!result.found) return res.status(404).json({ error: 'Pagamento não localizado para esta assinatura.' });
  res.json({ success: result.payment.status === 'approved', payment_status: result.payment.status, subscription: result.subscription, payment: result.payment });
}

export async function cancelSubscription(req, res) {
  const tenantId = req.user.tenantId;
  const active = (await query(`SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`, [tenantId])).rows[0];
  if (!active) return res.status(404).json({ error: 'Nenhuma assinatura ativa encontrada.' });
  await query(`UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE id = $1`, [active.id]);
  await query(`UPDATE tenants SET subscription_status = 'canceled', status = 'blocked' WHERE id = $1`, [tenantId]);
  res.json({ success: true });
}

export async function providerWebhook(req, res) {
  if (!validateWebhookSignature(req)) {
    return res.status(401).json({ error: 'Webhook do Mercado Pago não autenticado.' });
  }

  const topic = String(req.query.topic || req.body?.type || req.body?.topic || '').toLowerCase();
  const paymentId = parseWebhookPaymentId(req);

  if (paymentId && (!topic || topic.includes('payment'))) {
    const result = await syncSubscriptionFromMercadoPago({ paymentId });
    return res.json({ ok: true, synced: result.found, payment_status: result.payment?.status || null });
  }

  return res.json({ ok: true, ignored: true });
}
