import { query } from '../db/index.js';

export async function getOverview(req, res) {
  const tenantId = req.user.tenantId;
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM students WHERE tenant_id = $1) AS total_students,
      (SELECT COUNT(*) FROM assessments WHERE tenant_id = $1 AND status = 'completed') AS completed_assessments,
      (SELECT COALESCE(ROUND(AVG(overall_score)::numeric, 2), 0) FROM assessments WHERE tenant_id = $1 AND overall_score IS NOT NULL) AS average_overall_score,
      (SELECT COUNT(*) FROM assessments WHERE tenant_id = $1 AND emotional_score < 3) AS emotional_alerts,
      (SELECT COUNT(*) FROM assessments WHERE tenant_id = $1 AND organization_score < 3) AS organization_alerts,
      (SELECT COALESCE(ROUND(AVG(cognitive_score)::numeric, 2), 0) FROM assessments WHERE tenant_id = $1 AND cognitive_score IS NOT NULL) AS avg_cognitive,
      (SELECT COALESCE(ROUND(AVG(organization_score)::numeric, 2), 0) FROM assessments WHERE tenant_id = $1 AND organization_score IS NOT NULL) AS avg_organization,
      (SELECT COALESCE(ROUND(AVG(relational_score)::numeric, 2), 0) FROM assessments WHERE tenant_id = $1 AND relational_score IS NOT NULL) AS avg_relational,
      (SELECT COALESCE(ROUND(AVG(emotional_score)::numeric, 2), 0) FROM assessments WHERE tenant_id = $1 AND emotional_score IS NOT NULL) AS avg_emotional
  `, [tenantId]);

  const data = result.rows[0];
  const dimensions = [
    ['cognitive', Number(data.avg_cognitive)],
    ['organization', Number(data.avg_organization)],
    ['relational', Number(data.avg_relational)],
    ['emotional', Number(data.avg_emotional)]
  ].sort((a, b) => a[1] - b[1]);

  res.json({
    ...data,
    critical_dimension: dimensions[0]?.[0] || null,
    strongest_dimension: dimensions[dimensions.length - 1]?.[0] || null,
    alerts: [
      `${data.emotional_alerts} estudantes com emocional abaixo de 3.0.`,
      `${data.organization_alerts} estudantes com organização abaixo de 3.0.`
    ],
    tenant: req.tenant
  });
}

export async function getByClass(req, res) {
  const result = await query(`
    SELECT s.class_name, COUNT(a.id) AS total_assessments, COALESCE(ROUND(AVG(a.overall_score)::numeric, 2), 0) AS average_score
    FROM students s
    LEFT JOIN assessments a ON a.student_id = s.id AND a.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1
    GROUP BY s.class_name
    ORDER BY s.class_name ASC NULLS LAST
  `, [req.user.tenantId]);
  res.json(result.rows);
}

export async function getByGrade(req, res) {
  const result = await query(`
    SELECT s.grade_level, COUNT(a.id) AS total_assessments, COALESCE(ROUND(AVG(a.overall_score)::numeric, 2), 0) AS average_score
    FROM students s
    LEFT JOIN assessments a ON a.student_id = s.id AND a.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1
    GROUP BY s.grade_level
    ORDER BY s.grade_level ASC NULLS LAST
  `, [req.user.tenantId]);
  res.json(result.rows);
}

export async function getAlerts(req, res) {
  const result = await query(`
    SELECT a.id, s.full_name, a.emotional_score, a.organization_score
    FROM assessments a
    INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id
    WHERE a.tenant_id = $1 AND a.status = 'completed' AND (a.emotional_score < 3 OR a.organization_score < 3)
    ORDER BY a.updated_at DESC
  `, [req.user.tenantId]);
  res.json(result.rows);
}


export async function getPremiumInsights(req, res) {
  const tenantId = req.user.tenantId;
  const [completion, risk, classes, divergence, trends] = await Promise.all([
    query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE r.status = 'completed') AS completed FROM respondents r INNER JOIN assessments a ON a.id = r.assessment_id WHERE a.tenant_id = $1`, [tenantId]),
    query(`SELECT s.full_name, a.overall_score, a.overall_band, a.emotional_score, a.organization_score FROM assessments a INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id WHERE a.tenant_id = $1 AND a.status = 'completed' ORDER BY a.overall_score ASC NULLS LAST LIMIT 5`, [tenantId]),
    query(`SELECT COALESCE(s.class_name, 'Sem turma') AS class_name, COUNT(a.id) AS total, COALESCE(ROUND(AVG(a.overall_score)::numeric, 2), 0) AS average_score FROM students s LEFT JOIN assessments a ON a.student_id = s.id AND a.tenant_id = s.tenant_id AND a.status = 'completed' WHERE s.tenant_id = $1 GROUP BY COALESCE(s.class_name, 'Sem turma') ORDER BY average_score DESC, total DESC LIMIT 5`, [tenantId]),
    query(`SELECT a.id, s.full_name, ROUND(COALESCE(MAX(p.avg_score) - MIN(p.avg_score), 0)::numeric, 2) AS divergence FROM (SELECT r.assessment_id, r.respondent_type, AVG(resp.score)::numeric(5,2) AS avg_score FROM respondents r INNER JOIN responses resp ON resp.respondent_id = r.id INNER JOIN assessments ax ON ax.id = r.assessment_id WHERE ax.tenant_id = $1 GROUP BY r.assessment_id, r.respondent_type) p INNER JOIN assessments a ON a.id = p.assessment_id INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id GROUP BY a.id, s.full_name ORDER BY divergence DESC, s.full_name ASC LIMIT 5`, [tenantId]),
    query(`SELECT COALESCE(c.title, TO_CHAR(a.created_at, 'Mon/YYYY')) AS label, COALESCE(ROUND(AVG(a.overall_score)::numeric, 2),0) AS average_score, COUNT(*)::int AS total FROM assessments a LEFT JOIN assessment_cycles c ON c.id = a.cycle_id AND c.tenant_id = a.tenant_id WHERE a.tenant_id = $1 AND a.status='completed' GROUP BY COALESCE(c.title, TO_CHAR(a.created_at, 'Mon/YYYY')), COALESCE(c.start_date, DATE_TRUNC('month', a.created_at)) ORDER BY COALESCE(c.start_date, DATE_TRUNC('month', a.created_at)) DESC LIMIT 6`, [tenantId])
  ]);
  const total = Number(completion.rows[0]?.total || 0);
  const completed = Number(completion.rows[0]?.completed || 0);
  res.json({ respondent_completion_rate: total ? Number(((completed / total) * 100).toFixed(1)) : 0, priority_students: risk.rows, strongest_classes: classes.rows, divergence_alerts: divergence.rows, cycle_trends: trends.rows.reverse() });
}

export async function getAssessmentTrends(req, res) {
  const tenantId = req.user.tenantId;
  const result = await query(`SELECT COALESCE(c.title, TO_CHAR(a.created_at, 'Mon/YYYY')) AS label, COALESCE(ROUND(AVG(a.overall_score)::numeric, 2),0) AS average_score, COALESCE(ROUND(AVG(a.cognitive_score)::numeric, 2),0) AS cognitive_score, COALESCE(ROUND(AVG(a.organization_score)::numeric, 2),0) AS organization_score, COALESCE(ROUND(AVG(a.relational_score)::numeric, 2),0) AS relational_score, COALESCE(ROUND(AVG(a.emotional_score)::numeric, 2),0) AS emotional_score, COUNT(*)::int AS total FROM assessments a LEFT JOIN assessment_cycles c ON c.id = a.cycle_id AND c.tenant_id = a.tenant_id WHERE a.tenant_id = $1 AND a.status='completed' GROUP BY COALESCE(c.title, TO_CHAR(a.created_at, 'Mon/YYYY')), COALESCE(c.start_date, DATE_TRUNC('month', a.created_at)) ORDER BY COALESCE(c.start_date, DATE_TRUNC('month', a.created_at)) DESC LIMIT 12`, [tenantId]);
  res.json(result.rows.reverse());
}
