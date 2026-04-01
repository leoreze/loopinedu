import crypto from "crypto";
import { env } from "../config/env.js";

const API_BASE = "https://api.mercadopago.com";

export function mercadoPagoConfigured() {
  return Boolean(env.mercadoPagoAccessToken);
}

function buildHeaders(extra = {}) {
  const headers = {
    Authorization: `Bearer ${env.mercadoPagoAccessToken}`,
    "Content-Type": "application/json",
    ...extra
  };
  if (env.mercadoPagoIntegratorId) {
    headers["x-integrator-id"] = env.mercadoPagoIntegratorId;
  }
  return headers;
}

async function mpRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: buildHeaders(options.headers || {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.cause?.[0]?.description || payload?.error || "Falha ao comunicar com o Mercado Pago.";
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function createCheckoutPreference({ subscription, tenant, plan, payerEmail, appUrl }) {
  if (!mercadoPagoConfigured()) return null;

  const successUrl = `${appUrl.replace(/\/$/, "")}/billing.html?subscription_id=${subscription.id}`;
  const notificationUrl = `${appUrl.replace(/\/$/, "")}/api/billing/webhook`;
  const body = {
    items: [{
      id: `plan-${plan.key}`,
      title: `LoopinEdu ${plan.name} — assinatura mensal`,
      description: plan.description,
      quantity: 1,
      currency_id: "BRL",
      unit_price: Number(plan.price_monthly)
    }],
    payer: payerEmail ? { email: payerEmail } : undefined,
    external_reference: subscription.external_reference,
    notification_url: notificationUrl,
    back_urls: {
      success: successUrl,
      pending: successUrl,
      failure: successUrl
    },
    auto_return: "approved",
    statement_descriptor: String(env.mercadoPagoStatementDescriptor || "LOOPINEDU").slice(0, 13),
    payment_methods: {
      excluded_payment_types: [],
      installments: 12,
      default_installments: 1
    },
    metadata: {
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      subscription_id: subscription.id,
      plan_key: plan.key
    }
  };

  return mpRequest('/checkout/preferences', { method: 'POST', body });
}

export async function getPayment(paymentId) {
  if (!mercadoPagoConfigured()) throw new Error('Mercado Pago não configurado.');
  return mpRequest(`/v1/payments/${paymentId}`);
}

export function parseWebhookPaymentId(req) {
  return String(req.query['data.id'] || req.body?.data?.id || req.body?.id || '').trim();
}

export function validateWebhookSignature(req) {
  if (!env.mercadoPagoWebhookSecret) return true;
  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'] || '';
  const dataId = parseWebhookPaymentId(req);
  if (!signatureHeader || !dataId) return false;

  const parts = Object.fromEntries(
    String(signatureHeader).split(',').map((item) => item.trim()).filter(Boolean).map((pair) => pair.split('=').map((value) => value.trim()))
  );
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const computed = crypto.createHmac('sha256', env.mercadoPagoWebhookSecret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(parts.v1));
}
