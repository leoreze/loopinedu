import { getClient, query } from '../db/index.js';

const COLUMN_ORDER = ['backlog', 'development', 'testing', 'approved', 'done', 'production'];

const STATUS_LABELS = {
  backlog: 'Backlog',
  development: 'Desenvolvimento',
  testing: 'Testes',
  approved: 'Homologados',
  done: 'Concluídos',
  production: 'Produção'
};

function phaseRank(label = '') {
  const match = String(label).match(/(\d+)/);
  return match ? Number(match[1]) : 999;
}

function roadmapSort(a, b) {
  return (phaseRank(a.phase_label) - phaseRank(b.phase_label))
    || String(a.version_label || '').localeCompare(String(b.version_label || ''), 'pt-BR', { numeric: true })
    || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR');
}

const DEFAULT_CARDS = [
  { version_label: 'v1.2.0', phase_label: 'Fase 1', category: 'product', title: 'Plano de intervenção individual', description: 'Transformar resultado do diagnóstico em plano de ação com metas, responsáveis, prazo, evidências e status.', status: 'backlog', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Produto', progress_percent: 10, badge_label: 'Produto' },
  { version_label: 'v1.2.0', phase_label: 'Fase 1', category: 'data', title: 'Timeline evolutiva do estudante', description: 'Linha do tempo por ciclo com bandas, eventos relevantes, divergências, ações executadas e progresso longitudinal.', status: 'backlog', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Dados', progress_percent: 8, badge_label: 'Dados' },
  { version_label: 'v1.3.0', phase_label: 'Fase 2', category: 'ai', title: 'Alertas inteligentes e divergências', description: 'Detectar queda brusca, criticidade recorrente, ausência de respondente e divergências entre aluno, professor e responsável.', status: 'backlog', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'IA', progress_percent: 5, badge_label: 'IA' },
  { version_label: 'v1.3.0', phase_label: 'Fase 2', category: 'growth', title: 'Disparo em lote e lembretes automáticos', description: 'Convites, lembretes, régua de pendência e encerramento do ciclo com métricas de adesão por escola, série e turma.', status: 'backlog', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Growth', progress_percent: 4, badge_label: 'Growth' },
  { version_label: 'v2.0.0', phase_label: 'Fase 3', category: 'enterprise', title: 'Dashboard da rede escolar', description: 'Comparativo entre escolas, séries, turmas e unidades com leitura executiva para grupos educacionais e mantenedoras.', status: 'backlog', priority_label: 'P1', impact_label: 'Muito Alto', complexity_label: 'Alta', owner_label: 'Enterprise', progress_percent: 2, badge_label: 'Enterprise' },
  { version_label: 'v2.1.0', phase_label: 'Fase 3', category: 'ux', title: 'Área do responsável e professor', description: 'Painéis específicos com visão contextual, recomendações, pendências e histórico por perfil de uso.', status: 'backlog', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Alta', owner_label: 'UX', progress_percent: 1, badge_label: 'UX' },
  { version_label: 'v1.2.0', phase_label: 'Fase 1', category: 'product', title: 'Plano de ação por turma', description: 'Leitura consolidada da turma com prioridades coletivas, ações recomendadas e acompanhamento por coordenador.', status: 'development', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Produto', progress_percent: 42, badge_label: 'Produto' },
  { version_label: 'v1.2.0', phase_label: 'Fase 1', category: 'data', title: 'Painel de coleta de respondentes', description: 'Taxa de resposta por respondente, escola, série, turma e ciclo, com filtros, status e alertas de pendência.', status: 'development', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Dados', progress_percent: 56, badge_label: 'Dados' },
  { version_label: 'v1.3.0', phase_label: 'Fase 2', category: 'ai', title: 'Resumo executivo por IA para gestor', description: 'Síntese da escola com principais riscos, oportunidades, clusters críticos e recomendação mensal.', status: 'development', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'IA', progress_percent: 34, badge_label: 'IA' },
  { version_label: 'v1.3.0', phase_label: 'Fase 2', category: 'ux', title: 'Wizard premium de diagnóstico', description: 'Fluxo mobile-first em etapas com barra crescente, loading de IA, feedback progressivo e animações lúdicas.', status: 'development', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'UX', progress_percent: 61, badge_label: 'UX' },
  { version_label: 'v1.2.0', phase_label: 'Fase 1', category: 'product', title: 'Biblioteca de intervenções', description: 'Templates de ações por dimensão C.O.R.E., com objetivos, faixa etária, tempo estimado e orientação pedagógica.', status: 'testing', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Pedagógico', progress_percent: 74, badge_label: 'Produto' },
  { version_label: 'v1.3.0', phase_label: 'Fase 2', category: 'growth', title: 'Links inteligentes de coleta', description: 'Token com expiração, reenvio seguro, bloqueio de duplicidade e status em tempo real por participante.', status: 'testing', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Média', owner_label: 'Entrega', progress_percent: 82, badge_label: 'Growth' },
  { version_label: 'v2.0.0', phase_label: 'Fase 3', category: 'enterprise', title: 'Permissões por nível hierárquico', description: 'Mantenedora, diretor, coordenador, professor, especialista e responsável com escopo, limites e visão dedicada.', status: 'testing', priority_label: 'P1', impact_label: 'Muito Alto', complexity_label: 'Alta', owner_label: 'ACL', progress_percent: 78, badge_label: 'Enterprise' },
  { version_label: 'v2.0.0', phase_label: 'Fase 3', category: 'enterprise', title: 'Benchmark interno por escola e turma', description: 'Comparativos internos entre unidades, turmas e séries com média da rede, faixas críticas e evolução relativa.', status: 'approved', priority_label: 'P1', impact_label: 'Muito Alto', complexity_label: 'Alta', owner_label: 'Board', progress_percent: 92, badge_label: 'Enterprise' },
  { version_label: 'v2.1.0', phase_label: 'Fase 3', category: 'ai', title: 'Score institucional longitudinal', description: 'Visão histórica por escola com evolução por pilar, metas semestrais e tendência consolidada.', status: 'approved', priority_label: 'P2', impact_label: 'Alto', complexity_label: 'Alta', owner_label: 'BI', progress_percent: 88, badge_label: 'IA' },
  { version_label: 'v2.2.0', phase_label: 'Fase 4', category: 'growth', title: 'CRM comercial de escolas', description: 'Pipeline de leads, pilotos, propostas, fechamento, perda e workspace de implantação institucional.', status: 'done', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Alta', owner_label: 'Comercial', progress_percent: 100, badge_label: 'Growth' },
  { version_label: 'v2.2.0', phase_label: 'Fase 4', category: 'ux', title: 'Onboarding institucional guiado', description: 'Checklist de implantação por escola com branding, usuários, importação de alunos e abertura do primeiro ciclo.', status: 'done', priority_label: 'P1', impact_label: 'Alto', complexity_label: 'Alta', owner_label: 'Implantação', progress_percent: 100, badge_label: 'UX' },
  { version_label: 'v3.0.0', phase_label: 'Fase 4', category: 'ai', title: 'Motor preditivo de risco socioemocional', description: 'Modelo de risco por tendência, histórico e divergências, com recomendação proativa para gestão escolar e rede.', status: 'production', priority_label: 'P0', impact_label: 'Muito Alto', complexity_label: 'Alta', owner_label: 'IA', progress_percent: 100, badge_label: 'IA' }
];

function defaultCardMap() {
  return new Map(DEFAULT_CARDS.map((card) => [`${card.version_label}::${card.title}`, card]));
}

function mapCard(row) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    version_label: row.version_label,
    phase_label: row.phase_label,
    category: row.category,
    badge_label: row.badge_label,
    title: row.title,
    description: row.description,
    status: row.status,
    status_label: STATUS_LABELS[row.status] || row.status,
    priority_label: row.priority_label,
    impact_label: row.impact_label,
    complexity_label: row.complexity_label,
    owner_label: row.owner_label,
    progress_percent: Number(row.progress_percent || 0),
    sort_order: Number(row.sort_order || 0),
    meta_json: row.meta_json || {},
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function ensureRoadmapSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS roadmap_cards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      version_label TEXT NOT NULL,
      phase_label TEXT,
      category TEXT NOT NULL DEFAULT 'product',
      badge_label TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog','development','testing','approved','done','production')),
      priority_label TEXT,
      impact_label TEXT,
      complexity_label TEXT,
      owner_label TEXT,
      progress_percent INT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_roadmap_cards_tenant_status_order ON roadmap_cards(tenant_id, status, sort_order, created_at)`);
}

async function ensureSeeded(tenantId) {
  const existing = await query('SELECT COUNT(*)::int AS total FROM roadmap_cards WHERE tenant_id = $1', [tenantId]);
  if (Number(existing.rows[0]?.total || 0) > 0) return;
  const grouped = new Map(COLUMN_ORDER.map((status) => [status, []]));
  for (const card of DEFAULT_CARDS) grouped.get(card.status)?.push(card);

  for (const status of COLUMN_ORDER) {
    const ordered = (grouped.get(status) || []).slice().sort(status === 'backlog' ? roadmapSort : (a, b) => roadmapSort(a, b));
    for (const [index, card] of ordered.entries()) {
      await query(
        `INSERT INTO roadmap_cards (tenant_id, version_label, phase_label, category, badge_label, title, description, status, priority_label, impact_label, complexity_label, owner_label, progress_percent, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [tenantId, card.version_label, card.phase_label, card.category, card.badge_label, card.title, card.description, card.status, card.priority_label, card.impact_label, card.complexity_label, card.owner_label, card.progress_percent, index + 1]
      );
    }
  }
}

async function restoreDefaultStatusesIfNeeded(tenantId) {
  const rows = (await query(`SELECT id, version_label, title, status FROM roadmap_cards WHERE tenant_id = $1`, [tenantId])).rows;
  if (!rows.length) return;
  const allBacklog = rows.every((row) => row.status === 'backlog');
  if (!allBacklog) return;

  const defaults = defaultCardMap();
  const matches = rows.filter((row) => defaults.has(`${row.version_label}::${row.title}`));
  if (!matches.length) return;

  const buckets = new Map(COLUMN_ORDER.map((status) => [status, []]));
  for (const row of matches) {
    const fallback = defaults.get(`${row.version_label}::${row.title}`);
    buckets.get(fallback.status)?.push({ id: row.id, ...fallback });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const status of COLUMN_ORDER) {
      const ordered = (buckets.get(status) || []).sort(status === 'backlog' ? roadmapSort : roadmapSort);
      for (const [index, row] of ordered.entries()) {
        await client.query(
          `UPDATE roadmap_cards
             SET status = $2,
                 sort_order = $3,
                 updated_at = NOW()
           WHERE id = $1 AND tenant_id = $4`,
          [row.id, status, index + 1, tenantId]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function normalizeColumnOrders(tenantId) {
  const rows = (await query(`SELECT id, version_label, phase_label, title, status, created_at FROM roadmap_cards WHERE tenant_id = $1`, [tenantId])).rows;
  if (!rows.length) return;
  const grouped = new Map(COLUMN_ORDER.map((status) => [status, []]));
  for (const row of rows) {
    if (grouped.has(row.status)) grouped.get(row.status).push(row);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const status of COLUMN_ORDER) {
      const ordered = (grouped.get(status) || []).slice().sort(status === 'backlog'
        ? roadmapSort
        : (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
          || String(a.created_at || '').localeCompare(String(b.created_at || ''))
          || roadmapSort(a, b));
      for (const [index, row] of ordered.entries()) {
        await client.query(`UPDATE roadmap_cards SET sort_order = $2, updated_at = NOW() WHERE id = $1 AND tenant_id = $3`, [row.id, index + 1, tenantId]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function resolvePublicTenantId(slug) {
  if (slug) {
    const bySlug = await query(`SELECT id FROM tenants WHERE slug = $1 LIMIT 1`, [slug]);
    if (bySlug.rows[0]?.id) return bySlug.rows[0].id;
  }
  const fallback = await query(`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`);
  return fallback.rows[0]?.id || null;
}

function buildColumns(rows) {
  return COLUMN_ORDER.map((status) => {
    const items = rows.filter((row) => row.status === status).sort(status === 'backlog'
      ? roadmapSort
      : (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0)
        || String(a.created_at || '').localeCompare(String(b.created_at || ''))
        || roadmapSort(a, b));
    return { key: status, label: STATUS_LABELS[status], items };
  });
}

function buildSummary(rows) {
  return {
    total_cards: rows.length,
    phases: new Set(rows.map((row) => row.phase_label).filter(Boolean)).size,
    versions: [...new Set(rows.map((row) => row.version_label))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })),
    horizon_months: 12
  };
}

async function loadTenantRoadmap(tenantId) {
  await ensureRoadmapSchema();
  await ensureSeeded(tenantId);
  await restoreDefaultStatusesIfNeeded(tenantId);
  await normalizeColumnOrders(tenantId);
  const rows = (await query(`SELECT * FROM roadmap_cards WHERE tenant_id = $1 ORDER BY status, sort_order ASC, created_at ASC`, [tenantId])).rows.map(mapCard);
  return { columns: buildColumns(rows), summary: buildSummary(rows) };
}

export async function listRoadmap(req, res) {
  const payload = await loadTenantRoadmap(req.user.tenantId);
  res.json({ ...payload, can_edit: ['admin', 'coordinator'].includes(req.user.role) });
}

export async function listPublicRoadmap(req, res) {
  const tenantId = await resolvePublicTenantId(req.query?.tenant);
  if (!tenantId) {
    return res.json({ columns: buildColumns([]), summary: buildSummary([]), can_edit: false });
  }
  const payload = await loadTenantRoadmap(tenantId);
  res.json({ ...payload, can_edit: false });
}

export async function moveRoadmapCard(req, res) {
  await ensureRoadmapSchema();
  const { status, destinationIndex = 0 } = req.body || {};
  if (!COLUMN_ORDER.includes(status)) {
    return res.status(400).json({ error: 'Coluna de destino inválida.' });
  }

  const current = (await query(`SELECT * FROM roadmap_cards WHERE id = $1 AND tenant_id = $2 LIMIT 1`, [req.params.cardId, req.user.tenantId])).rows[0];
  if (!current) return res.status(404).json({ error: 'Card não encontrado.' });

  const siblings = (await query(`SELECT id, version_label, phase_label, title, sort_order, created_at FROM roadmap_cards WHERE tenant_id = $1 AND status = $2 AND id <> $3 ORDER BY sort_order ASC, created_at ASC`, [req.user.tenantId, status, req.params.cardId])).rows;
  const boundedIndex = Math.max(0, Math.min(Number(destinationIndex) || 0, siblings.length));
  const orderedItems = siblings.map((row) => ({ ...row }));
  orderedItems.splice(boundedIndex, 0, current);

  if (status === 'backlog') {
    orderedItems.sort(roadmapSort);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE roadmap_cards SET status = $2, updated_at = NOW() WHERE id = $1 AND tenant_id = $3`, [req.params.cardId, status, req.user.tenantId]);
    for (const [index, item] of orderedItems.entries()) {
      await client.query(`UPDATE roadmap_cards SET sort_order = $2, updated_at = NOW() WHERE id = $1 AND tenant_id = $3`, [item.id, index + 1, req.user.tenantId]);
    }
    if (current.status !== status) {
      const previous = (await client.query(`SELECT id, sort_order, created_at, version_label, phase_label, title FROM roadmap_cards WHERE tenant_id = $1 AND status = $2 AND id <> $3 ORDER BY sort_order ASC, created_at ASC`, [req.user.tenantId, current.status, req.params.cardId])).rows;
      for (const [index, item] of previous.entries()) {
        await client.query(`UPDATE roadmap_cards SET sort_order = $2, updated_at = NOW() WHERE id = $1 AND tenant_id = $3`, [item.id, index + 1, req.user.tenantId]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const updated = (await query(`SELECT * FROM roadmap_cards WHERE id = $1 LIMIT 1`, [req.params.cardId])).rows[0];
  res.json(mapCard(updated));
}
