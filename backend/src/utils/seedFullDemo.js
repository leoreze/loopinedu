import bcrypt from 'bcryptjs';
import { query, pool } from '../db/index.js';
import { env } from '../config/env.js';
import { questionsSeed } from './questions.seed.js';
import { seedDefaultAdmin } from '../controllers/auth.controller.js';
import { calculateAssessmentScores } from '../services/scoring.service.js';

const DEMO_USER_PASSWORD = '123456';
const SCHOOL_NAME = env.defaultTenantName;
const SOURCE_TAG = '[SEED_DEMO_LOOPINEDU_V1_4_7]';
const DEMO_GUARDIAN_DOMAIN = '@familia.loopinedu.demo';
const DEMO_TEAM_DOMAIN = '@loopinedu.demo';

const cycleSeed = [
  ['Diagnóstico Inicial 2025', '2025-02-03', '2025-03-28', 'closed'],
  ['Fechamento 2025', '2025-09-01', '2025-11-28', 'closed'],
  ['1º Semestre 2026', '2026-02-02', '2026-04-30', 'closed'],
  ['2º Semestre 2026', '2026-08-03', '2026-10-30', 'active']
];

const teamSeed = [
  ['Coordenadora Pedagógica', 'coordinator', 'Luciana Prado', 'luciana.prado@loopinedu.demo'],
  ['Especialista Socioemocional', 'specialist', 'Renata Campos', 'renata.campos@loopinedu.demo'],
  ['Professor Regente 3º Ano', 'teacher', 'Carlos Menezes', 'carlos.menezes@loopinedu.demo'],
  ['Professor Regente 4º Ano', 'teacher', 'Marina Lopes', 'marina.lopes@loopinedu.demo'],
  ['Professor Regente 5º Ano', 'teacher', 'Felipe Andrade', 'felipe.andrade@loopinedu.demo'],
  ['Professor Regente 6º Ano', 'teacher', 'Paula Ribeiro', 'paula.ribeiro@loopinedu.demo'],
  ['Professor Regente 7º Ano', 'teacher', 'Gustavo Nery', 'gustavo.nery@loopinedu.demo']
];

const leadsSeed = [
  ['Vanessa Almeida', 'vanessa.almeida@colegioestrela.com', 'Colégio Estrela do Saber', '16991230001', 'Diretora', '300-600 alunos', 'premium'],
  ['Rodrigo Martins', 'rodrigo.martins@institutofuturo.com', 'Instituto Futuro', '16991230002', 'Coordenador', '100-300 alunos', 'pro'],
  ['Fernanda Costa', 'fernanda.costa@escolacrescer.com', 'Escola Crescer Mais', '16991230003', 'Mantenedora', 'até 100 alunos', 'essencial'],
  ['Bruna Teixeira', 'bruna.teixeira@colegiointegrado.com', 'Colégio Integrado', '16991230004', 'Psicopedagoga', '300-600 alunos', 'premium'],
  ['Marcelo Dantas', 'marcelo.dantas@educarmais.com', 'Rede Educar Mais', '16991230005', 'Gestor', '600+ alunos', 'premium']
];

const firstNames = ['Ana', 'Lucas', 'Pedro', 'Isabela', 'Gabriel', 'Sophia', 'Matheus', 'Larissa', 'João', 'Emily', 'Miguel', 'Helena', 'Arthur', 'Manuela', 'Davi', 'Valentina', 'Rafael', 'Laura', 'Enzo', 'Alice', 'Caio', 'Maria', 'Yasmin', 'Guilherme', 'Beatriz', 'Henrique', 'Lívia', 'Vinícius', 'Mariana', 'Thiago'];
const middleNames = ['Beatriz', 'Henrique', 'Lucas', 'Clara', 'Martins', 'Fernandes', 'Oliveira', 'Gomes', 'Victor', 'Duarte', 'Santos', 'Moura', 'Nogueira', 'Teixeira', 'Araújo', 'Pires', 'Correia', 'Almeida', 'Gabriel', 'Rezende', 'Augusto', 'Tavares', 'Cardoso', 'Azevedo', 'Rocha', 'Barbosa', 'Freitas', 'Lopes', 'Cunha', 'Castro'];
const lastNames = ['Souza', 'Almeida', 'Ribeiro', 'Santos', 'Oliveira', 'Costa', 'Lima', 'Pereira', 'Barbosa', 'Freitas', 'Rocha', 'Castro', 'Silva', 'Melo', 'Araújo', 'Moreira', 'Pinto', 'Braga', 'Farias', 'Lopes', 'Mendes', 'Tavares', 'Leal', 'Cunha', 'Teixeira', 'Nery', 'Campos', 'Prado', 'Andrade', 'Vieira'];
const guardianFirstNames = ['Mariana', 'Carlos', 'Patrícia', 'Ricardo', 'Fernanda', 'Juliana', 'Eduardo', 'Renata', 'André', 'Camila', 'Vanessa', 'Cristiane', 'Luciana', 'Paulo', 'Beatriz', 'Aline', 'Simone', 'Márcio', 'Daniela', 'Júlio', 'Roberta', 'Henrique', 'Flávia', 'Tatiane', 'Bruno', 'Carolina', 'Sérgio', 'Priscila'];
const grades = ['3º Ano', '4º Ano', '5º Ano', '6º Ano', '7º Ano'];
const classes = ['A', 'B', 'C', 'D'];
const profilePool = [
  ...Array(15).fill('critical'),
  ...Array(20).fill('recovering'),
  ...Array(40).fill('stable'),
  ...Array(15).fill('oscillating'),
  ...Array(10).fill('highlight')
];

function slugify(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toSqlTimestamp(value) {
  if (!value) return new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
  const asDate = new Date(value);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.toISOString().slice(0, 19).replace('T', ' ');
  }
  const normalized = String(value).trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return `${normalized} 12:00:00`;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) return normalized;
  throw new Error(`Data inválida para timestamp SQL: ${value}`);
}

function buildStudentsSeed() {
  const students = [];
  let seq = 0;

  for (const grade of grades) {
    for (const className of classes) {
      for (let slot = 0; slot < 5; slot += 1) {
        const first = firstNames[seq % firstNames.length];
        const middle = middleNames[(seq * 3 + 5) % middleNames.length];
        const last = lastNames[(seq * 5 + 7) % lastNames.length];
        const fullName = `${first} ${middle} ${last}`;
        const guardianName = `${guardianFirstNames[(seq * 7 + 3) % guardianFirstNames.length]} ${last}`;
        const email = `${slugify(guardianName)}.${seq + 1}${DEMO_GUARDIAN_DOMAIN}`;
        const year = 2016 - grades.indexOf(grade);
        const month = String(((seq % 12) + 1)).padStart(2, '0');
        const day = String((((seq * 3) % 27) + 1)).padStart(2, '0');
        const birthDate = `${year}-${month}-${day}`;
        const profile = profilePool[seq % profilePool.length];
        students.push([fullName, birthDate, grade, className, guardianName, email, profile, seq]);
        seq += 1;
      }
    }
  }

  return students.slice(0, 100);
}

const studentsSeed = buildStudentsSeed();

function pickTeacherByGrade(usersMap, gradeLevel) {
  if (gradeLevel.startsWith('3')) return usersMap.get('carlos.menezes@loopinedu.demo');
  if (gradeLevel.startsWith('4')) return usersMap.get('marina.lopes@loopinedu.demo');
  if (gradeLevel.startsWith('5')) return usersMap.get('felipe.andrade@loopinedu.demo');
  if (gradeLevel.startsWith('6')) return usersMap.get('paula.ribeiro@loopinedu.demo');
  return usersMap.get('gustavo.nery@loopinedu.demo');
}

function getProfileTargets(profile, cycleIndex) {
  const profiles = {
    critical: [
      { cognitive: 2.2, organization: 2.0, relational: 2.3, emotional: 1.9 },
      { cognitive: 2.4, organization: 2.2, relational: 2.5, emotional: 2.1 },
      { cognitive: 2.6, organization: 2.4, relational: 2.6, emotional: 2.3 },
      { cognitive: 2.7, organization: 2.5, relational: 2.7, emotional: 2.4 }
    ],
    recovering: [
      { cognitive: 2.7, organization: 2.5, relational: 2.9, emotional: 2.6 },
      { cognitive: 3.0, organization: 2.9, relational: 3.1, emotional: 2.9 },
      { cognitive: 3.3, organization: 3.2, relational: 3.4, emotional: 3.2 },
      { cognitive: 3.6, organization: 3.5, relational: 3.6, emotional: 3.5 }
    ],
    stable: [
      { cognitive: 3.4, organization: 3.3, relational: 3.5, emotional: 3.3 },
      { cognitive: 3.6, organization: 3.5, relational: 3.7, emotional: 3.5 },
      { cognitive: 3.8, organization: 3.7, relational: 3.9, emotional: 3.7 },
      { cognitive: 3.9, organization: 3.8, relational: 4.0, emotional: 3.8 }
    ],
    oscillating: [
      { cognitive: 3.7, organization: 2.9, relational: 3.9, emotional: 2.8 },
      { cognitive: 3.2, organization: 3.7, relational: 3.1, emotional: 3.5 },
      { cognitive: 3.9, organization: 3.1, relational: 4.0, emotional: 3.0 },
      { cognitive: 3.5, organization: 3.8, relational: 3.4, emotional: 3.7 }
    ],
    highlight: [
      { cognitive: 4.2, organization: 4.0, relational: 4.3, emotional: 4.1 },
      { cognitive: 4.4, organization: 4.2, relational: 4.5, emotional: 4.3 },
      { cognitive: 4.6, organization: 4.4, relational: 4.7, emotional: 4.5 },
      { cognitive: 4.8, organization: 4.6, relational: 4.8, emotional: 4.7 }
    ]
  };

  return profiles[profile]?.[cycleIndex] || profiles.stable[cycleIndex];
}

function respondentBias(profile, respondentType, dimension) {
  const baseBias = {
    student: -0.1,
    teacher: 0.05,
    guardian: 0.0,
    institutional: 0.1
  };

  let extra = 0;
  if (profile === 'critical' && respondentType === 'student' && dimension === 'emotional') extra = -0.25;
  if (profile === 'recovering' && respondentType === 'guardian' && dimension === 'organization') extra = 0.15;
  if (profile === 'oscillating' && respondentType === 'guardian') extra = 0.25;
  if (profile === 'oscillating' && respondentType === 'teacher') extra = -0.15;
  if (profile === 'highlight' && respondentType === 'institutional') extra = 0.2;
  return (baseBias[respondentType] || 0) + extra;
}

function buildAiBlocks(profile, scores) {
  const dims = [
    ['cognitivo', Number(scores.cognitive_score)],
    ['organização', Number(scores.organization_score)],
    ['relacional', Number(scores.relational_score)],
    ['emocional', Number(scores.emotional_score)]
  ].sort((a, b) => b[1] - a[1]);

  const strongest = dims[0][0];
  const weakest = dims[dims.length - 1][0];
  const byProfile = {
    critical: 'Estudante com sinais de atenção prioritária, exigindo mediação contínua e rotinas mais estruturadas.',
    recovering: 'Estudante em evolução progressiva, com sinais consistentes de recuperação ao longo dos ciclos.',
    stable: 'Estudante com desempenho socioemocional estável e boa capacidade de adaptação escolar.',
    oscillating: 'Estudante com comportamento oscilante entre ciclos e necessidade de acompanhamento preventivo.',
    highlight: 'Estudante com indicadores de destaque e potencial para protagonismo acadêmico e relacional.'
  };

  return {
    summary: `${byProfile[profile]} O ponto mais forte atual é o eixo ${strongest}, enquanto o eixo ${weakest} merece mais atenção pedagógica.`,
    strengths: [
      `Boa leitura do eixo ${strongest} em comparação aos demais indicadores.`,
      'Dados 360º suficientes para orientar decisões pedagógicas com mais segurança.',
      'Participação dos diferentes respondentes gerando visão institucional mais completa.'
    ],
    risks: [
      `Manter atenção ao eixo ${weakest} para evitar impacto na rotina escolar e no engajamento.`,
      'Monitorar divergências entre família, professor e autoavaliação do estudante quando aparecerem.',
      'Acompanhar evolução por ciclo para validar se a tendência atual se sustenta no tempo.'
    ],
    actionPlan: [
      `Definir uma ação focal de acompanhamento para o eixo ${weakest} nas próximas 4 semanas.`,
      'Registrar evidências pedagógicas de progresso e reavaliar no próximo ciclo institucional.',
      'Compartilhar devolutiva com família e equipe escolar com linguagem objetiva e próximos passos claros.'
    ]
  };
}

async function ensureQuestions() {
  for (const [dimension, pillarLabel, prompt, sortOrder] of questionsSeed) {
    await query(
      `INSERT INTO questions (dimension, pillar_label, prompt, sort_order, is_active)
       SELECT $1, $2, $3, $4, TRUE
       WHERE NOT EXISTS (
         SELECT 1 FROM questions WHERE dimension = $1 AND pillar_label = $2 AND prompt = $3
       )`,
      [dimension, pillarLabel, prompt, sortOrder]
    );
  }
}

async function cleanupPreviousDemoData(tenantId) {
  await query(
    `DELETE FROM leads WHERE source = 'landing' AND COALESCE(notes, '') LIKE $1`,
    [`%${SOURCE_TAG.replace('V1_4_7', 'V1_4_')}%`]
  );

  await query(
    `DELETE FROM users WHERE tenant_id = $1 AND email LIKE $2 AND email <> $3`,
    [tenantId, `%${DEMO_TEAM_DOMAIN}`, env.defaultAdminEmail]
  );

  await query(
    `DELETE FROM students WHERE tenant_id = $1 AND guardian_email LIKE $2`,
    [tenantId, `%${DEMO_GUARDIAN_DOMAIN}`]
  );
}

async function ensureUser(tenantId, fullName, email, role) {
  const existing = (await query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email])).rows[0];
  const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
  if (existing) {
    return (await query(
      `UPDATE users
          SET full_name = $2,
              role = $3,
              tenant_id = $4,
              school_name = $5,
              is_active = TRUE
        WHERE email = $1
      RETURNING *`,
      [email, fullName, role, tenantId, SCHOOL_NAME]
    )).rows[0];
  }

  return (await query(
    `INSERT INTO users (full_name, email, password_hash, role, school_name, is_active, tenant_id)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6)
     RETURNING *`,
    [fullName, email, passwordHash, role, SCHOOL_NAME, tenantId]
  )).rows[0];
}

async function ensureCycle(tenantId, title, startDate, endDate, status) {
  const existing = (await query(
    'SELECT * FROM assessment_cycles WHERE tenant_id = $1 AND title = $2 LIMIT 1',
    [tenantId, title]
  )).rows[0];

  if (existing) {
    return (await query(
      `UPDATE assessment_cycles
          SET school_name = $2,
              start_date = $3,
              end_date = $4,
              status = $5
        WHERE id = $1
      RETURNING *`,
      [existing.id, SCHOOL_NAME, startDate, endDate, status]
    )).rows[0];
  }

  return (await query(
    `INSERT INTO assessment_cycles (title, school_name, start_date, end_date, status, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, SCHOOL_NAME, startDate, endDate, status, tenantId]
  )).rows[0];
}

async function ensureStudent(tenantId, student) {
  const [fullName, birthDate, gradeLevel, className, guardianName, guardianEmail, profile, sequence] = student;
  const existing = (await query(
    `SELECT * FROM students WHERE tenant_id = $1 AND full_name = $2 LIMIT 1`,
    [tenantId, fullName]
  )).rows[0];

  if (existing) {
    return (await query(
      `UPDATE students
          SET birth_date = $2,
              grade_level = $3,
              class_name = $4,
              school_name = $5,
              guardian_name = $6,
              guardian_email = $7
        WHERE id = $1
      RETURNING *`,
      [existing.id, birthDate, gradeLevel, className, SCHOOL_NAME, guardianName, guardianEmail]
    )).rows[0];
  }

  const inserted = (await query(
    `INSERT INTO students (full_name, birth_date, grade_level, class_name, school_name, guardian_name, guardian_email, tenant_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [fullName, birthDate, gradeLevel, className, SCHOOL_NAME, guardianName, guardianEmail, tenantId]
  )).rows[0];

  inserted.__profile = profile;
  inserted.__sequence = sequence;
  return inserted;
}

async function ensureLead(lead) {
  const [fullName, email, schoolName, whatsapp, roleLabel, schoolSize, interestPlan] = lead;
  const existing = (await query('SELECT id FROM leads WHERE email = $1 LIMIT 1', [email])).rows[0];
  if (existing) {
    await query(
      `UPDATE leads
          SET school_name = $2,
              whatsapp = $3,
              role_label = $4,
              school_size = $5,
              interest_plan = $6,
              notes = $7,
              status = 'qualified'
        WHERE email = $1`,
      [email, schoolName, whatsapp, roleLabel, schoolSize, interestPlan, `${SOURCE_TAG} Lead de demonstração comercial gerado automaticamente.`]
    );
    return;
  }
  await query(
    `INSERT INTO leads (full_name, email, school_name, whatsapp, role_label, school_size, interest_plan, notes, source, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'landing', 'qualified')`,
    [fullName, email, schoolName, whatsapp, roleLabel, schoolSize, interestPlan, `${SOURCE_TAG} Lead de demonstração comercial gerado automaticamente.`]
  );
}

function buildResponseScore({ profile, target, respondentType, questionIndex, studentIndex, cycleIndex, dimension }) {
  const jitter = (((studentIndex + questionIndex + cycleIndex) % 5) - 2) * 0.12;
  const raw = target + respondentBias(profile, respondentType, dimension) + jitter;
  return Math.round(clamp(raw, 1, 5));
}

function buildComment(score, dimension, profile) {
  if (score <= 2) return `Eixo ${dimension}: demanda intervenção mais próxima e combinados mais consistentes.`;
  if (score === 3) return `Eixo ${dimension}: apresenta oscilação moderada e merece monitoramento pedagógico.`;
  if (profile === 'highlight' && score >= 4) return `Eixo ${dimension}: demonstra repertório acima da média e potencial para protagonismo.`;
  return `Eixo ${dimension}: apresenta sinais positivos e consistentes neste ciclo.`;
}

async function upsertAssessment(tenantId, studentId, cycleId, notes) {
  const existing = (await query(
    `SELECT * FROM assessments WHERE tenant_id = $1 AND student_id = $2 AND cycle_id = $3 LIMIT 1`,
    [tenantId, studentId, cycleId]
  )).rows[0];

  if (existing) {
    return (await query(
      `UPDATE assessments
          SET notes = $4,
              method_name = 'C.O.R.E. 360',
              status = 'draft',
              overall_score = NULL,
              overall_band = NULL,
              cognitive_score = NULL,
              organization_score = NULL,
              relational_score = NULL,
              emotional_score = NULL,
              ai_summary = NULL,
              strengths = '[]'::jsonb,
              risks = '[]'::jsonb,
              action_plan = '[]'::jsonb,
              updated_at = NOW()
        WHERE id = $1
      RETURNING *`,
      [existing.id, tenantId, studentId, notes]
    )).rows[0];
  }

  return (await query(
    `INSERT INTO assessments (student_id, cycle_id, method_name, notes, status, tenant_id)
     VALUES ($1, $2, 'C.O.R.E. 360', $3, 'draft', $4)
     RETURNING *`,
    [studentId, cycleId, notes, tenantId]
  )).rows[0];
}

async function recreateRespondents(assessmentId, student, usersMap) {
  await query('DELETE FROM respondents WHERE assessment_id = $1', [assessmentId]);

  const teacher = pickTeacherByGrade(usersMap, student.grade_level);
  const coordinator = usersMap.get('luciana.prado@loopinedu.demo');
  const respondentsPayload = [
    ['student', student.full_name, null],
    ['teacher', teacher?.full_name || 'Professor(a) responsável', teacher?.email || null],
    ['guardian', student.guardian_name, student.guardian_email],
    ['institutional', coordinator?.full_name || 'Coordenação pedagógica', coordinator?.email || null]
  ];

  const respondents = [];
  for (const [type, name, email] of respondentsPayload) {
    const inserted = (await query(
      `INSERT INTO respondents (assessment_id, respondent_type, respondent_name, respondent_email, respondent_token, status)
       VALUES ($1, $2, $3, $4, md5(random()::text || clock_timestamp()::text || $3), 'pending')
       RETURNING *`,
      [assessmentId, type, name, email]
    )).rows[0];
    respondents.push(inserted);
  }
  return respondents;
}

async function finalizeCompletedAssessment(assessmentId, tenantId, profile, cycleDate) {
  const scores = await calculateAssessmentScores(assessmentId, tenantId);
  const ai = buildAiBlocks(profile, scores);
  await query(
    `UPDATE assessments
        SET overall_score = $2,
            overall_band = $3,
            cognitive_score = $4,
            organization_score = $5,
            relational_score = $6,
            emotional_score = $7,
            ai_summary = $8,
            strengths = $9::jsonb,
            risks = $10::jsonb,
            action_plan = $11::jsonb,
            status = 'completed',
            created_at = $12::timestamp,
            updated_at = $12::timestamp
      WHERE id = $1`,
    [
      assessmentId,
      scores.overall_score,
      scores.overall_band,
      scores.cognitive_score,
      scores.organization_score,
      scores.relational_score,
      scores.emotional_score,
      ai.summary,
      JSON.stringify(ai.strengths),
      JSON.stringify(ai.risks),
      JSON.stringify(ai.actionPlan),
      cycleDate
    ]
  );
}

async function setAssessmentStatus(assessmentId, status, cycleDate) {
  await query(
    `UPDATE assessments
        SET status = $2,
            created_at = $3::timestamp,
            updated_at = $3::timestamp
      WHERE id = $1`,
    [assessmentId, status, cycleDate]
  );
}

async function ensureAssessmentWithFlow({ tenantId, student, cycle, questions, usersMap, studentIndex, cycleIndex }) {
  const profile = student.__profile || 'stable';
  const notes = `${SOURCE_TAG} Perfil ${profile} | histórico demonstrativo gerado automaticamente para ${student.full_name}.`;
  const assessment = await upsertAssessment(tenantId, student.id, cycle.id, notes);
  const respondents = await recreateRespondents(assessment.id, student, usersMap);

  const latestCycle = cycleIndex === cycleSeed.length - 1;
  const shouldDraft = latestCycle && studentIndex >= 90;
  const shouldCollect = latestCycle && studentIndex >= 70 && studentIndex < 90;
  const shouldComplete = !shouldDraft && !shouldCollect;

  const dimensionTargets = getProfileTargets(profile, cycleIndex);
  const respondentOrder = shouldCollect
    ? ['teacher', 'guardian']
    : ['student', 'teacher', 'guardian', 'institutional'];

  for (const respondent of respondents) {
    if (!respondentOrder.includes(respondent.respondent_type)) continue;
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const target = dimensionTargets[q.dimension] || 3.5;
      const score = buildResponseScore({
        profile,
        target,
        respondentType: respondent.respondent_type,
        questionIndex: i,
        studentIndex,
        cycleIndex,
        dimension: q.dimension
      });
      const comment = buildComment(score, q.dimension, profile);
      await query(
        `INSERT INTO responses (respondent_id, question_id, score, comment)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (respondent_id, question_id)
         DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment`,
        [respondent.id, q.id, score, comment]
      );
    }
    await query(`UPDATE respondents SET status = 'completed' WHERE id = $1`, [respondent.id]);
  }

  const cycleDate = toSqlTimestamp(cycle.end_date || cycle.start_date);
  if (shouldComplete) {
    await finalizeCompletedAssessment(assessment.id, tenantId, profile, cycleDate);
  } else if (shouldCollect) {
    await setAssessmentStatus(assessment.id, 'collecting', cycleDate);
  } else {
    await setAssessmentStatus(assessment.id, 'draft', cycleDate);
  }

  return { status: shouldComplete ? 'completed' : shouldCollect ? 'collecting' : 'draft' };
}

async function ensureSubscription(tenantId) {
  const tenant = (await query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [tenantId])).rows[0];
  if (!tenant) return;

  let subscription = (await query(
    `SELECT * FROM subscriptions WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  )).rows[0];

  if (!subscription) {
    subscription = (await query(
      `INSERT INTO subscriptions (tenant_id, plan_key, status, provider, amount_cents, starts_at, ends_at, paid_at)
       VALUES ($1, 'premium', 'active', 'internal', 0, NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days', NOW() - INTERVAL '30 days')
       RETURNING *`,
      [tenantId]
    )).rows[0];
  }

  await query(
    `UPDATE tenants
        SET current_subscription_id = $2,
            plan = 'premium',
            subscription_status = 'active',
            status = 'active',
            billing_email = COALESCE(billing_email, $3),
            primary_color = COALESCE(primary_color, '#243B63'),
            secondary_color = COALESCE(secondary_color, '#46C2C2'),
            accent_color = COALESCE(accent_color, '#8BC34A')
      WHERE id = $1`,
    [tenantId, subscription.id, env.defaultAdminEmail]
  );
}

async function main() {
  await seedDefaultAdmin();
  await ensureQuestions();

  const tenant = (await query('SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [env.defaultTenantSlug])).rows[0];
  if (!tenant) throw new Error('Tenant demo não encontrado para popular a base.');

  await cleanupPreviousDemoData(tenant.id);
  await ensureSubscription(tenant.id);

  const usersMap = new Map();
  for (const [, role, fullName, email] of teamSeed) {
    const user = await ensureUser(tenant.id, fullName, email, role);
    usersMap.set(email, user);
  }

  const cycles = [];
  for (const cycle of cycleSeed) {
    cycles.push(await ensureCycle(tenant.id, ...cycle));
  }

  const students = [];
  for (const studentRow of studentsSeed) {
    const student = await ensureStudent(tenant.id, studentRow);
    student.__profile = studentRow[6];
    student.__sequence = studentRow[7];
    students.push(student);
  }

  const questions = (await query(
    'SELECT id, dimension, sort_order FROM questions WHERE is_active = TRUE ORDER BY sort_order, id'
  )).rows;

  const counters = { completed: 0, collecting: 0, draft: 0 };
  const profileCounters = { critical: 0, recovering: 0, stable: 0, oscillating: 0, highlight: 0 };

  for (let studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
    const student = students[studentIndex];
    profileCounters[student.__profile] += 1;
    for (let cycleIndex = 0; cycleIndex < cycles.length; cycleIndex += 1) {
      const result = await ensureAssessmentWithFlow({
        tenantId: tenant.id,
        student,
        cycle: cycles[cycleIndex],
        questions,
        usersMap,
        studentIndex,
        cycleIndex
      });
      counters[result.status] += 1;
    }
  }

  for (const lead of leadsSeed) {
    await ensureLead(lead);
  }

  const summary = {
    tenant: tenant.name,
    users_demo: teamSeed.length + 1,
    students: students.length,
    classes: `${classes.length} turmas por série`,
    grade_distribution: grades.reduce((acc, grade) => {
      acc[grade] = students.filter((student) => student.grade_level === grade).length;
      return acc;
    }, {}),
    cycles: cycles.map((cycle) => cycle.title),
    assessments_total: students.length * cycles.length,
    completed_assessments: counters.completed,
    collecting_assessments: counters.collecting,
    draft_assessments: counters.draft,
    profile_distribution: profileCounters,
    leads_demo: leadsSeed.length,
    login_demo: {
      email: env.defaultAdminEmail,
      password: env.defaultAdminPassword
    }
  };

  console.log('Seed showcase com 100 alunos gerado com sucesso.');
  console.log(JSON.stringify(summary, null, 2));
  await pool.end();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('Erro ao gerar seed showcase:', error);
  try { await pool.end(); } catch {}
  process.exit(1);
});
