import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { env } from '../config/env.js';
import { tenantHasFeature } from '../config/plans.js';

function tenantAccessState(tenant) {
  if (!tenant) return { allowed: false, reason: 'TENANT_NOT_FOUND' };
  if (tenant.status === 'blocked') return { allowed: false, reason: 'TENANT_BLOCKED' };
  if ((tenant.subscription_status === 'overdue' || tenant.subscription_status === 'canceled') && tenant.plan !== 'premium') {
    return { allowed: false, reason: 'TENANT_BILLING_BLOCKED' };
  }
  if (tenant.plan === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
    return { allowed: false, reason: 'TENANT_TRIAL_EXPIRED' };
  }
  return { allowed: true, reason: null };
}

function buildFeatures(tenant) {
  return {
    dashboard_basic: tenantHasFeature(tenant, 'dashboard_basic'),
    dashboard_advanced: tenantHasFeature(tenant, 'dashboard_advanced'),
    reports_basic: tenantHasFeature(tenant, 'reports_basic'),
    reports_premium: tenantHasFeature(tenant, 'reports_premium'),
    ai_complete: tenantHasFeature(tenant, 'ai_complete'),
    respondent_comparison: tenantHasFeature(tenant, 'respondent_comparison'),
    premium_workspace: tenantHasFeature(tenant, 'premium_workspace'),
    branding_customization: tenantHasFeature(tenant, 'branding_customization'),
    action_plan_plus: tenantHasFeature(tenant, 'action_plan_plus'),
    family_report: tenantHasFeature(tenant, 'family_report')
  };
}

function signUser(user, tenant) {
  const token = jwt.sign({
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    tenantId: user.tenant_id,
    tenantSlug: tenant?.slug || null,
    isPlatformAdmin: Boolean(user.is_platform_admin)
  }, env.jwtSecret, { expiresIn: '8h' });

  const access = tenantAccessState(tenant);

  return {
    token,
    restricted: !access.allowed,
    restricted_reason: access.reason,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
        subscription_status: tenant.subscription_status,
        primary_color: tenant.primary_color,
        billing_email: tenant.billing_email,
        current_subscription_id: tenant.current_subscription_id,
        secondary_color: tenant.secondary_color,
        accent_color: tenant.accent_color,
        branding_json: tenant.branding_json,
        features: buildFeatures(tenant)
      } : null,
      is_platform_admin: Boolean(user.is_platform_admin)
    }
  };
}

export async function login(req, res) {
  const { email, password } = req.body;
  const result = await query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1', [email]);
  const user = result.rows[0];

  if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

  const tenantResult = await query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [user.tenant_id]);
  const tenant = tenantResult.rows[0];
  return res.json(signUser(user, tenant));
}

export async function me(req, res) {
  const result = await query(`
    SELECT u.id, u.full_name, u.email, u.role, u.school_name, u.is_active, u.tenant_id, u.is_platform_admin,
      t.name AS tenant_name, t.slug AS tenant_slug, t.plan, t.status, t.trial_ends_at, t.subscription_status, t.primary_color,
      t.secondary_color, t.accent_color, t.branding_json, t.billing_email, t.current_subscription_id
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.id = $1
  `, [req.user.id]);
  const row = result.rows[0] || null;
  if (!row) return res.json(null);
  row.features = buildFeatures({ plan: row.plan });
  row.branding = { primary_color: row.primary_color, secondary_color: row.secondary_color, accent_color: row.accent_color, branding_json: row.branding_json };
  row.restricted = !tenantAccessState({
    plan: row.plan,
    status: row.status,
    trial_ends_at: row.trial_ends_at,
    subscription_status: row.subscription_status
  }).allowed;
  return res.json(row);
}

export async function seedDefaultAdmin() {
  let tenant = (await query('SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [env.defaultTenantSlug])).rows[0];
  if (!tenant) {
    tenant = (await query(
      `INSERT INTO tenants (name, slug, plan, status, trial_ends_at, subscription_status)
       VALUES ($1, $2, 'premium', 'active', NOW() + INTERVAL '3650 days', 'active') RETURNING *`,
      [env.defaultTenantName, env.defaultTenantSlug]
    )).rows[0];
  }

  const existing = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [env.defaultAdminEmail]);
  if (!existing.rows[0]) {
    const passwordHash = await bcrypt.hash(env.defaultAdminPassword, 10);
    await query(
      `INSERT INTO users (full_name, email, password_hash, role, school_name, is_active, tenant_id, is_platform_admin)
       VALUES ($1, $2, $3, 'admin', $4, TRUE, $5, TRUE)`,
      [env.defaultAdminName, env.defaultAdminEmail, passwordHash, env.defaultTenantName, tenant.id]
    );
  }

  await query(
    `UPDATE users
     SET tenant_id = COALESCE(tenant_id, $2), is_platform_admin = TRUE, is_active = TRUE
     WHERE email = $1`,
    [env.defaultAdminEmail, tenant.id]
  );

  const activeSub = await query('SELECT id FROM subscriptions WHERE tenant_id = $1 AND status = $2 LIMIT 1', [tenant.id, 'active']);
  if (!activeSub.rows[0]) {
    const sub = (await query(
      `INSERT INTO subscriptions (tenant_id, plan_key, status, provider, amount_cents, starts_at, ends_at, paid_at)
       VALUES ($1, 'premium', 'active', 'internal', 0, NOW(), NOW() + INTERVAL '3650 days', NOW()) RETURNING id`,
      [tenant.id]
    )).rows[0];
    await query(`UPDATE tenants SET current_subscription_id = $2, billing_email = COALESCE(billing_email, $3) WHERE id = $1`, [tenant.id, sub.id, env.defaultAdminEmail]);
  }
}

export async function logout(req, res) {
  return res.json({ success: true });
}
