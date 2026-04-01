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
  const dimensions = dimensionsFor(record);
  const overall = Number(record.overall_score || 0);
  const progress = Math.max(12, Math.min(100, Math.round((overall / 5) * 100)));

  const issuanceDate = new Date(record.updated_at || record.created_at || Date.now()).toLocaleDateString('pt-BR');
  const logoMarkup = `<div class="brand-logo-lockup"><div class="brand-mark"><span class="brand-l"></span><span class="brand-e1"></span><span class="brand-e2"></span><span class="brand-wave"></span></div><div><div class="brand-word">Loopin<span>Edu</span></div><div class="brand-tag">Entenda o estudante por inteiro</div></div></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório LoopinEdu</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #eaf1ff; color: #0f172a; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 18mm 18mm 16mm; position: relative; }
    .cover { background: linear-gradient(135deg, #0f172a, #1d4ed8 60%, #38bdf8); color: white; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo-lockup { display:flex; align-items:center; gap:16px; }
    .brand-mark { width:72px; height:72px; border-radius:22px; background:#233252; position:relative; box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
    .brand-l { position:absolute; left:14px; top:11px; width:16px; height:48px; border-radius:8px; background: linear-gradient(180deg,#6d7cff,#2cc7a5); }
    .brand-e1 { position:absolute; left:30px; top:11px; width:28px; height:50px; border:10px solid #f5f7ff; border-right:none; border-radius:18px 0 0 18px; }
    .brand-e2 { position:absolute; left:39px; top:24px; width:20px; height:24px; border:8px solid #f5f7ff; border-right:none; border-radius:14px 0 0 14px; }
    .brand-wave { position:absolute; left:10px; bottom:10px; width:52px; height:10px; border-radius:999px; background: linear-gradient(90deg,#6d7cff,#2cc7a5); opacity:.92; }
    .brand-word { font-size: 28px; font-weight: 800; letter-spacing: -.04em; color: inherit; }
    .brand-word span { color:#2cc7a5; }
    .brand-tag { font-size: 12px; color: rgba(255,255,255,.82); margin-top: 4px; }
    .hero { margin-top: 24px; padding: 28px; border-radius: 28px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); }
    .hero h1 { margin: 10px 0 12px; font-size: 34px; line-height: 1.08; }
    .muted { opacity: .78; }
    .score-pill { display:inline-flex; align-items:center; gap:12px; padding:14px 20px; border-radius:999px; background:white; color:#0f172a; font-weight:700; margin-top:20px; }
    .grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
    .card { border: 1px solid #dbe4ff; border-radius: 22px; padding: 18px; background: #f8fbff; }
    .hero-grid { display:grid; grid-template-columns: 1.2fr .8fr; gap: 18px; margin-top: 24px; align-items: stretch; }
    .card h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color:#475569; }
    .card strong.big { font-size: 30px; }
    .section-title { font-size: 22px; margin: 28px 0 16px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin-bottom: 8px; line-height: 1.5; }
    .footer { position: absolute; left: 18mm; right: 18mm; bottom: 10mm; display:flex; justify-content:space-between; font-size:12px; color:#64748b; }
    .two { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .summary { font-size: 15px; line-height: 1.7; color:#334155; }
    .gauge { width: 160px; height: 160px; border-radius: 50%; margin: 10px auto; display:grid; place-items:center; background: conic-gradient(#22c55e 0 ${progress * 3.6}deg, rgba(15,23,42,.12) ${progress * 3.6}deg 360deg); }
    .gauge-inner { width: 122px; height: 122px; border-radius:50%; background:white; display:grid; place-items:center; text-align:center; }
    .bar-chart { display:grid; gap: 12px; }
    .bar-row { display:grid; gap: 6px; }
    .bar-meta { display:flex; justify-content:space-between; gap:14px; font-size:14px; color:#334155; }
    .bar-track { width:100%; height: 12px; border-radius:999px; background:#dbe7ff; overflow:hidden; }
    .bar-fill { height:100%; border-radius:999px; }
    .bar-band { font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
    .detail-grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
    .detail-item { border-radius: 16px; padding: 14px; background: rgba(15,23,42,.04); }
    .detail-item span { display:block; color:#64748b; font-size:12px; text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px; }
    .detail-item strong { font-size:14px; }
    @media print { body { background: white; } .page { margin: 0; } }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="brand">${logoMarkup}</div>
    <div class="hero">
      <div class="muted">Diagnóstico sócio-emocional • Método C.O.R.E. 360</div>
      <h1>${escapeHtml(record.student_name || 'Estudante')}</h1>
      <div class="muted">${escapeHtml(record.school_name || 'Escola não informada')} • ${escapeHtml(record.cycle_title || 'Ciclo aberto')}</div>
      <div class="score-pill">Score geral <span style="font-size:28px;">${overall ? overall.toFixed(2) : '--'}</span> <span style="color:#475569;">${escapeHtml(record.overall_band || scoreBandLabel(overall))}</span></div>
    </div>

    <div class="hero-grid">
      <div class="card">
        <h3>Leitura por dimensão</h3>
        <div class="bar-chart">${buildBars(dimensions)}</div>
      </div>
      <div class="card">
        <h3>Saúde geral</h3>
        <div class="gauge"><div class="gauge-inner"><div><div style="font-size:12px; color:#64748b;">Resultado</div><div style="font-size:34px; font-weight:800;">${overall ? overall.toFixed(2) : '--'}</div><div style="font-size:12px; color:${scoreColor(overall)}; font-weight:700; text-transform:uppercase; letter-spacing:.06em;">${escapeHtml(record.overall_band || scoreBandLabel(overall))}</div></div></div></div>
        <div class="detail-grid">
          <div class="detail-item"><span>Série</span><strong>${escapeHtml(record.grade_level || 'Não informada')}</strong></div>
          <div class="detail-item"><span>Turma</span><strong>${escapeHtml(record.class_name || 'Não informada')}</strong></div>
          <div class="detail-item"><span>Responsável</span><strong>${escapeHtml(record.guardian_name || 'Não informado')}</strong></div>
          <div class="detail-item"><span>Contato</span><strong>${escapeHtml(record.guardian_email || 'Não informado')}</strong></div>
        </div>
      </div>
    </div>

    <div class="footer"><span>${escapeHtml(record.method_name || 'C.O.R.E. 360')}</span><span>Gerado em ${generatedAt}</span></div>
  </section>

  <section class="page">
    <h2 class="section-title">Resumo executivo</h2>
    <div class="card summary">${escapeHtml(record.ai_summary || 'Sem resumo gerado até o momento.')}</div>

    <div class="two" style="margin-top:20px;">
      <div class="card">
        <h3>Pontos fortes</h3>
        <ul>${listHtml(record.strengths)}</ul>
      </div>
      <div class="card">
        <h3>Riscos e atenção</h3>
        <ul>${listHtml(record.risks)}</ul>
      </div>
    </div>

    <h2 class="section-title">Plano de ação recomendado</h2>
    <div class="card">
      <ul>${listHtml(record.action_plan)}</ul>
    </div>

    <div class="footer"><span>LoopinEdu • Relatório institucional</span><span>${escapeHtml(record.student_name || '')}</span></div>
  </section>

  <section class="page">
    <div class="brand">${logoMarkup}</div>
    <h2 class="section-title">Pontos fortes, riscos e plano de ação</h2>
    <div class="two">
      <div class="card">
        <h3>Pontos fortes</h3>
        <ul>${listHtml(record.strengths)}</ul>
      </div>
      <div class="card">
        <h3>Riscos e atenção</h3>
        <ul>${listHtml(record.risks)}</ul>
      </div>
    </div>
    <div class="card" style="margin-top:18px;">
      <h3>Plano de ação</h3>
      <ul>${listHtml(record.action_plan)}</ul>
    </div>
    <div class="footer"><span>Página 3 • Encaminhamento pedagógico</span><span>${escapeHtml(record.student_name || '')}</span></div>
  </section>

  <section class="page">
    <div class="brand">${logoMarkup}</div>
    <h2 class="section-title">Histórico e recomendações finais</h2>
    <div class="two">
      <div class="card">
        <h3>Histórico do ciclo</h3>
        <ul>
          <li>Diagnóstico criado em ${issuanceDate}.</li>
          <li>Ciclo: ${escapeHtml(record.cycle_title || 'Ciclo aberto')}.</li>
          <li>Status atual: ${escapeHtml(record.status || 'completed')}.</li>
          <li>Escola: ${escapeHtml(record.school_name || 'Não informada')}.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Recomendações finais</h3>
        <ul>
          <li>Compartilhar a leitura com coordenação, especialistas e responsáveis.</li>
          <li>Priorizar intervenções nas dimensões abaixo da faixa estável.</li>
          <li>Reaplicar o ciclo para acompanhar evolução ao longo do período.</li>
          <li>Registrar devolutiva com data de emissão e próximos passos.</li>
        </ul>
      </div>
    </div>
    <div class="card" style="margin-top:18px;">
      <h3>Observações gerais</h3>
      <div class="summary">${escapeHtml(record.notes || 'Sem observações complementares registradas para este diagnóstico.')}</div>
    </div>
    <div class="footer"><span>Página 4 • Data da emissão ${generatedAt}</span><span>${escapeHtml(record.method_name || 'C.O.R.E. 360')}</span></div>
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
