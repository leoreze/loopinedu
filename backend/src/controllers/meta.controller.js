import { rolePermissions } from '../config/permissions.js';
import { query } from '../db/index.js';

export async function getQuestions(req, res) {
  const result = await query('SELECT * FROM questions WHERE is_active = TRUE ORDER BY dimension, sort_order, id');
  res.json(result.rows);
}

export async function getMethod(req, res) {
  res.json({
    name: 'C.O.R.E. 360',
    dimensions: ['cognitive', 'organization', 'relational', 'emotional'],
    weights: {
      student: 0.25,
      teacher: 0.35,
      guardian: 0.25,
      institutional: 0.15
    },
    roles: rolePermissions,
    pdf_structure: [
      'Página 1: logo, estudante, escola, ciclo, score geral e faixa',
      'Página 2: scores por dimensão e visão executiva',
      'Página 3: pontos fortes, riscos e plano de ação',
      'Página 4: histórico, recomendações finais e data da emissão'
    ],
    roadmap: {
      v1: ['cadastro de estudante', 'perguntas fixas', 'respostas', 'score', 'leitura IA', 'resultado', 'PDF'],
      v1_1: ['login', 'dashboard institucional', 'filtros por turma/série', 'histórico por ciclo'],
      v1_2: ['envio de link para respondentes', 'coleta assíncrona por perfil', 'comparativo entre respondentes'],
      v2: ['benchmarking por turma', 'alertas automáticos', 'trilhas pedagógicas sugeridas por IA', 'devolutiva para família']
    }
  });
}


export async function createLead(req, res) {
  const { full_name, email, school_name, whatsapp, role_label, school_size, interest_plan, notes } = req.body;
  if (!full_name || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
  const result = await query(
    `INSERT INTO leads (full_name, email, school_name, whatsapp, role_label, school_size, interest_plan, notes, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'landing') RETURNING *`,
    [full_name, email, school_name || null, whatsapp || null, role_label || null, school_size || null, interest_plan || null, notes || null]
  );
  res.status(201).json({ success: true, lead: result.rows[0] });
}
