
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
