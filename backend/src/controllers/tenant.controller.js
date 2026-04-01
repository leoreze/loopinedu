
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { rolePermissions } from '../config/permissions.js';
import { getTenantFeatures } from '../config/plans.js';

function mapUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    is_active: row.is_active,
    avatar_color: row.avatar_color,
    created_at: row.created_at
  };
}

export async function getTenantSettings(req, res) {
  const tenant = (await query(`SELECT id, name, slug, logo_url, primary_color, secondary_color, accent_color, custom_domain, branding_json, plan, status, trial_ends_at, subscription_status, billing_email FROM tenants WHERE id = $1 LIMIT 1`, [req.user.tenantId])).rows[0];
  const users = (await query(`SELECT id, full_name, email, role, phone, is_active, avatar_color, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`, [req.user.tenantId])).rows.map(mapUser);
  const audit = (await query(`SELECT action_label, payload, created_at FROM premium_audit_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 8`, [req.user.tenantId])).rows;
  res.json({ tenant, users, roles: rolePermissions, features: getTenantFeatures(tenant?.plan), audit });
}

export async function updateTenantSettings(req, res) {
  const current = (await query(`SELECT * FROM tenants WHERE id = $1 LIMIT 1`, [req.user.tenantId])).rows[0];
  const incomingBranding = req.body?.branding_json && typeof req.body.branding_json === 'object' ? req.body.branding_json : {};
  const mergedBranding = { ...(current?.branding_json || {}), ...incomingBranding };
  const updated = (await query(`
    UPDATE tenants
    SET name = COALESCE($2, name),
        logo_url = COALESCE($3, logo_url),
        primary_color = COALESCE($4, primary_color),
        secondary_color = COALESCE($5, secondary_color),
        accent_color = COALESCE($6, accent_color),
        custom_domain = COALESCE($7, custom_domain),
        branding_json = $8::jsonb,
        billing_email = COALESCE($9, billing_email)
    WHERE id = $1
    RETURNING id, name, slug, logo_url, primary_color, secondary_color, accent_color, custom_domain, branding_json, plan, status, trial_ends_at, subscription_status, billing_email
  `, [req.user.tenantId, req.body?.name || null, req.body?.logo_url || null, req.body?.primary_color || null, req.body?.secondary_color || null, req.body?.accent_color || null, req.body?.custom_domain || null, JSON.stringify(mergedBranding), req.body?.billing_email || null])).rows[0];
  await query(`INSERT INTO premium_audit_logs (tenant_id, actor_user_id, action_label, payload) VALUES ($1,$2,$3,$4::jsonb)`, [req.user.tenantId, req.user.id, 'tenant_settings_updated', JSON.stringify(req.body || {})]);
  res.json(updated);
}

export async function createTenantUser(req, res) {
  const { full_name, email, password, role = 'teacher', phone = null, avatar_color = null } = req.body || {};
  if (!full_name || !email || !password) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  if (!['admin','coordinator','teacher','specialist'].includes(role)) return res.status(400).json({ error: 'Perfil inválido.' });
  const exists = (await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email])).rows[0];
  if (exists) return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
  const passwordHash = await bcrypt.hash(password, 10);
  const inserted = (await query(`INSERT INTO users (full_name, email, password_hash, role, school_name, is_active, tenant_id, phone, avatar_color) VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,$8) RETURNING id, full_name, email, role, phone, is_active, avatar_color, created_at`, [full_name, email, passwordHash, role, req.tenant?.name || null, req.user.tenantId, phone, avatar_color])).rows[0];
  await query(`INSERT INTO premium_audit_logs (tenant_id, actor_user_id, action_label, payload) VALUES ($1,$2,$3,$4::jsonb)`, [req.user.tenantId, req.user.id, 'user_created', JSON.stringify({ email, role })]);
  res.status(201).json(inserted);
}

export async function updateTenantUser(req, res) {
  const { full_name, role, phone, is_active, avatar_color } = req.body || {};
  const updated = (await query(`UPDATE users SET full_name = COALESCE($3, full_name), role = COALESCE($4, role), phone = COALESCE($5, phone), is_active = COALESCE($6, is_active), avatar_color = COALESCE($7, avatar_color) WHERE id = $1 AND tenant_id = $2 RETURNING id, full_name, email, role, phone, is_active, avatar_color, created_at`, [req.params.userId, req.user.tenantId, full_name, role, phone, is_active, avatar_color])).rows[0];
  if (!updated) return res.status(404).json({ error: 'Usuário não encontrado.' });
  await query(`INSERT INTO premium_audit_logs (tenant_id, actor_user_id, action_label, payload) VALUES ($1,$2,$3,$4::jsonb)`, [req.user.tenantId, req.user.id, 'user_updated', JSON.stringify({ userId: req.params.userId, role, is_active })]);
  res.json(updated);
}
