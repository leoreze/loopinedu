function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function listHtml(items = [], empty = 'Sem dados registrados.') {
  const safeItems = normalizeArray(items);
  if (!safeItems.length) return `<li>${escapeHtml(empty)}</li>`;
  return safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function scoreColor(value) {
  const score = Number(value || 0);
  if (score >= 4.01) return '#22c55e';
  if (score >= 3.01) return '#38bdf8';
  if (score >= 2.01) return '#f59e0b';
  return '#fb7185';
}

function scoreBandLabel(value) {
  const score = Number(value || 0);
  if (score >= 4.01) return 'Destaque';
  if (score >= 3.01) return 'Estável';
  if (score >= 2.01) return 'Atenção';
  return 'Crítico';
}

function dimensionsFor(record) {
  return [
    ['Cognitivo', Number(record.cognitive_score || 0)],
    ['Organização', Number(record.organization_score || 0)],
    ['Relacional', Number(record.relational_score || 0)],
    ['Emocional', Number(record.emotional_score || 0)]
  ];
}

function buildBars(dimensions) {
  const max = 5;
  return dimensions.map(([label, value]) => {
    const width = Math.max(6, Math.round((Number(value || 0) / max) * 100));
    const color = scoreColor(value);
    return `
      <div class="bar-row">
        <div class="bar-meta"><span>${escapeHtml(label)}</span><strong>${Number(value || 0).toFixed(2)}</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${color};"></div></div>
        <div class="bar-band" style="color:${color};">${scoreBandLabel(value)}</div>
      </div>
    `;
  }).join('');
}


export function buildAssessmentHtmlReport(record) {
  const generatedAt = new Date().toLocaleString('pt-BR');
  const issuanceDate = new Date(record.updated_at || record.created_at || Date.now()).toLocaleDateString('pt-BR');
  const dimensions = dimensionsFor(record);
  const overall = Number(record.overall_score || 0);
  const progress = Math.max(12, Math.min(100, Math.round((overall / 5) * 100)));
  const primary = record.primary_color || '#2A877F';
  const secondary = record.secondary_color || '#233347';
  const accent = record.accent_color || '#8CBC5E';
  const schoolName = record.school_name || record.tenant_name || 'Escola não informada';
  const website = record.branding_json?.website || '';
  const logoMarkup = record.logo_url
    ? `<div class="brand-logo-box"><img src="${escapeHtml(record.logo_url)}" alt="${escapeHtml(schoolName)}" /></div>`
    : `<div class="brand-logo-lockup"><div class="brand-mark">LE</div><div><div class="brand-word">${escapeHtml(schoolName)}</div><div class="brand-tag">Relatório institucional premium</div></div></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório ${escapeHtml(schoolName)}</title>
  <style>
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --accent: ${accent};
      --ink: #18212b;
      --muted: #667085;
      --paper: #f6f8fb;
      --line: rgba(24, 33, 43, 0.10);
      --shadow: 0 18px 42px rgba(24, 33, 43, 0.10);
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, Arial, sans-serif; background: var(--paper); color: var(--ink); }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 16mm; position: relative; overflow: hidden; }
    .page::before { content: ""; position:absolute; inset:0; background:
      radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 18%, transparent), transparent 30%),
      radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 16%, transparent), transparent 28%);
      pointer-events:none; }
    .cover { background: linear-gradient(135deg, var(--secondary), color-mix(in srgb, var(--secondary) 70%, var(--primary)), var(--primary)); color: white; }
    .cover::before { background:
      radial-gradient(circle at top right, rgba(255,255,255,.16), transparent 26%),
      radial-gradient(circle at bottom left, rgba(255,255,255,.12), transparent 24%); }
    .topline { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:18px; }
    .brand-logo-box { display:inline-flex; align-items:center; justify-content:center; min-height:76px; max-width:280px; padding:12px 16px; border-radius:24px; background: rgba(255,255,255,.95); box-shadow: 0 18px 36px rgba(0,0,0,.12); }
    .brand-logo-box img { max-height:48px; max-width:240px; width:auto; object-fit:contain; }
    .brand-logo-lockup { display:flex; align-items:center; gap:16px; }
    .brand-mark { width:72px; height:72px; border-radius:22px; display:grid; place-items:center; font-size:28px; font-weight:900; letter-spacing:-.08em; background: rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.24); }
    .brand-word { font-size:26px; font-weight:800; letter-spacing:-.04em; }
    .brand-tag, .microcopy { font-size:12px; opacity:.82; }
    .hero { position:relative; z-index:1; margin-top:18px; padding:26px; border-radius:30px; background: rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.18); box-shadow: inset 0 1px 0 rgba(255,255,255,.10); }
    .eyebrow { display:inline-flex; padding:8px 12px; border-radius:999px; background: rgba(255,255,255,.14); font-size:11px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    h1 { margin:14px 0 10px; font-size:34px; line-height:1.05; letter-spacing:-.05em; }
    .lead { font-size:15px; line-height:1.6; max-width:60ch; opacity:.9; }
    .score-pill { display:inline-flex; align-items:center; gap:14px; margin-top:18px; padding:14px 18px; border-radius:999px; background:white; color:var(--secondary); box-shadow: var(--shadow); font-weight:800; }
    .score-pill strong { font-size:28px; line-height:1; }
    .hero-grid, .two-col, .overview-grid { position:relative; z-index:1; display:grid; gap:16px; margin-top:18px; }
    .hero-grid { grid-template-columns: 1.15fr .85fr; }
    .two-col { grid-template-columns: 1fr 1fr; }
    .overview-grid { grid-template-columns: repeat(4, 1fr); }
    .card { border:1px solid var(--line); border-radius:24px; padding:18px; background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(246,248,251,.94)); box-shadow: var(--shadow); position:relative; z-index:1; }
    .glass-card { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.24); box-shadow:none; }
    .section-title { position:relative; z-index:1; margin:0 0 14px; font-size:20px; letter-spacing:-.03em; color: var(--secondary); }
    .card h3 { margin:0 0 12px; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.12em; }
    .summary { font-size:15px; line-height:1.7; color:#344054; }
    .kpi-card strong { display:block; font-size:26px; line-height:1.1; color: var(--secondary); margin-top:6px; }
    .kpi-card span { color: var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .gauge { width: 174px; height:174px; margin: 6px auto 0; border-radius:50%; display:grid; place-items:center;
      background: conic-gradient(var(--secondary) 0 calc(${progress} * 1%), var(--primary) calc(${progress} * 1%) calc(${progress} * 1% + 10%), var(--accent) calc(${progress} * 1% + 10%) calc(${progress} * 1% + 20%), rgba(24,33,43,.10) 0); }
    .gauge-inner { width:128px; height:128px; border-radius:50%; background:white; display:grid; place-items:center; text-align:center; box-shadow: inset 0 0 0 1px var(--line); }
    .gauge-inner strong { font-size:34px; line-height:1; color:var(--secondary); }
    .gauge-inner span { display:block; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
    .band { margin-top:6px; text-align:center; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:${scoreColor(overall)}; }
    .bar-chart { display:grid; gap:14px; }
    .bar-row { display:grid; gap:6px; }
    .bar-meta { display:flex; justify-content:space-between; gap:14px; font-size:14px; }
    .bar-track { width:100%; height:12px; border-radius:999px; background: rgba(24,33,43,.08); overflow:hidden; }
    .bar-fill { height:100%; border-radius:999px; }
    .bar-band { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; }
    .chips { display:flex; gap:8px; flex-wrap:wrap; }
    .chip { padding:8px 10px; border-radius:999px; background: color-mix(in srgb, var(--primary) 10%, white); color:var(--secondary); font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; }
    ul { margin:0; padding-left:20px; }
    li { margin-bottom:8px; line-height:1.5; }
    .timeline { display:grid; gap:12px; }
    .timeline-item { display:grid; grid-template-columns: 42px 1fr; gap:12px; align-items:start; padding:12px; border-radius:18px; background: rgba(24,33,43,.04); }
    .timeline-item span { width:42px; height:42px; border-radius:14px; display:grid; place-items:center; background: color-mix(in srgb, var(--primary) 14%, white); color: var(--secondary); font-weight:800; }
    .footer { position:absolute; left:16mm; right:16mm; bottom:8mm; display:flex; justify-content:space-between; gap:12px; font-size:11px; color:#667085; z-index:1; }
    .footer strong { color:var(--secondary); }
    @media print { body { background:#fff; } .page { margin:0; } }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="topline">
      ${logoMarkup}
      <div style="text-align:right">
        <div class="microcopy">Relatório premium institucional</div>
        <div class="microcopy">${escapeHtml(website || 'loopinedu.com.br')}</div>
      </div>
    </div>

    <div class="hero">
      <div class="eyebrow">Diagnóstico sócio-emocional • Método C.O.R.E. 360</div>
      <h1>${escapeHtml(record.student_name || 'Estudante')}</h1>
      <div class="lead">${escapeHtml(schoolName)} • ${escapeHtml(record.cycle_title || 'Ciclo aberto')} • Documento executivo para coordenação, especialistas e liderança.</div>
      <div class="score-pill">Score geral <strong>${overall ? overall.toFixed(2) : '--'}</strong> <span>${escapeHtml(record.overall_band || scoreBandLabel(overall))}</span></div>
    </div>

    <div class="overview-grid">
      <div class="card glass-card kpi-card"><span>Série</span><strong>${escapeHtml(record.grade_level || 'Não informada')}</strong></div>
      <div class="card glass-card kpi-card"><span>Turma</span><strong>${escapeHtml(record.class_name || 'Não informada')}</strong></div>
      <div class="card glass-card kpi-card"><span>Responsável</span><strong>${escapeHtml(record.guardian_name || 'Não informado')}</strong></div>
      <div class="card glass-card kpi-card"><span>Emissão</span><strong>${issuanceDate}</strong></div>
    </div>

    <div class="hero-grid">
      <div class="card">
        <h3>Leitura por dimensão</h3>
        <div class="bar-chart">${buildBars(dimensions)}</div>
      </div>
      <div class="card">
        <h3>Saúde geral atual</h3>
        <div class="gauge"><div class="gauge-inner"><div><span>Resultado</span><strong>${overall ? overall.toFixed(2) : '--'}</strong></div></div></div>
        <div class="band">${escapeHtml(record.overall_band || scoreBandLabel(overall))}</div>
        <div class="chips" style="margin-top:14px;">
          <span class="chip">${escapeHtml(record.method_name || 'C.O.R.E. 360')}</span>
          <span class="chip">${escapeHtml(record.status || 'completed')}</span>
        </div>
      </div>
    </div>

    <div class="footer"><span><strong>${escapeHtml(schoolName)}</strong></span><span>Gerado em ${generatedAt}</span></div>
  </section>

  <section class="page">
    <h2 class="section-title">Resumo executivo</h2>
    <div class="card summary">${escapeHtml(record.ai_summary || 'Sem resumo gerado até o momento.')}</div>

    <div class="two-col" style="margin-top:18px;">
      <div class="card">
        <h3>Pontos fortes</h3>
        <ul>${listHtml(record.strengths)}</ul>
      </div>
      <div class="card">
        <h3>Riscos e atenção</h3>
        <ul>${listHtml(record.risks)}</ul>
      </div>
    </div>

    <div class="two-col" style="margin-top:18px;">
      <div class="card">
        <h3>Plano de ação recomendado</h3>
        <ul>${listHtml(record.action_plan)}</ul>
      </div>
      <div class="card">
        <h3>Leitura institucional</h3>
        <div class="summary">Este relatório organiza a leitura do estudante em linguagem executiva, destacando sinais, riscos e próximos passos para decisão pedagógica com mais clareza.</div>
      </div>
    </div>

    <div class="footer"><span>LoopinEdu • Resumo executivo</span><span>${escapeHtml(record.student_name || '')}</span></div>
  </section>

  <section class="page">
    <h2 class="section-title">Encaminhamento pedagógico</h2>
    <div class="two-col">
      <div class="card">
        <h3>Focos prioritários</h3>
        <ul>${listHtml(record.risks)}</ul>
      </div>
      <div class="card">
        <h3>Ações recomendadas</h3>
        <ul>${listHtml(record.action_plan)}</ul>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h3>Checklist de acompanhamento</h3>
      <div class="timeline">
        <div class="timeline-item"><span>01</span><div><strong>Compartilhar devolutiva</strong><div class="summary">Alinhar coordenação, especialistas e responsáveis sobre os sinais deste ciclo.</div></div></div>
        <div class="timeline-item"><span>02</span><div><strong>Definir responsável</strong><div class="summary">Atribuir o acompanhamento principal e registrar evidências.</div></div></div>
        <div class="timeline-item"><span>03</span><div><strong>Executar intervenção</strong><div class="summary">Aplicar a ação priorizada nas dimensões com maior atenção.</div></div></div>
        <div class="timeline-item"><span>04</span><div><strong>Reavaliar no próximo ciclo</strong><div class="summary">Medir evolução longitudinal e ajustar rota conforme os novos dados.</div></div></div>
      </div>
    </div>

    <div class="footer"><span>Plano de ação • ${escapeHtml(schoolName)}</span><span>${escapeHtml(record.student_name || '')}</span></div>
  </section>

  <section class="page">
    <h2 class="section-title">Histórico e recomendações finais</h2>
    <div class="two-col">
      <div class="card">
        <h3>Histórico do ciclo</h3>
        <ul>
          <li>Diagnóstico criado em ${issuanceDate}.</li>
          <li>Ciclo: ${escapeHtml(record.cycle_title || 'Ciclo aberto')}.</li>
          <li>Status atual: ${escapeHtml(record.status || 'completed')}.</li>
          <li>Escola: ${escapeHtml(schoolName)}.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Recomendações finais</h3>
        <ul>
          <li>Registrar devolutiva com data e responsáveis.</li>
          <li>Priorizar dimensões abaixo da faixa estável.</li>
          <li>Comparar com o próximo ciclo para evolução longitudinal.</li>
          <li>Compartilhar insumos com a liderança pedagógica.</li>
        </ul>
      </div>
    </div>
    <div class="card" style="margin-top:18px;">
      <h3>Observações gerais</h3>
      <div class="summary">${escapeHtml(record.notes || 'Sem observações complementares registradas para este diagnóstico.')}</div>
    </div>
    <div class="footer"><span>Página final • ${generatedAt}</span><span>${escapeHtml(record.method_name || 'C.O.R.E. 360')}</span></div>
  </section>
</body>
</html>`;
}



export function buildFamilyHtmlReport(record) {
  const strongest = dimensionsFor(record).sort((a,b)=>b[1]-a[1])[0] || ['Dimensão','--'];
  const attention = dimensionsFor(record).sort((a,b)=>a[1]-b[1])[0] || ['Dimensão','--'];
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>Devolutiva para família</title><style>body{font-family:Inter,Arial,sans-serif;background:#f6fbff;color:#16324f;margin:0;padding:32px}.wrap{max-width:900px;margin:0 auto}.card{background:#fff;border:1px solid #d8e8f5;border-radius:24px;padding:24px;box-shadow:0 10px 30px rgba(18,52,86,.06)}.hero{background:linear-gradient(135deg,#1f8560,#42c6c6);color:#fff;border-radius:28px;padding:28px;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.pill{display:inline-block;padding:8px 14px;border-radius:999px;background:#e9fff7;color:#1f8560;font-weight:700}.muted{color:#557086}.score{font-size:42px;font-weight:800}.list li{margin-bottom:10px}</style></head><body><div class="wrap"><section class="hero"><div style="font-size:13px;opacity:.9">LoopinEdu • devolutiva para família</div><h1 style="margin:10px 0 6px">${escapeHtml(record.student_name || 'Estudante')}</h1><div>${escapeHtml(record.school_name || 'Escola')} • ${escapeHtml(record.cycle_title || 'Ciclo atual')}</div></section><section class="grid"><div class="card"><div class="muted">Faixa geral</div><div class="score">${Number(record.overall_score||0).toFixed(2)}</div><div class="pill">${escapeHtml(record.overall_band || scoreBandLabel(record.overall_score))}</div></div><div class="card"><h3 style="margin-top:0">Leitura acolhedora</h3><p>${escapeHtml(record.ai_summary || 'O estudante apresentou sinais importantes para acompanhamento contínuo.')} </p></div></section><section class="grid" style="margin-top:16px"><div class="card"><h3 style="margin-top:0">O que mais se destacou</h3><p><strong>${escapeHtml(strongest[0])}</strong> foi a dimensão mais forte neste ciclo.</p><ul class="list">${listHtml(record.strengths, 'Sem destaques registrados.')}</ul></div><div class="card"><h3 style="margin-top:0">Ponto de atenção</h3><p><strong>${escapeHtml(attention[0])}</strong> pede mais acompanhamento neste momento.</p><ul class="list">${listHtml(record.risks, 'Sem riscos adicionais registrados.')}</ul></div></section><section class="card" style="margin-top:16px"><h3 style="margin-top:0">Como a família pode apoiar</h3><ul class="list">${listHtml(record.action_plan, 'Manter diálogo com a escola e apoiar uma rotina equilibrada.')}</ul><p class="muted" style="margin-top:18px">Data da emissão: ${escapeHtml(new Date().toLocaleDateString('pt-BR'))}</p></section></div></body></html>`;
}
export async function renderAssessmentPdfBuffer(record) {
  let puppeteerModule;
  try {
    puppeteerModule = await import('puppeteer');
  } catch {
    return null;
  }

  const puppeteer = puppeteerModule.default || puppeteerModule;
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 2200, deviceScaleFactor: 1.5 });
    await page.setContent(buildAssessmentHtmlReport(record), { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
  } finally {
    await browser.close();
  }
}
