const apiBase = '/api';
const TOKEN_KEY = 'loopinedu_token';
const USER_KEY = 'loopinedu_user';
const BRAND_LOGO = '/assets/brand/logo-loopinedu-brand-dark.png';
const BRAND_ICON = '/assets/brand/logo-loopinedu-icon.png';

function getTenantBranding(user = null) {
  const tenant = user?.tenant || {};
  const brandingJson = tenant.branding_json || user?.branding?.branding_json || {};
  const primary = user?.branding?.primary_color || tenant.primary_color || '#2A877F';
  const secondary = user?.branding?.secondary_color || tenant.secondary_color || '#233347';
  const accent = user?.branding?.accent_color || tenant.accent_color || '#8CBC5E';
  const logoUrl = tenant.logo_url || user?.branding?.logo_url || brandingJson.logo_url || BRAND_LOGO;
  return {
    tenantName: user?.tenant_name || tenant.name || 'Ambiente institucional',
    primary,
    secondary,
    accent,
    logoUrl,
    website: brandingJson.website || '',
    note: brandingJson.note || ''
  };
}

function applyTenantBranding(user = null) {
  const brand = getTenantBranding(user);
  const root = document.documentElement;
  root.style.setProperty('--brand', brand.primary);
  root.style.setProperty('--brand-2', brand.accent);
  root.style.setProperty('--brand-dark', brand.secondary);
  root.style.setProperty('--brand-soft', `color-mix(in srgb, ${brand.primary} 12%, white)`);
  root.style.setProperty('--tenant-primary', brand.primary);
  root.style.setProperty('--tenant-secondary', brand.secondary);
  root.style.setProperty('--tenant-accent', brand.accent);
  return brand;
}

const CORE_METHOD_ITEMS = [
  { key: 'cognitive', shortLabel: 'C', icon: '🧠', title: 'Clareza Cognitiva', description: 'Mostra como o estudante compreende, interpreta e organiza o pensamento para aprender e resolver situações.' },
  { key: 'organization', shortLabel: 'O', icon: '🗂️', title: 'Organização', description: 'Indica rotina, consistência, planejamento e capacidade de transformar intenção em execução no dia a dia escolar.' },
  { key: 'relational', shortLabel: 'R', icon: '🤝', title: 'Relacional', description: 'Aponta como o estudante constrói vínculos, coopera, se comunica e se posiciona nos contextos sociais.' },
  { key: 'emotional', shortLabel: 'E', icon: '💚', title: 'Emocional', description: 'Reflete autorregulação, segurança emocional, tolerância a frustração e forma de lidar com pressão e mudanças.' }
];

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function getJson(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${apiBase}${url}`, {
    headers,
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) clearSession();
    const err = new Error(error.error || 'Falha na requisição.');
    err.code = error.code || null;
    err.payload = error;
    throw err;
  }

  return response.json();
}

export async function requireAuth({ redirectTo = '/login.html' } = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = redirectTo;
    throw new Error('Sessão não encontrada.');
  }

  try {
    const me = await getJson('/auth/me');
    localStorage.setItem(USER_KEY, JSON.stringify(me));
    if (me?.restricted && window.location.pathname !== '/billing.html') {
      window.location.href = '/billing.html';
      throw new Error('Seu ambiente está em modo restrito.');
    }
    return me;
  } catch (error) {
    if (!['TENANT_TRIAL_EXPIRED', 'TENANT_BILLING_BLOCKED', 'TENANT_BLOCKED'].includes(error.code)) {
      clearSession();
      window.location.href = redirectTo;
    }
    throw error;
  }
}

export async function login(email, password) {
  const payload = await getJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setSession(payload.token, payload.user);
  return payload;
}

export async function signup(data) {
  const payload = await getJson('/onboarding/signup', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  setSession(payload.token, payload.user);
  return payload;
}

export async function logout() {
  try {
    await getJson('/auth/logout', { method: 'POST' });
  } catch {
  }
  clearSession();
  window.location.href = '/login.html';
}

function trialText(user) {
  const date = user?.trial_ends_at || user?.tenant?.trial_ends_at;
  if (!date) return 'Plano ativo';
  return `Trial até ${new Date(date).toLocaleDateString('pt-BR')}`;
}

export function getInitials(value = '') {
  const cleaned = String(value).trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'LE';
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export function maskPhone(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function attachPhoneMask(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    input.value = maskPhone(input.value);
  });
}

export function setFieldInvalid(input, message = 'Preencha este campo.') {
  if (!input) return;
  input.classList.add('is-invalid');
  input.setCustomValidity(message);
}

export function clearFieldInvalid(input) {
  if (!input) return;
  input.classList.remove('is-invalid');
  input.setCustomValidity('');
}

export function validateRequiredFields(container) {
  const fields = [...container.querySelectorAll('[required]')];
  let firstInvalid = null;
  fields.forEach((field) => {
    const value = typeof field.value === 'string' ? field.value.trim() : field.value;
    if (!value) {
      setFieldInvalid(field);
      firstInvalid ||= field;
    } else {
      clearFieldInvalid(field);
    }
  });
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

export function buildStudentAvatar(student = {}, { className = '' } = {}) {
  const name = student?.full_name || 'Estudante';
  if (student?.photo_data_url) {
    return `<span class="student-avatar ${className}"><img src="${escapeHtml(student.photo_data_url)}" alt="${escapeHtml(name)}" /></span>`;
  }
  return `<span class="student-avatar initials ${className}">${escapeHtml(getInitials(name))}</span>`;
}

export function installShell({ title = 'LoopinEdu', userName = '', user = null } = {}) {
  const shell = document.getElementById('appShell');
  if (!shell) return;
  const brand = applyTenantBranding(user);
  const tenantName = brand.tenantName;
  const tenantPlan = user?.plan || user?.tenant?.plan || 'trial';
  const features = user?.features || user?.tenant?.features || {};
  const brandPrimary = brand.primary;
  const brandSecondary = brand.secondary;
  const brandAccent = brand.accent;
  const brandLogo = brand.logoUrl || BRAND_LOGO;
  const currentYear = new Date().getFullYear();

  shell.innerHTML = `
    <header class="topbar">
      <div class="container topbar-inner shell-topbar-inner">
        <div class="shell-nav-start">
          <button id="mobileNavToggle" type="button" class="mobile-nav-toggle" aria-label="Abrir menu" aria-expanded="false">☰</button>
          <div class="shell-title-wrap shell-title-row">
            <img class="brand-logo header-brand-logo tenant-brand-logo" src="${escapeHtml(brandLogo)}" alt="${escapeHtml(tenantName)}" />
            <div>
              <div class="muted shell-kicker">${escapeHtml(tenantName)}</div>
              <strong>${escapeHtml(title)}</strong>
            </div>
          </div>
        </div>
        <div class="shell-user">
          <div class="shell-plan-badge"><span>★</span>${escapeHtml(String(tenantPlan).toUpperCase())}</div>
          <div class="avatar-circle">${escapeHtml(getInitials(userName || 'Usuário'))}</div>
          <div class="shell-user-meta">
            <div class="shell-user-name">${escapeHtml(userName || 'Usuário')}</div>
            <div class="muted shell-trial-text">${escapeHtml(trialText(user))}</div>
            <button id="logoutBtn" type="button" class="link-btn">Sair</button>
          </div>
        </div>
      </div>
    </header>
    <div class="shell-body container" style="--tenant-primary:${brandPrimary}; --tenant-secondary:${brandSecondary}; --tenant-accent:${brandAccent};">
      <div id="shellBackdrop" class="shell-backdrop"></div>
      <aside class="sidebar card" id="shellSidebar">
        <nav class="sidebar-nav">
          <a href="/dashboard.html"><span class="nav-icon">◔</span><span>Dashboard</span></a>
          <a href="/students.html"><span class="nav-icon">👧</span><span>Estudantes</span></a>
          <a href="/assessments.html"><span class="nav-icon">🧠</span><span>Diagnósticos</span></a>
          <a href="/cycles.html"><span class="nav-icon">📅</span><span>Ciclos</span></a>
          <a href="/diagnostico.html"><span class="nav-icon">✨</span><span>Novo diagnóstico</span></a>
          <a href="/roadmap.html"><span class="nav-icon">🗺️</span><span>Roadmap</span></a>
          <a href="/billing.html"><span class="nav-icon">💳</span><span>Billing</span></a>
          ${features.premium_workspace ? `<a href="/premium.html"><span class="nav-icon">👑</span><span>Plano Premium</span></a>` : ``}
          ${user?.is_platform_admin ? `<a href="/master-admin.html"><span class="nav-icon">🛰️</span><span>Master Admin</span></a>` : ``}
        </nav>
      </aside>
      <div class="shell-main-wrap">
        <div class="shell-main" id="shellMain"></div>
        <footer class="shell-footer card"><div class="shell-footer-brand"><img class="shell-footer-logo" src="${escapeHtml(brandLogo)}" alt="${escapeHtml(tenantName)}" /><div><strong>${escapeHtml(tenantName)}</strong><small>${escapeHtml(brand.website || "Ambiente personalizado")}</small></div></div><div>© ${currentYear} ${escapeHtml(tenantName)}.</div></footer>
      </div>
    </div>
  `;

  const currentPath = window.location.pathname;
  shell.querySelectorAll('.sidebar-nav a').forEach((link) => {
    if (link.getAttribute('href') === currentPath) link.classList.add('active');
    link.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  const toggleButton = document.getElementById('mobileNavToggle');
  const backdrop = document.getElementById('shellBackdrop');
  const syncMenuState = () => {
    const open = document.body.classList.contains('sidebar-open');
    toggleButton?.setAttribute('aria-expanded', String(open));
    toggleButton && (toggleButton.textContent = open ? '✕' : '☰');
  };
  toggleButton?.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
    syncMenuState();
  });
  backdrop?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
    syncMenuState();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100) {
      document.body.classList.remove('sidebar-open');
      syncMenuState();
    }
  });
  syncMenuState();
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  installInsightChat();
}

export function setShellContent(html) {
  const target = document.getElementById('shellMain');
  if (target) target.innerHTML = html;
}

export function showToast(message, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

export function setLoadingState(isLoading, message = 'Carregando ambiente...') {
  let overlay = document.getElementById('loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-panel">
        <div class="loading-illustration">
          <div class="loading-orbit orbit-a"></div>
          <div class="loading-orbit orbit-b"></div>
          <div class="loading-core">IA</div>
        </div>
        <strong class="loading-title">LoopinEdu em ação</strong>
        <div id="loadingMessage" class="loading-message"></div>
        <div class="loading-progress"><span id="loadingProgressBar"></span></div>
        <div class="loading-caption">Processando dados, experiência e insights com segurança.</div>
      </div>`;
    document.body.appendChild(overlay);
  }

  const messageNode = document.getElementById('loadingMessage');
  const progressNode = document.getElementById('loadingProgressBar');
  if (messageNode) messageNode.textContent = message;
  overlay.classList.toggle('visible', Boolean(isLoading));

  clearInterval(setLoadingState._timer);
  if (progressNode) progressNode.style.width = isLoading ? '14%' : '100%';

  if (isLoading) {
    let progress = 14;
    setLoadingState._timer = setInterval(() => {
      progress = Math.min(progress + (message.toLowerCase().includes('ia') ? 9 : 14), 88);
      if (progressNode) progressNode.style.width = `${progress}%`;
    }, message.toLowerCase().includes('ia') ? 650 : 420);
  }
}

export function formatDimensionLabel(value) {
  return ({
    cognitive: 'Cognitivo',
    organization: 'Organização',
    relational: 'Relacional',
    emotional: 'Emocional'
  })[value] || value;
}

export function isRestrictedUser(user) {
  return Boolean(user?.restricted || user?.tenant?.restricted);
}

export function featureEnabled(user, featureKey) {
  const features = user?.features || user?.tenant?.features || {};
  return Boolean(features[featureKey]);
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function statusBadge(status) {
  const map = {
    draft: 'Rascunho',
    active: 'Ativo',
    closed: 'Fechado',
    collecting: 'Coletando',
    scoring: 'Calculando',
    processing_ai: 'IA',
    completed: 'Concluído',
    error: 'Erro',
    pending: 'Pendente'
  };
  return `<span class="status-badge status-${status}">${map[status] || status}</span>`;
}

export function buildMiniBarChart(items = [], { valueKey = 'value', labelKey = 'label', maxValue = 5 } = {}) {
  if (!items.length) return '<div class="empty-state">Sem dados suficientes para o gráfico.</div>';
  return `
    <div class="mini-chart premium-chart">
      ${items.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const width = Math.max(8, Math.round((value / maxValue) * 100));
        return `
          <div class="mini-chart-row">
            <div class="mini-chart-label"><span class="chart-rank">${index + 1}</span>${escapeHtml(item[labelKey] ?? '')}</div>
            <div class="mini-chart-track"><div class="mini-chart-fill" style="width:${width}%;"></div></div>
            <div class="mini-chart-value">${value.toFixed(2)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function buildProgressDonut(value = 0, max = 5, label = 'Score') {
  const numeric = Number(value || 0);
  const pct = Math.max(4, Math.min(100, Math.round((numeric / max) * 100)));
  const tone = numeric >= 4 ? 'excellent' : numeric >= 3 ? 'good' : numeric >= 2 ? 'attention' : 'critical';
  return `
    <div class="progress-donut ${tone}" style="--progress:${pct};">
      <div class="progress-donut-inner">
        <div class="progress-donut-label">${escapeHtml(label)}</div>
        <div class="progress-donut-value">${numeric.toFixed(2)}</div>
      </div>
    </div>
  `;
}

export async function copyToClipboard(value) {
  await navigator.clipboard.writeText(value);
  showToast('Link copiado para a área de transferência.');
}

export function getCoreMethodItems() {
  return CORE_METHOD_ITEMS.map((item) => ({ ...item }));
}

export function buildCoreMethodLegend(scores = {}, { max = 5, showValues = true } = {}) {
  return `
    <div class="core-method-grid">
      ${CORE_METHOD_ITEMS.map((item) => {
        const raw = Number(scores?.[item.key] ?? 0);
        const pct = Math.max(6, Math.min(100, Math.round((raw / max) * 100)));
        return `
          <article class="core-method-card">
            <div class="core-method-head">
              <div class="core-method-icon">${item.icon}</div>
              <div>
                <div class="core-method-letter">${item.shortLabel}</div>
                <h3>${escapeHtml(item.title)}</h3>
              </div>
              ${showValues ? `<strong class="core-method-score">${raw.toFixed(2)}</strong>` : ''}
            </div>
            <p>${escapeHtml(item.description)}</p>
            <div class="core-progress-meta"><span>Escala do método</span><span>${raw.toFixed(2)} / ${Number(max).toFixed(0)}</span></div>
            <div class="core-progress"><span style="width:${pct}%;"></span></div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

export function respondentVisual(type = '') {
  return ({
    student: { icon: '🧒', label: 'Aluno' },
    teacher: { icon: '👩‍🏫', label: 'Professor' },
    guardian: { icon: '👨‍👩‍👧', label: 'Responsável' },
    institutional: { icon: '🏫', label: 'Institucional' }
  })[type] || { icon: '✨', label: type || 'Respondente' };
}

export function studentAvatarByGender(gender = '', name = 'Estudante') {
  const key = String(gender || '').toLowerCase();
  const icon = ({
    feminino: '👧',
    female: '👧',
    f: '👧',
    masculino: '👦',
    male: '👦',
    m: '👦'
  })[key] || '🧑';
  return `
    <div class="student-score-avatar">
      <div class="student-score-avatar-icon">${icon}</div>
      <div>
        <strong>${escapeHtml(name)}</strong>
        <div class="muted">Leitura socioemocional individual</div>
      </div>
    </div>
  `;
}

export function buildRespondentComparison(data = []) {
  if (!data.length) return '<div class="empty-state">Sem dados suficientes para comparar os respondentes.</div>';
  const grouped = new Map();
  data.forEach((item) => {
    const current = grouped.get(item.respondent_type) || [];
    current.push(item);
    grouped.set(item.respondent_type, current);
  });
  return `
    <div class="respondent-compare-grid">
      ${[...grouped.entries()].map(([type, items]) => {
        const visual = respondentVisual(type);
        const avg = items.reduce((sum, item) => sum + Number(item.average_score || 0), 0) / Math.max(items.length, 1);
        return `
          <article class="respondent-card">
            <div class="respondent-card-head">
              <div class="respondent-avatar">${visual.icon}</div>
              <div>
                <h3>${escapeHtml(visual.label)}</h3>
                <small>Média geral ${avg.toFixed(2)}</small>
              </div>
            </div>
            <div class="respondent-dimension-list">
              ${items.map((item) => {
                const val = Number(item.average_score || 0);
                const width = Math.max(8, Math.min(100, Math.round((val / 5) * 100)));
                return `
                  <div class="respondent-dimension-row">
                    <div class="respondent-dimension-meta">
                      <span>${escapeHtml(formatDimensionLabel(item.dimension))}</span>
                      <strong>${val.toFixed(2)}</strong>
                    </div>
                    <div class="respondent-dimension-bar"><span style="width:${width}%;"></span></div>
                  </div>
                `;
              }).join('')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;
}

let insightChatState = {
  messages: [
    { role: 'assistant', content: 'Olá! Sou o assistente CORE. Abra o painel para ver alertas rápidos, prioridades e próximos passos do diagnóstico.' }
  ],
  suggestions: [
    'Quais dimensões merecem atenção?',
    'Como ler divergências entre respondentes?',
    'Qual o próximo passo recomendado?'
  ],
  context: ''
};

function buildAssistantReply(input = '') {
  const message = String(input || '').toLowerCase();
  if (message.includes('diverg')) return 'Quando há divergência entre respondentes, vale comparar contexto de casa, sala e rotina. Diferenças altas costumam pedir escuta complementar antes de definir uma intervenção.';
  if (message.includes('próximo') || message.includes('proximo') || message.includes('ação') || message.includes('acao')) return 'Priorize uma meta por vez: 1) estabilizar a dimensão mais baixa, 2) alinhar responsáveis e escola, 3) revisar evolução no próximo ciclo com evidência objetiva.';
  if (message.includes('atenção') || message.includes('atencao') || message.includes('risco') || message.includes('dimens')) return 'Observe primeiro os indicadores abaixo de 3,0. Em geral, emocional e organização pedem intervenção mais rápida porque afetam constância, engajamento e aprendizagem.';
  return 'Posso resumir prioridades, explicar o método C.O.R.E. e sugerir próximos passos. Use os atalhos do painel para navegar mais rápido.';
}

function renderInsightChat() {
  let root = document.getElementById('insightChatbot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'insightChatbot';
    root.className = 'insight-chatbot';
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <button id="insightChatToggle" type="button" class="insight-chatbot-toggle" aria-expanded="false">
      <span>💡</span><strong>Insights</strong>
    </button>
    <div class="insight-chatbot-panel" id="insightChatPanel">
      <div class="insight-chatbot-header">
        <div>
          <div class="eyebrow">Assistente CORE</div>
          <strong>Insights importantes</strong>
        </div>
        <button id="insightChatClose" type="button" class="link-btn">Fechar</button>
      </div>
      <div class="insight-chatbot-body" id="insightChatMessages">
        ${insightChatState.messages.map((item) => `<div class="chat-line ${item.role}">${escapeHtml(item.content)}</div>`).join('')}
        ${insightChatState.context ? `<div class="chat-context">${escapeHtml(insightChatState.context)}</div>` : ''}
      </div>
      <div class="insight-chatbot-suggestions">
        ${insightChatState.suggestions.map((item) => `<button type="button" class="insight-suggestion">${escapeHtml(item)}</button>`).join('')}
      </div>
      <form id="insightChatForm" class="insight-chatbot-form">
        <input id="insightChatInput" type="text" placeholder="Pergunte sobre prioridades, riscos ou próximos passos..." />
        <button class="btn" type="submit">Enviar</button>
      </form>
    </div>
  `;
  const rootToggle = () => root.classList.toggle('open');
  root.querySelector('#insightChatToggle')?.addEventListener('click', rootToggle);
  root.querySelector('#insightChatClose')?.addEventListener('click', rootToggle);
  root.querySelectorAll('.insight-suggestion').forEach((button) => {
    button.addEventListener('click', () => {
      const content = button.textContent || '';
      insightChatState.messages.push({ role: 'user', content });
      insightChatState.messages.push({ role: 'assistant', content: buildAssistantReply(content) });
      renderInsightChat();
      document.getElementById('insightChatbot')?.classList.add('open');
    });
  });
  root.querySelector('#insightChatForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = root.querySelector('#insightChatInput');
    const value = input?.value?.trim();
    if (!value) return;
    insightChatState.messages.push({ role: 'user', content: value });
    insightChatState.messages.push({ role: 'assistant', content: buildAssistantReply(value) });
    renderInsightChat();
    document.getElementById('insightChatbot')?.classList.add('open');
  });
}

export function installInsightChat() {
  renderInsightChat();
}

export function setInsightChatContext({ context = '', suggestions = [] } = {}) {
  insightChatState.context = context || '';
  if (suggestions.length) insightChatState.suggestions = suggestions;
  renderInsightChat();
}
