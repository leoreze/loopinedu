from pathlib import Path
import textwrap, os
base=Path('/mnt/data/premiumwork')

# schema updates
schema=base/'backend/database/schema.sql'
s=schema.read_text()
s=s.replace("""CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',""", """CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',""")
insert = textwrap.dedent("""
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color TEXT;

CREATE TABLE IF NOT EXISTS tenant_brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo_light','logo_dark','cover')),
  asset_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, asset_type)
);

CREATE TABLE IF NOT EXISTS premium_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_label TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_audit_logs_tenant ON premium_audit_logs(tenant_id, created_at DESC);
""")
s=s.replace("CREATE TABLE IF NOT EXISTS leads (", insert+"\nCREATE TABLE IF NOT EXISTS leads (")
schema.write_text(s)

# plans config
(base/'backend/src/config/plans.js').write_text(textwrap.dedent("""
export const FEATURE_LABELS = {
  dashboard_basic: 'Dashboard básico',
  dashboard_advanced: 'Dashboard avançado',
  reports_basic: 'Relatórios básicos',
  reports_premium: 'Relatórios premium e PDF institucional',
  ai_complete: 'Leitura completa com IA',
  multi_user: 'Múltiplos usuários',
  unlimited_cycles: 'Ciclos ilimitados',
  respondent_comparison: 'Comparativo entre respondentes',
  premium_workspace: 'Workspace Premium',
  branding_customization: 'Branding institucional',
  action_plan_plus: 'Plano de ação avançado',
  family_report: 'Devolutiva para família'
};

export const PLAN_DEFINITIONS = {
  trial: {
    key: 'trial', name: 'Trial', price_monthly: 0,
    description: 'Acesso inicial por 15 dias para ativação do ambiente.',
    highlight: 'Experimente o fluxo C.O.R.E. 360 com a sua escola.',
    features: { dashboard_basic:true, dashboard_advanced:false, reports_basic:true, reports_premium:false, ai_complete:false, multi_user:false, unlimited_cycles:false, respondent_comparison:false, premium_workspace:false, branding_customization:false, action_plan_plus:false, family_report:false }
  },
  essencial: {
    key: 'essencial', name: 'Essencial', price_monthly: 99,
    description: 'Operação institucional essencial com estudantes, diagnósticos e ciclos.',
    highlight: 'Ideal para começar o processo de avaliação socioemocional.',
    features: { dashboard_basic:true, dashboard_advanced:false, reports_basic:true, reports_premium:false, ai_complete:false, multi_user:true, unlimited_cycles:true, respondent_comparison:false, premium_workspace:false, branding_customization:false, action_plan_plus:false, family_report:false }
  },
  pro: {
    key: 'pro', name: 'Pro', price_monthly: 197,
    description: 'Plano para escolas que precisam de relatórios premium e análises avançadas.',
    highlight: 'Mais profundidade pedagógica e visão comparativa.',
    features: { dashboard_basic:true, dashboard_advanced:true, reports_basic:true, reports_premium:true, ai_complete:true, multi_user:true, unlimited_cycles:true, respondent_comparison:true, premium_workspace:false, branding_customization:false, action_plan_plus:true, family_report:false }
  },
  premium: {
    key: 'premium', name: 'Premium', price_monthly: 297,
    description: 'Camada institucional completa com branding, governança e relatórios de alto valor.',
    highlight: 'Plano completo para rede, coordenação e especialistas.',
    features: { dashboard_basic:true, dashboard_advanced:true, reports_basic:true, reports_premium:true, ai_complete:true, multi_user:true, unlimited_cycles:true, respondent_comparison:true, premium_workspace:true, branding_customization:true, action_plan_plus:true, family_report:true }
  }
};

export function getPlanDefinition(planKey = 'trial') { return PLAN_DEFINITIONS[planKey] || PLAN_DEFINITIONS.trial; }
export function getTenantFeatures(planKey = 'trial') { return getPlanDefinition(planKey).features; }
export function tenantHasFeature(tenant, featureKey) { return Boolean(getTenantFeatures(tenant?.plan || 'trial')[featureKey]); }
export function explainFeatures(featureMap = {}) { return Object.entries(FEATURE_LABELS).map(([key, label]) => ({ key, label, enabled: Boolean(featureMap[key]) })); }
"""))

# auth controller
ac=base/'backend/src/controllers/auth.controller.js'
a=ac.read_text()
a=a.replace("""  return {
    dashboard_basic: tenantHasFeature(tenant, 'dashboard_basic'),
    dashboard_advanced: tenantHasFeature(tenant, 'dashboard_advanced'),
    reports_basic: tenantHasFeature(tenant, 'reports_basic'),
    reports_premium: tenantHasFeature(tenant, 'reports_premium'),
    ai_complete: tenantHasFeature(tenant, 'ai_complete')
  };""", """  return {
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
  };""")
a=a.replace("current_subscription_id: tenant.current_subscription_id,\n        features: buildFeatures(tenant)", "current_subscription_id: tenant.current_subscription_id,\n        secondary_color: tenant.secondary_color,\n        accent_color: tenant.accent_color,\n        branding_json: tenant.branding_json,\n        features: buildFeatures(tenant)")
a=a.replace("t.name AS tenant_name, t.slug AS tenant_slug, t.plan, t.status, t.trial_ends_at, t.subscription_status, t.primary_color,\n      t.billing_email, t.current_subscription_id", "t.name AS tenant_name, t.slug AS tenant_slug, t.plan, t.status, t.trial_ends_at, t.subscription_status, t.primary_color,\n      t.secondary_color, t.accent_color, t.branding_json, t.billing_email, t.current_subscription_id")
a=a.replace("row.features = buildFeatures({ plan: row.plan });", "row.features = buildFeatures({ plan: row.plan });\n  row.branding = { primary_color: row.primary_color, secondary_color: row.secondary_color, accent_color: row.accent_color, branding_json: row.branding_json };")
ac.write_text(a)

# tenant controller
(base/'backend/src/controllers/tenant.controller.js').write_text(textwrap.dedent("""
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
"""))
(base/'backend/src/routes/tenant.routes.js').write_text(textwrap.dedent("""
import { Router } from 'express';
import { asyncHandler, requireFeature, requireRole } from '../middlewares/auth.middleware.js';
import { getTenantSettings, updateTenantSettings, createTenantUser, updateTenantUser } from '../controllers/tenant.controller.js';
const router = Router();
router.get('/settings', requireFeature('premium_workspace'), asyncHandler(getTenantSettings));
router.patch('/settings', requireFeature('premium_workspace'), requireRole('admin', 'coordinator'), asyncHandler(updateTenantSettings));
router.post('/users', requireFeature('premium_workspace'), requireRole('admin'), asyncHandler(createTenantUser));
router.patch('/users/:userId', requireFeature('premium_workspace'), requireRole('admin'), asyncHandler(updateTenantUser));
export default router;
"""))

# app.js backend
appf=base/'backend/src/app.js'
app=appf.read_text()
app=app.replace("import publicRoutes from './routes/public.routes.js';", "import publicRoutes from './routes/public.routes.js';\nimport tenantRoutes from './routes/tenant.routes.js';")
app=app.replace("app.use('/api/public', publicRoutes);", "app.use('/api/public', publicRoutes);\napp.use('/api/tenant', tenantRoutes);")
appf.write_text(app)

# dashboard controller append
ctl=base/'backend/src/controllers/dashboard.controller.js'
d=ctl.read_text()
d += textwrap.dedent("""

export async function getPremiumInsights(req, res) {
  const tenantId = req.user.tenantId;
  const [completion, risk, classes, divergence] = await Promise.all([
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'completed') AS completed FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id WHERE a.tenant_id = $1`, [tenantId]),
    query(`SELECT s.full_name, a.overall_score, a.overall_band FROM assessments a INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id WHERE a.tenant_id = $1 AND a.status = 'completed' ORDER BY a.overall_score ASC NULLS LAST LIMIT 5`, [tenantId]),
    query(`SELECT COALESCE(s.class_name, 'Sem turma') AS class_name, COUNT(a.id) AS total, COALESCE(ROUND(AVG(a.overall_score)::numeric, 2), 0) AS average_score FROM students s LEFT JOIN assessments a ON a.student_id = s.id AND a.tenant_id = s.tenant_id AND a.status = 'completed' WHERE s.tenant_id = $1 GROUP BY COALESCE(s.class_name, 'Sem turma') ORDER BY average_score DESC, total DESC LIMIT 5`, [tenantId]),
    query(`SELECT a.id, s.full_name, COALESCE(MAX(avg_score) - MIN(avg_score), 0) AS divergence FROM (SELECT r.assessment_id, r.respondent_type, AVG(resp.score)::numeric(5,2) AS avg_score FROM respondents r INNER JOIN responses resp ON resp.respondent_id = r.id INNER JOIN assessments a ON a.id = r.assessment_id WHERE a.tenant_id = $1 GROUP BY r.assessment_id, r.respondent_type) pivot INNER JOIN assessments a ON a.id = pivot.assessment_id INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id GROUP BY a.id, s.full_name ORDER BY divergence DESC, s.full_name ASC LIMIT 5`, [tenantId])
  ]);
  const total = Number(completion.rows[0]?.total || 0);
  const completed = Number(completion.rows[0]?.completed || 0);
  res.json({ respondent_completion_rate: total ? Number(((completed / total) * 100).toFixed(1)) : 0, priority_students: risk.rows, strongest_classes: classes.rows, divergence_alerts: divergence.rows });
}
""")
ctl.write_text(d)
r=base/'backend/src/routes/dashboard.routes.js'
text=r.read_text().replace("import { getOverview, getByClass, getByGrade, getAlerts } from '../controllers/dashboard.controller.js';", "import { getOverview, getByClass, getByGrade, getAlerts, getPremiumInsights } from '../controllers/dashboard.controller.js';")
text=text.replace("router.get('/alerts', asyncHandler(getAlerts));", "router.get('/alerts', asyncHandler(getAlerts));\nrouter.get('/premium-insights', requireFeature('premium_workspace'), asyncHandler(getPremiumInsights));")
r.write_text(text)

# assessment comparison
svc=base/'backend/src/services/assessment.service.js'
svc.write_text(svc.read_text()+textwrap.dedent("""

export async function getAssessmentComparison(assessmentId, tenantId) {
  const respondentAverages = await query(`SELECT r.respondent_type, q.dimension, ROUND(AVG(resp.score)::numeric, 2) AS average_score FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id INNER JOIN responses resp ON resp.respondent_id = r.id INNER JOIN questions q ON q.id = resp.question_id WHERE r.assessment_id = $1 AND a.tenant_id = $2 GROUP BY r.respondent_type, q.dimension ORDER BY r.respondent_type, q.dimension`, [assessmentId, tenantId]);
  const comments = await query(`SELECT r.respondent_type, q.dimension, resp.comment FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id INNER JOIN responses resp ON resp.respondent_id = r.id INNER JOIN questions q ON q.id = resp.question_id WHERE r.assessment_id = $1 AND a.tenant_id = $2 AND COALESCE(NULLIF(TRIM(resp.comment), ''), '') <> '' ORDER BY r.respondent_type, q.dimension, resp.created_at DESC`, [assessmentId, tenantId]);
  return { by_dimension: respondentAverages.rows, comments: comments.rows.slice(0, 12) };
}
"""))
acn=base/'backend/src/controllers/assessments.controller.js'
t=acn.read_text().replace("import { createAssessment, addRespondents, saveResponses, completeAssessment, getPublicRespondentByToken, savePublicResponsesByToken } from '../services/assessment.service.js';", "import { createAssessment, addRespondents, saveResponses, completeAssessment, getPublicRespondentByToken, savePublicResponsesByToken, getAssessmentComparison } from '../services/assessment.service.js';")
t += textwrap.dedent("""

export async function getAssessmentComparisonHandler(req, res) {
  const result = await getAssessmentComparison(req.params.id, req.user.tenantId);
  res.json(result);
}
""")
acn.write_text(t)
r=base/'backend/src/routes/assessments.routes.js'
text=r.read_text().replace("import { listAssessments, createAssessmentHandler, getAssessment, updateAssessment, addRespondentsHandler, saveResponsesHandler, completeAssessmentHandler, getAssessmentRespondents, getPublicRespondent, savePublicRespondentResponses } from '../controllers/assessments.controller.js';", "import { listAssessments, createAssessmentHandler, getAssessment, updateAssessment, addRespondentsHandler, saveResponsesHandler, completeAssessmentHandler, getAssessmentRespondents, getPublicRespondent, savePublicRespondentResponses, getAssessmentComparisonHandler } from '../controllers/assessments.controller.js';")
text=text.replace("router.get('/:id/respondents', asyncHandler(getAssessmentRespondents));", "router.get('/:id/respondents', asyncHandler(getAssessmentRespondents));\nrouter.get('/:id/comparison', requireFeature('respondent_comparison'), asyncHandler(getAssessmentComparisonHandler));")
r.write_text(text)

# reports controller enrich
rc=base/'backend/src/controllers/reports.controller.js'
text=rc.read_text().replace("t.name AS tenant_name,\n      t.slug AS tenant_slug", "t.name AS tenant_name,\n      t.slug AS tenant_slug,\n      t.primary_color,\n      t.secondary_color,\n      t.accent_color,\n      t.branding_json")
rc.write_text(text)

# billing controller labels
bc=base/'backend/src/controllers/billing.controller.js'
text=bc.read_text().replace("import { PLAN_DEFINITIONS, getPlanDefinition, getTenantFeatures } from '../config/plans.js';", "import { PLAN_DEFINITIONS, getPlanDefinition, getTenantFeatures, explainFeatures } from '../config/plans.js';")
text=text.replace("return { ...tenant, features: getTenantFeatures(tenant.plan) };", "return { ...tenant, features: getTenantFeatures(tenant.plan), feature_list: explainFeatures(getTenantFeatures(tenant.plan)) };")
text=text.replace("res.json(Object.values(PLAN_DEFINITIONS));", "res.json(Object.values(PLAN_DEFINITIONS).map((plan) => ({ ...plan, feature_list: explainFeatures(plan.features) })));")
bc.write_text(text)

# app.js frontend
appjs=base/'frontend/public/js/app.js'
text=appjs.read_text()
text=text.replace("const tenantPlan = user?.plan || user?.tenant?.plan || 'trial';", "const tenantPlan = user?.plan || user?.tenant?.plan || 'trial';\n  const features = user?.features || user?.tenant?.features || {};\n  const brandPrimary = user?.branding?.primary_color || user?.tenant?.primary_color || '#1f8560';\n  const brandSecondary = user?.branding?.secondary_color || user?.tenant?.secondary_color || '#1f3c88';\n  const brandAccent = user?.branding?.accent_color || user?.tenant?.accent_color || '#42c6c6';")
text=text.replace('<div class="shell-body container">', '<div class="shell-body container" style="--tenant-primary:${brandPrimary}; --tenant-secondary:${brandSecondary}; --tenant-accent:${brandAccent};">')
text=text.replace('          <a href="/billing.html"><span class="nav-icon">💳</span><span>Billing</span></a>', '          <a href="/billing.html"><span class="nav-icon">💳</span><span>Billing</span></a>\n          ${features.premium_workspace ? `<a href="/premium.html"><span class="nav-icon">👑</span><span>Plano Premium</span></a>` : ``}')
appjs.write_text(text)

# billing html
bill=base/'frontend/public/billing.html'
text=bill.read_text()
text=text.replace("${Object.entries(summary.tenant?.features || {}).map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td>${v ? 'Liberado' : 'Bloqueado'}</td></tr>`).join('')}", "${(summary.tenant?.feature_list || []).map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.enabled ? 'Liberado' : 'Bloqueado'}</td></tr>`).join('')}")
text=text.replace("${Object.entries(plan.features).map(([feature, enabled]) => `<li>${enabled ? '✔' : '—'} ${escapeHtml(feature)}</li>`).join('')}", "${(plan.feature_list || []).map((item) => `<li>${item.enabled ? '✔' : '—'} ${escapeHtml(item.label)}</li>`).join('')}")
text=text.replace('<div class="badge">${escapeHtml(plan.name)}</div>', '<div class="badge ${plan.key === \'premium\' ? \'badge-premium\' : \'\'}">${escapeHtml(plan.name)}</div><div class="muted" style="margin-top:8px;">${escapeHtml(plan.highlight || \'\')}</div>')
bill.write_text(text)
