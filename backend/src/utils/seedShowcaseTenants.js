import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';

const DEFAULT_PASSWORD = '123456';

function buildTextLogoDataUri(label, bg, accent, text = '#ffffff') {
  const safe = String(label || 'Escola').replace(/&/g, '&amp;');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120" fill="none">
      <rect width="420" height="120" rx="26" fill="${bg}"/>
      <rect x="18" y="18" width="84" height="84" rx="22" fill="${accent}" opacity="0.95"/>
      <path d="M44 42h32c11 0 18 7 18 17 0 7-4 13-10 16 8 2 13 8 13 17 0 13-10 22-25 22H44V42Zm18 16v18h12c6 0 10-4 10-9 0-5-4-9-10-9H62Zm0 31v19h15c7 0 11-4 11-10 0-6-4-9-11-9H62Z" fill="${text}"/>
      <text x="122" y="56" fill="${text}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800">${safe}</text>
      <text x="122" y="84" fill="${text}" fill-opacity="0.8" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="600">Ambiente institucional • LoopinEdu</text>
    </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const TENANTS = [
  {
    name: 'Pueri Domus',
    slug: 'pueri-domus',
    website: 'https://www.pueridomus.com.br/pt/',
    description: 'Escola bilíngue com ênfase em educação integral, habilidades socioemocionais, fluência digital e IB World School.',
    city: 'São Paulo, SP',
    primary: '#233347',
    secondary: '#2A877F',
    accent: '#8CBC5E',
    admin: { full_name: 'Marina Azevedo', email: 'marina.azevedo@pueridomus.demo' },
    coordinator: { full_name: 'Renata Vasconcelos', email: 'renata.vasconcelos@pueridomus.demo' },
    students: [
      ['Theo Martins', '4º Ano', 'A'], ['Valentina Rocha', '4º Ano', 'B'], ['Lucas Nery', '5º Ano', 'A'], ['Clara Tavares', '5º Ano', 'B'],
      ['Miguel Prado', '6º Ano', 'A'], ['Helena Castro', '6º Ano', 'B'], ['Arthur Gomes', '7º Ano', 'A'], ['Laura Freitas', '7º Ano', 'B']
    ],
    cycles: [
      ['Diagnóstico de Entrada 2026', '2026-02-02', '2026-03-31', 'closed'],
      ['Panorama 2º Bimestre 2026', '2026-04-01', '2026-06-30', 'active']
    ]
  },
  {
    name: 'Escola SEB',
    slug: 'escola-seb',
    website: 'https://www.escolaseb.com.br/pt/',
    description: 'Rede com destaque em inovação, tradição, resultados e protagonismo, com formação integral e socioemocional.',
    city: 'Ribeirão Preto, SP',
    primary: '#143A52',
    secondary: '#0E7C66',
    accent: '#F5A623',
    admin: { full_name: 'Paulo Bittencourt', email: 'paulo.bittencourt@escolaseb.demo' },
    coordinator: { full_name: 'Juliana Nogueira', email: 'juliana.nogueira@escolaseb.demo' },
    students: [
      ['Ana Beatriz Souza', '3º Ano', 'A'], ['Pedro Henrique Lima', '3º Ano', 'B'], ['Sofia Mendes', '4º Ano', 'A'], ['João Vitor Alves', '4º Ano', 'B'],
      ['Maria Eduarda Costa', '5º Ano', 'A'], ['Davi Oliveira', '5º Ano', 'B'], ['Isabela Barros', '6º Ano', 'A'], ['Enzo Cardoso', '6º Ano', 'B']
    ],
    cycles: [
      ['Jornada Socioemocional 2026', '2026-02-10', '2026-04-30', 'closed'],
      ['Radar de Evolução 2026', '2026-05-05', '2026-07-31', 'active']
    ]
  }
];

async function ensureSubscription(tenantId) {
  const existing = await query(`SELECT id FROM subscriptions WHERE tenant_id = $1 AND status = 'active' LIMIT 1`, [tenantId]);
  if (existing.rows[0]?.id) {
    await query(`UPDATE tenants SET current_subscription_id = $2, subscription_status = 'active', plan = 'premium', status = 'active' WHERE id = $1`, [tenantId, existing.rows[0].id]);
    return;
  }
  const created = (await query(`
    INSERT INTO subscriptions (tenant_id, plan_key, status, provider, amount_cents, starts_at, ends_at, paid_at)
    VALUES ($1, 'premium', 'active', 'internal', 249900, NOW(), NOW() + interval '12 months', NOW())
    RETURNING id
  `, [tenantId])).rows[0];
  await query(`UPDATE tenants SET current_subscription_id = $2, subscription_status = 'active', plan = 'premium', status = 'active' WHERE id = $1`, [tenantId, created.id]);
}

async function ensureUser(tenantId, schoolName, person, role, passwordHash) {
  const existing = (await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [person.email])).rows[0];
  if (existing?.id) {
    await query(`
      UPDATE users
         SET tenant_id = $2,
             role = $3,
             school_name = $4,
             is_active = TRUE
       WHERE id = $1
    `, [existing.id, tenantId, role, schoolName]);
    return existing.id;
  }
  return (await query(`
    INSERT INTO users (full_name, email, password_hash, role, school_name, is_active, tenant_id)
    VALUES ($1,$2,$3,$4,$5,TRUE,$6)
    RETURNING id
  `, [person.full_name, person.email, passwordHash, role, schoolName, tenantId])).rows[0].id;
}

async function ensureCycles(tenantId, schoolName, cycles) {
  for (const [title, start, end, status] of cycles) {
    const found = (await query(`SELECT id FROM assessment_cycles WHERE tenant_id = $1 AND title = $2 LIMIT 1`, [tenantId, title])).rows[0];
    if (!found) {
      await query(`INSERT INTO assessment_cycles (title, school_name, start_date, end_date, status, tenant_id) VALUES ($1,$2,$3,$4,$5,$6)`, [title, schoolName, start, end, status, tenantId]);
    }
  }
}

async function ensureStudents(tenantId, schoolName, students) {
  for (const [fullName, grade, className] of students) {
    const found = (await query(`SELECT id FROM students WHERE tenant_id = $1 AND full_name = $2 LIMIT 1`, [tenantId, fullName])).rows[0];
    if (!found) {
      const guardianFirst = fullName.split(' ')[0];
      await query(`
        INSERT INTO students (full_name, grade_level, class_name, birth_date, school_name, guardian_name, guardian_email, guardian_phone, tenant_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        fullName,
        grade,
        className,
        '2015-03-15',
        schoolName,
        `Família ${guardianFirst}`,
        `${guardianFirst.toLowerCase()}.${tenantId.slice(0, 6)}@familia.demo`,
        '(16) 99123-4567',
        tenantId
      ]);
    }
  }
}

export async function ensureShowcaseTenants() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  for (const item of TENANTS) {
    const logo = buildTextLogoDataUri(item.name, item.primary, item.secondary);
    const brandingJson = {
      website: item.website,
      city: item.city,
      note: item.description,
      school_kind: item.name,
      showcase_seed: true
    };

    const tenant = (await query(`
      INSERT INTO tenants (name, slug, logo_url, primary_color, secondary_color, accent_color, plan, status, trial_ends_at, billing_email, subscription_status, branding_json)
      VALUES ($1,$2,$3,$4,$5,$6,'premium','active',$7,$8,'active',$9::jsonb)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        logo_url = COALESCE(tenants.logo_url, EXCLUDED.logo_url),
        primary_color = COALESCE(tenants.primary_color, EXCLUDED.primary_color),
        secondary_color = COALESCE(tenants.secondary_color, EXCLUDED.secondary_color),
        accent_color = COALESCE(tenants.accent_color, EXCLUDED.accent_color),
        billing_email = COALESCE(tenants.billing_email, EXCLUDED.billing_email),
        branding_json = COALESCE(NULLIF(tenants.branding_json, '{}'::jsonb), EXCLUDED.branding_json),
        plan = 'premium',
        status = 'active',
        subscription_status = 'active'
      RETURNING id, name
    `, [item.name, item.slug, logo, item.primary, item.secondary, item.accent, todayPlusDays(45), item.admin.email, JSON.stringify(brandingJson)])).rows[0];

    await ensureSubscription(tenant.id);
    await ensureUser(tenant.id, item.name, item.admin, 'admin', passwordHash);
    await ensureUser(tenant.id, item.name, item.coordinator, 'coordinator', passwordHash);
    await ensureCycles(tenant.id, item.name, item.cycles);
    await ensureStudents(tenant.id, item.name, item.students);
  }
}
