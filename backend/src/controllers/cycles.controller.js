import { query } from '../db/index.js';

export async function listCycles(req, res) {
  const result = await query(`
    SELECT
      c.*,
      COUNT(DISTINCT a.id) AS assessments_count,
      COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed_count
    FROM assessment_cycles c
    LEFT JOIN assessments a ON a.cycle_id = c.id AND a.tenant_id = c.tenant_id
    WHERE c.tenant_id = $1
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `, [req.user.tenantId]);
  res.json(result.rows);
}

export async function createCycle(req, res) {
  const { title, school_name, start_date, end_date, status } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ error: 'Título do ciclo é obrigatório.' });
  }

  const result = await query(
    `
      INSERT INTO assessment_cycles (title, school_name, start_date, end_date, status, tenant_id)
      VALUES ($1, $2, $3, $4, COALESCE($5, 'draft'), $6)
      RETURNING *
    `,
    [title.trim(), school_name || null, start_date || null, end_date || null, status || 'draft', req.user.tenantId]
  );

  res.status(201).json(result.rows[0]);
}

export async function getCycle(req, res) {
  const result = await query('SELECT * FROM assessment_cycles WHERE id = $1 AND tenant_id = $2', [req.params.id, req.user.tenantId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Ciclo não encontrado.' });
  res.json(result.rows[0]);
}

export async function updateCycle(req, res) {
  const { title, school_name, start_date, end_date, status } = req.body;
  const result = await query(
    `
      UPDATE assessment_cycles
      SET
        title = COALESCE($3, title),
        school_name = COALESCE($4, school_name),
        start_date = COALESCE($5, start_date),
        end_date = COALESCE($6, end_date),
        status = COALESCE($7, status)
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
    [req.params.id, req.user.tenantId, title?.trim() || null, school_name || null, start_date || null, end_date || null, status || null]
  );

  if (!result.rows[0]) return res.status(404).json({ error: 'Ciclo não encontrado.' });
  res.json(result.rows[0]);
}
