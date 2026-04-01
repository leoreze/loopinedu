
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { PLAN_DEFINITIONS } from '../config/plans.js';

function mapTenant(row = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    trial_ends_at: row.trial_ends_at,
    subscription_status: row.subscription_status,
    billing_email: row.billing_email,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    accent_color: row.accent_color,
    total_students: Number(row.total_students || 0),
    total_assessments: Number(row.total_assessments || 0),
    total_users: Number(row.total_users || 0),
    last_activity_at: row.last_activity_at
  };
}

export async function getMasterOverview(req, res) {
  const tenants = await query(`
    SELECT t.id, t.name, t.slug, t.plan, t.status, t.trial_ends_at, t.subscription_status,
      COUNT(DISTINCT s.id) AS total_students,
      COUNT(DISTINCT a.id) AS total_assessments,
      COUNT(DISTINCT u.id) AS total_users,
      MAX(GREATEST(COALESCE(a.updated_at, t.created_at), COALESCE(u.created_at, t.created_at))) AS last_activity_at
    FROM tenants t
    LEFT JOIN students s ON s.tenant_id = t.id
    LEFT JOIN assessments a ON a.tenant_id = t.id
    LEFT JOIN users u ON u.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);

  const subscriptions = await query(`
    SELECT plan_key, status, COUNT(*)::int AS total
    FROM subscriptions
    GROUP BY plan_key, status
    ORDER BY plan_key, status
  `);

  const leads = await query(`SELECT COUNT(*)::int AS total FROM leads`);

  res.json({
    summary: {
      total_tenants: tenants.rows.length,
      active_tenants: tenants.rows.filter((t) => t.status === 'active').length,
      blocked_tenants: tenants.rows.filter((t) => t.status === 'blocked').length,
      premium_tenants: tenants.rows.filter((t) => t.plan === 'premium').length,
      total_leads: Number(leads.rows[0]?.total || 0)
    },
    tenants: tenants.rows.map(mapTenant),
    subscriptions: subscriptions.rows,
    plans: Object.values(PLAN_DEFINITIONS).map((plan) => ({ key: plan.key, name: plan.name, price_monthly: plan.price_monthly }))
  });
}

export async function listTenants(req, res) {
  const result = await query(`
    SELECT t.id, t.name, t.slug, t.plan, t.status, t.trial_ends_at, t.subscription_status, t.billing_email,
      t.primary_color, t.secondary_color, t.accent_color,
      COUNT(DISTINCT s.id) AS total_students,
      COUNT(DISTINCT a.id) AS total_assessments,
      COUNT(DISTINCT u.id) AS total_users,
      MAX(COALESCE(a.updated_at, t.created_at)) AS last_activity_at
    FROM tenants t
    LEFT JOIN students s ON s.tenant_id = t.id
    LEFT JOIN assessments a ON a.tenant_id = t.id
    LEFT JOIN users u ON u.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  res.json(result.rows.map(mapTenant));
}

export async function getTenantDetail(req, res) {
  const tenantId = req.params.id;
  const tenant = (await query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [tenantId])).rows[0];
  if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado.' });
  const users = (await query(`SELECT id, full_name, email, role, is_active, is_platform_admin, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`, [tenantId])).rows;
  const subscriptions = (await query(`SELECT id, plan_key, status, amount_cents, created_at, paid_at, starts_at, ends_at FROM subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId])).rows;
  const usage = (await query(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE tenant_id = $1) AS total_students,
      (SELECT COUNT(*) FROM assessments WHERE tenant_id = $1) AS total_assessments,
      (SELECT COUNT(*) FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id WHERE a.tenant_id = $1) AS total_respondents,
      (SELECT COUNT(*) FROM leads WHERE source = $2) AS matching_leads
  `, [tenantId, tenant.slug])).rows[0];
  res.json({ tenant, users, subscriptions, usage });
}

export async function updateTenantAdmin(req, res) {
  const tenantId = req.params.id;
  const updates = req.body || {};
  const current = (await query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [tenantId])).rows[0];
  if (!current) return res.status(404).json({ error: 'Tenant não encontrado.' });
  const updated = (await query(`
    UPDATE tenants
    SET name = COALESCE($2, name),
        slug = COALESCE($3, slug),
        plan = COALESCE($4, plan),
        status = COALESCE($5, status),
        billing_email = COALESCE($6, billing_email),
        trial_ends_at = COALESCE($7, trial_ends_at),
        subscription_status = COALESCE($8, subscription_status),
        primary_color = COALESCE($9, primary_color),
        secondary_color = COALESCE($10, secondary_color),
        accent_color = COALESCE($11, accent_color)
    WHERE id = $1
    RETURNING *
  `, [tenantId, updates.name || null, updates.slug || null, updates.plan || null, updates.status || null, updates.billing_email || null, updates.trial_ends_at || null, updates.subscription_status || null, updates.primary_color || null, updates.secondary_color || null, updates.accent_color || null])).rows[0];

  if (updates.plan && ['trial','essencial','pro','premium'].includes(updates.plan)) {
    await query(`UPDATE subscriptions SET status = CASE WHEN id = (SELECT current_subscription_id FROM tenants WHERE id = $1) THEN 'active' ELSE status END WHERE tenant_id = $1`, [tenantId]);
  }

  res.json(updated);
}

export async function setTenantBlocked(req, res) {
  const tenantId = req.params.id;
  const blocked = Boolean(req.body?.blocked);
  const result = await query(`UPDATE tenants SET status = $2 WHERE id = $1 RETURNING id, name, status`, [tenantId, blocked ? 'blocked' : 'active']);
  if (!result.rows[0]) return res.status(404).json({ error: 'Tenant não encontrado.' });
  res.json(result.rows[0]);
}

export async function resetTenantTrial(req, res) {
  const tenantId = req.params.id;
  const days = Number(req.body?.days || 15);
  const result = await query(`UPDATE tenants SET trial_ends_at = NOW() + ($2 || ' days')::interval, status = 'active', plan = 'trial', subscription_status = 'trial' WHERE id = $1 RETURNING id, name, trial_ends_at, plan, status, subscription_status`, [tenantId, days]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Tenant não encontrado.' });
  res.json(result.rows[0]);
}

export async function createPlatformAdmin(req, res) {
  const { full_name, email, password, tenant_id } = req.body || {};
  if (!full_name || !email || !password || !tenant_id) return res.status(400).json({ error: 'Nome, e-mail, senha e tenant são obrigatórios.' });
  const existing = (await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email])).rows[0];
  if (existing) return res.status(409).json({ error: 'Já existe usuário com este e-mail.' });
  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = (await query(`INSERT INTO users (full_name, email, password_hash, role, school_name, is_active, tenant_id, is_platform_admin) VALUES ($1,$2,$3,'admin',NULL,TRUE,$4,TRUE) RETURNING id, full_name, email, role, tenant_id, is_platform_admin`, [full_name, email, passwordHash, tenant_id])).rows[0];
  res.status(201).json(inserted);
}
