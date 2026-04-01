import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getClient, query } from '../db/index.js';
import { env } from '../config/env.js';
import { questionsSeed } from '../utils/questions.seed.js';

function slugify(value = '') {
  return String(value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'escola-loopinedu';
}

async function ensureUniqueSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const found = await query('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [slug]);
    if (!found.rows[0]) return slug;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

async function seedQuestions(client) {
  for (const [dimension, pillar_label, prompt, sort_order] of questionsSeed) {
    await client.query(
      `INSERT INTO questions (dimension, pillar_label, prompt, sort_order, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (dimension, pillar_label, prompt) DO NOTHING`,
      [dimension, pillar_label, prompt, sort_order]
    );
  }
}

export async function signup(req, res) {
  const { school_name, admin_name, email, password } = req.body;
  if (!school_name?.trim() || !admin_name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Preencha escola, nome, e-mail e senha.' });
  }

  const existingUser = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email.trim().toLowerCase()]);
  if (existingUser.rows[0]) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }

  const baseSlug = slugify(school_name);
  const slug = await ensureUniqueSlug(baseSlug);
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const tenant = (await client.query(
      `INSERT INTO tenants (name, slug, plan, status, trial_ends_at, billing_email, subscription_status)
       VALUES ($1, $2, 'trial', 'active', NOW() + ($3 * INTERVAL '1 day'), $4, 'trial') RETURNING *`,
      [school_name.trim(), slug, env.trialDays, email.trim().toLowerCase()]
    )).rows[0];

    const user = (await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, school_name, is_active, tenant_id)
       VALUES ($1, $2, $3, 'admin', $4, TRUE, $5) RETURNING id, full_name, email, role, tenant_id`,
      [admin_name.trim(), email.trim().toLowerCase(), passwordHash, school_name.trim(), tenant.id]
    )).rows[0];

    await client.query(
      `INSERT INTO assessment_cycles (title, school_name, start_date, end_date, status, tenant_id)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', 'active', $3)`,
      ['Ciclo inicial', school_name.trim(), tenant.id]
    );

    await seedQuestions(client);

    await client.query('COMMIT');

    const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      tenantId: user.tenant_id,
      tenantSlug: tenant.slug
    }, env.jwtSecret, { expiresIn: '8h' });

    return res.status(201).json({
      token,
      user: {
        ...user,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          status: tenant.status,
          trial_ends_at: tenant.trial_ends_at,
          subscription_status: tenant.subscription_status
        }
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
