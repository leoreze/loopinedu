import { query, getClient } from '../db/index.js';
import crypto from 'crypto';
import { calculateAssessmentScores } from './scoring.service.js';
import { interpretAssessment } from './ai.service.js';
import { query as dbQuery } from '../db/index.js';
import { tenantHasFeature } from '../config/plans.js';

export async function createAssessment(data, tenantId) {
  const studentResult = await query('SELECT id FROM students WHERE id = $1 AND tenant_id = $2', [data.student_id, tenantId]);
  if (!studentResult.rows[0]) {
    throw new Error('Estudante não encontrado neste ambiente.');
  }

  if (data.cycle_id) {
    const cycleResult = await query('SELECT id FROM assessment_cycles WHERE id = $1 AND tenant_id = $2', [data.cycle_id, tenantId]);
    if (!cycleResult.rows[0]) {
      throw new Error('Ciclo não encontrado neste ambiente.');
    }
  }

  const result = await query(
    `
      INSERT INTO assessments (student_id, cycle_id, method_name, notes, status, tenant_id)
      VALUES ($1, $2, COALESCE($3, 'C.O.R.E. 360'), $4, 'draft', $5)
      RETURNING *
    `,
    [data.student_id, data.cycle_id || null, data.method_name || 'C.O.R.E. 360', data.notes || null, tenantId]
  );

  return result.rows[0];
}

export async function addRespondents(assessmentId, respondents = [], tenantId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const assessment = (await client.query('SELECT id FROM assessments WHERE id = $1 AND tenant_id = $2', [assessmentId, tenantId])).rows[0];
    if (!assessment) throw new Error('Avaliação não encontrada neste ambiente.');

    const created = [];
    for (const respondent of respondents) {
      const respondentToken = crypto.randomBytes(18).toString('hex');
      const result = await client.query(
        `
          INSERT INTO respondents (assessment_id, respondent_type, respondent_name, respondent_email, respondent_token, status)
          VALUES ($1, $2, $3, $4, $5, 'pending')
          RETURNING *
        `,
        [assessmentId, respondent.respondent_type, respondent.respondent_name || null, respondent.respondent_email || null, respondentToken]
      );
      created.push(result.rows[0]);
    }
    await client.query(`UPDATE assessments SET status = 'collecting', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [assessmentId, tenantId]);
    await client.query('COMMIT');
    return created;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function saveResponses(respondentId, answers = [], tenantId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const respondent = (await client.query(
      `SELECT r.id
       FROM respondents r
       INNER JOIN assessments a ON a.id = r.assessment_id
       WHERE r.id = $1 AND a.tenant_id = $2`,
      [respondentId, tenantId]
    )).rows[0];
    if (!respondent) throw new Error('Respondente não encontrado neste ambiente.');

    await client.query('DELETE FROM responses WHERE respondent_id = $1', [respondentId]);

    for (const answer of answers) {
      await client.query(
        `
          INSERT INTO responses (respondent_id, question_id, score, comment)
          VALUES ($1, $2, $3, $4)
        `,
        [respondentId, answer.question_id, answer.score, answer.comment || null]
      );
    }

    await client.query(`UPDATE respondents SET status = 'completed' WHERE id = $1`, [respondentId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function completeAssessment(assessmentId, tenantId) {
  await query(`UPDATE assessments SET status = 'scoring', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [assessmentId, tenantId]);
  const scores = await calculateAssessmentScores(assessmentId, tenantId);
  await query(
    `
      UPDATE assessments
      SET
        overall_score = $3,
        overall_band = $4,
        cognitive_score = $5,
        organization_score = $6,
        relational_score = $7,
        emotional_score = $8,
        status = 'processing_ai',
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `,
    [
      assessmentId,
      tenantId,
      scores.overall_score,
      scores.overall_band,
      scores.cognitive_score,
      scores.organization_score,
      scores.relational_score,
      scores.emotional_score
    ]
  );

  const result = await query(
    `
      SELECT
        a.*,
        s.full_name AS student_name,
        s.grade_level,
        s.class_name,
        s.school_name,
        c.title AS cycle_title
      FROM assessments a
      INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
      LEFT JOIN assessment_cycles c ON c.id = a.cycle_id AND c.tenant_id = a.tenant_id
      WHERE a.id = $1 AND a.tenant_id = $2
    `,
    [assessmentId, tenantId]
  );

  const row = result.rows[0];
  const payload = {
    student: {
      full_name: row.student_name,
      grade_level: row.grade_level,
      class_name: row.class_name,
      school_name: row.school_name
    },
    assessment: {
      method: row.method_name,
      cycle: row.cycle_title || 'Ciclo aberto',
      notes: row.notes || ''
    },
    scores: {
      overall: Number(row.overall_score),
      cognitive: Number(row.cognitive_score),
      organization: Number(row.organization_score),
      relational: Number(row.relational_score),
      emotional: Number(row.emotional_score)
    }
  };

  const tenant = (await dbQuery('SELECT plan FROM tenants WHERE id = $1', [tenantId])).rows[0];
  const ai = tenantHasFeature(tenant, 'ai_complete')
    ? await interpretAssessment(payload)
    : {
        summary: 'Resumo institucional disponível no plano Pro ou Premium. Faça upgrade para liberar leitura estratégica completa por IA.',
        strengths: ['Diagnóstico consolidado com scoring disponível.'],
        risks: ['Leitura avançada por IA bloqueada no plano atual.'],
        actionPlan: ['Acesse Billing para ativar um plano com IA completa.']
      };

  await query(
    `
      UPDATE assessments
      SET
        ai_summary = $3,
        strengths = $4::jsonb,
        risks = $5::jsonb,
        action_plan = $6::jsonb,
        status = 'completed',
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `,
    [assessmentId, tenantId, ai.summary, JSON.stringify(ai.strengths), JSON.stringify(ai.risks), JSON.stringify(ai.actionPlan)]
  );

  return { ...payload, ...ai };
}


export async function getPublicRespondentByToken(token) {
  const result = await query(
    `SELECT
      r.id,
      r.respondent_type,
      r.respondent_name,
      r.respondent_email,
      r.status,
      r.respondent_token,
      a.id AS assessment_id,
      a.status AS assessment_status,
      a.method_name,
      a.notes,
      s.full_name AS student_name,
      s.grade_level,
      s.class_name,
      s.school_name,
      c.title AS cycle_title,
      t.name AS tenant_name,
      t.primary_color
     FROM respondents r
     INNER JOIN assessments a ON a.id = r.assessment_id
     INNER JOIN students s ON s.id = a.student_id
     LEFT JOIN assessment_cycles c ON c.id = a.cycle_id
     LEFT JOIN tenants t ON t.id = a.tenant_id
     WHERE r.respondent_token = $1
     LIMIT 1`,
    [token]
  );
  return result.rows[0] || null;
}

export async function savePublicResponsesByToken(token, answers = []) {
  const respondent = await getPublicRespondentByToken(token);
  if (!respondent) throw new Error('Link de respondente inválido ou expirado.');
  if (respondent.assessment_status === 'completed') throw new Error('Esta avaliação já foi concluída.');

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM responses WHERE respondent_id = $1', [respondent.id]);
    for (const answer of answers) {
      await client.query(
        `INSERT INTO responses (respondent_id, question_id, score, comment)
         VALUES ($1, $2, $3, $4)`,
        [respondent.id, answer.question_id, answer.score, answer.comment || null]
      );
    }
    await client.query(`UPDATE respondents SET status = 'completed' WHERE id = $1`, [respondent.id]);
    await client.query('COMMIT');
    return { success: true, respondent_id: respondent.id, assessment_id: respondent.assessment_id };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


export async function getAssessmentComparison(assessmentId, tenantId) {
  const respondentAverages = await query(`SELECT r.respondent_type, q.dimension, ROUND(AVG(resp.score)::numeric, 2) AS average_score FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id INNER JOIN responses resp ON resp.respondent_id = r.id INNER JOIN questions q ON q.id = resp.question_id WHERE r.assessment_id = $1 AND a.tenant_id = $2 GROUP BY r.respondent_type, q.dimension ORDER BY r.respondent_type, q.dimension`, [assessmentId, tenantId]);
  const comments = await query(`SELECT r.respondent_type, q.dimension, resp.comment FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id INNER JOIN responses resp ON resp.respondent_id = r.id INNER JOIN questions q ON q.id = resp.question_id WHERE r.assessment_id = $1 AND a.tenant_id = $2 AND COALESCE(NULLIF(TRIM(resp.comment), ''), '') <> '' ORDER BY r.respondent_type, q.dimension, resp.created_at DESC`, [assessmentId, tenantId]);
  return { by_dimension: respondentAverages.rows, comments: comments.rows.slice(0, 12) };
}
