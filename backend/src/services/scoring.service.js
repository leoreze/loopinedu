import { query } from '../db/index.js';

const WEIGHTS = {
  student: 0.25,
  teacher: 0.35,
  guardian: 0.25,
  institutional: 0.15
};

function calculateBand(score) {
  const value = Number(score || 0);
  if (value <= 2) return 'Crítico';
  if (value <= 3) return 'Atenção';
  if (value <= 4) return 'Estável';
  return 'Destaque';
}

export async function calculateAssessmentScores(assessmentId, tenantId) {
  const result = await query(
    `
      SELECT q.dimension, r2.respondent_type, r.score
      FROM responses r
      INNER JOIN respondents r2 ON r2.id = r.respondent_id
      INNER JOIN assessments a ON a.id = r2.assessment_id
      INNER JOIN questions q ON q.id = r.question_id
      WHERE r2.assessment_id = $1 AND a.tenant_id = $2
    `,
    [assessmentId, tenantId]
  );

  const buckets = {
    cognitive: [],
    organization: [],
    relational: [],
    emotional: []
  };

  for (const row of result.rows) {
    buckets[row.dimension]?.push({
      score: Number(row.score),
      respondent_type: row.respondent_type
    });
  }

  function averageWeighted(items) {
    if (!items.length) return 0;
    let total = 0;
    let weightSum = 0;
    for (const item of items) {
      const weight = WEIGHTS[item.respondent_type] || 0;
      total += Number(item.score || 0) * weight;
      weightSum += weight;
    }
    return weightSum ? Number((total / weightSum).toFixed(2)) : 0;
  }

  const cognitive = averageWeighted(buckets.cognitive);
  const organization = averageWeighted(buckets.organization);
  const relational = averageWeighted(buckets.relational);
  const emotional = averageWeighted(buckets.emotional);
  const overall = Number((((cognitive + organization + relational + emotional) / 4) || 0).toFixed(2));

  return {
    cognitive_score: cognitive,
    organization_score: organization,
    relational_score: relational,
    emotional_score: emotional,
    overall_score: overall,
    overall_band: calculateBand(overall)
  };
}
