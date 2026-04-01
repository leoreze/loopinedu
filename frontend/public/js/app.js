const apiBase = '/api';
const TOKEN_KEY = 'loopinedu_token';
const USER_KEY = 'loopinedu_user';

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
    if (response.status === 401) {
      clearSession();
    }
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
    if (error.code !== 'TENANT_TRIAL_EXPIRED' && error.code !== 'TENANT_BILLING_BLOCKED' && error.code !== 'TENANT_BLOCKED') {
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

export function installShell({ title = 'LoopinEdu', userName = '', user = null } = {}) {
  const shell = document.getElementById('appShell');
  if (!shell) return;
  const tenantName = user?.tenant_name || user?.tenant?.name || 'Ambiente institucional';
  const tenantPlan = user?.plan || user?.tenant?.plan || 'trial';
  const features = user?.features || user?.tenant?.features || {};
  const brandPrimary = user?.branding?.primary_color || user?.tenant?.primary_color || '#1f8560';
  const brandSecondary = user?.branding?.secondary_color || user?.tenant?.secondary_color || '#1f3c88';
  const brandAccent = user?.branding?.accent_color || user?.tenant?.accent_color || '#42c6c6';

  shell.innerHTML = `
    <header class="topbar">
      <div class="container topbar-inner shell-topbar-inner">
        <a class="logo logo-image playful-logo" href="/dashboard.html" aria-label="LoopinEdu"><img class="brand-logo" src="/assets/brand/logo-loopinedu-light.svg" alt="LoopinEdu" /></a>
        <div class="shell-title-wrap">
          <div class="muted shell-kicker">${escapeHtml(tenantName)}</div>
          <strong>${title}</strong>
        </div>
        <div class="shell-user">
          <div class="shell-plan-badge"><span>★</span>${escapeHtml(String(tenantPlan).toUpperCase())}</div>
          <div class="avatar-circle">${(userName || 'A').slice(0,1).toUpperCase()}</div>
          <div>
            <div class="shell-user-name">${userName || 'Usuário'}</div>
            <div class="muted shell-trial-text">${trialText(user)}</div>
            <button id="logoutBtn" type="button" class="link-btn">Sair</button>
          </div>
        </div>
      </div>
    </header>
    <div class="shell-body container" style="--tenant-primary:${brandPrimary}; --tenant-secondary:${brandSecondary}; --tenant-accent:${brandAccent};">
      <aside class="sidebar card">
        <nav class="sidebar-nav">
          <a href="/dashboard.html"><span class="nav-icon">◔</span><span>Dashboard</span></a>
          <a href="/students.html"><span class="nav-icon">👧</span><span>Estudantes</span></a>
          <a href="/assessments.html"><span class="nav-icon">🧠</span><span>Diagnósticos</span></a>
          <a href="/cycles.html"><span class="nav-icon">📅</span><span>Ciclos</span></a>
          <a href="/diagnostico.html"><span class="nav-icon">✨</span><span>Novo diagnóstico</span></a>
          <a href="/billing.html"><span class="nav-icon">💳</span><span>Billing</span></a>
          ${features.premium_workspace ? `<a href="/premium.html"><span class="nav-icon">👑</span><span>Plano Premium</span></a>` : ``}
          ${user?.is_platform_admin ? `<a href="/master-admin.html"><span class="nav-icon">🛰️</span><span>Master Admin</span></a>` : ``}
        </nav>
      </aside>
      <div class="shell-main" id="shellMain"></div>
    </div>
  `;

  const currentPath = window.location.pathname;
  shell.querySelectorAll('.sidebar-nav a').forEach((link) => {
    if (link.getAttribute('href') === currentPath) link.classList.add('active');
  });
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
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
    overlay.innerHTML = `<div class="loading-panel"><div class="spinner"></div><div id="loadingMessage"></div></div>`;
    document.body.appendChild(overlay);
  }
  document.getElementById('loadingMessage').textContent = message;
  overlay.classList.toggle('visible', Boolean(isLoading));
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
    <div class="mini-chart">
      ${items.map((item) => {
        const value = Number(item[valueKey] || 0);
        const width = Math.max(8, Math.round((value / maxValue) * 100));
        return `
          <div class="mini-chart-row">
            <div class="mini-chart-label">${escapeHtml(item[labelKey] ?? '')}</div>
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
  return `
    <div class="progress-donut" style="--progress:${pct};">
      <div class="progress-donut-inner">
        <div class="muted">${escapeHtml(label)}</div>
        <div class="progress-donut-value">${numeric.toFixed(2)}</div>
      </div>
    </div>
  `;
}


export async function copyToClipboard(value) {
  await navigator.clipboard.writeText(value);
  showToast('Link copiado para a área de transferência.');
}
