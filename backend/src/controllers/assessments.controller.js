import { query } from '../db/index.js';
import { createAssessment, addRespondents, saveResponses, completeAssessment, getPublicRespondentByToken, savePublicResponsesByToken, getAssessmentComparison } from '../services/assessment.service.js';

export async function listAssessments(req, res) {
  const result = await query(`
    SELECT a.*, s.full_name AS student_name, c.title AS cycle_title,
      COUNT(r.id) AS respondents_total,
      COUNT(*) FILTER (WHERE r.status = 'completed') AS respondents_completed
    FROM assessments a
    INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
    LEFT JOIN assessment_cycles c ON c.id = a.cycle_id AND c.tenant_id = a.tenant_id
    LEFT JOIN respondents r ON r.assessment_id = a.id
    WHERE a.tenant_id = $1
    GROUP BY a.id, s.full_name, c.title
    ORDER BY a.created_at DESC
  `, [req.user.tenantId]);
  res.json(result.rows);
}

export async function createAssessmentHandler(req, res) {
  const created = await createAssessment(req.body, req.user.tenantId);
  res.status(201).json(created);
}

export async function getAssessment(req, res) {
  const result = await query(`
    SELECT a.*, s.full_name AS student_name, c.title AS cycle_title,
      COUNT(r.id) AS respondents_total,
      COUNT(*) FILTER (WHERE r.status = 'completed') AS respondents_completed
    FROM assessments a
    INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
    LEFT JOIN assessment_cycles c ON c.id = a.cycle_id AND c.tenant_id = a.tenant_id
    LEFT JOIN respondents r ON r.assessment_id = a.id
    WHERE a.id = $1 AND a.tenant_id = $2
    GROUP BY a.id, s.full_name, c.title
  `, [req.params.id, req.user.tenantId]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  res.json(result.rows[0]);
}

export async function updateAssessment(req, res) {
  const { notes, method_name, cycle_id, status } = req.body;
  const result = await query(`
    UPDATE assessments
    SET
      notes = COALESCE($3, notes),
      method_name = COALESCE($4, method_name),
      cycle_id = COALESCE($5, cycle_id),
      status = COALESCE($6, status),
      updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [req.params.id, req.user.tenantId, notes, method_name, cycle_id, status]);

  if (!result.rows[0]) return res.status(404).json({ error: 'Avaliação não encontrada.' });
  res.json(result.rows[0]);
}

export async function addRespondentsHandler(req, res) {
  const created = await addRespondents(req.params.id, req.body.respondents || [], req.user.tenantId);
  res.status(201).json(created);
}

export async function saveResponsesHandler(req, res) {
  await saveResponses(req.params.id, req.body.answers || [], req.user.tenantId);
  res.json({ success: true });
}

export async function completeAssessmentHandler(req, res) {
  const result = await completeAssessment(req.params.id, req.user.tenantId);
  res.json(result);
}


export async function getAssessmentRespondents(req, res) {
  const result = await query(
    `SELECT r.*, CONCAT('/responder.html?token=', r.respondent_token) AS respond_url
     FROM respondents r
     INNER JOIN assessments a ON a.id = r.assessment_id
     WHERE r.assessment_id = $1 AND a.tenant_id = $2
     ORDER BY r.created_at ASC`,
    [req.params.id, req.user.tenantId]
  );
  res.json(result.rows);
}

export async function getPublicRespondent(req, res) {
  const respondent = await getPublicRespondentByToken(req.params.token);
  if (!respondent) return res.status(404).json({ error: 'Link de resposta não encontrado.' });
  const questions = await query('SELECT * FROM questions WHERE is_active = TRUE ORDER BY dimension, sort_order, id');
  res.json({ respondent, questions: questions.rows });
}

export async function savePublicRespondentResponses(req, res) {
  const result = await savePublicResponsesByToken(req.params.token, req.body.answers || []);
  res.json(result);
}


export async function getAssessmentComparisonHandler(req, res) {
  const result = await getAssessmentComparison(req.params.id, req.user.tenantId);
  res.json(result);
}
