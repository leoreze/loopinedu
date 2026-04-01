CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  trial_ends_at TIMESTAMP,
  billing_email TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','coordinator','teacher','specialist')),
  school_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  grade_level TEXT,
  class_name TEXT,
  birth_date DATE,
  school_name TEXT,
  guardian_name TEXT,
  guardian_email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE students ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE TABLE IF NOT EXISTS assessment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  school_name TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE assessment_cycles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES assessment_cycles(id) ON DELETE SET NULL,
  method_name TEXT NOT NULL DEFAULT 'C.O.R.E. 360',
  notes TEXT,
  overall_score NUMERIC(4,2),
  overall_band TEXT,
  cognitive_score NUMERIC(4,2),
  organization_score NUMERIC(4,2),
  relational_score NUMERIC(4,2),
  emotional_score NUMERIC(4,2),
  ai_summary TEXT,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','collecting','scoring','processing_ai','completed','error')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

CREATE TABLE IF NOT EXISTS respondents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  respondent_type TEXT NOT NULL CHECK (respondent_type IN ('student','teacher','guardian','institutional')),
  respondent_name TEXT,
  respondent_email TEXT,
  respondent_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  dimension TEXT NOT NULL CHECK (dimension IN ('cognitive','organization','relational','emotional')),
  pillar_label TEXT NOT NULL,
  prompt TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (dimension, pillar_label, prompt)
);

CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id UUID NOT NULL REFERENCES respondents(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (respondent_id, question_id)
);

CREATE TABLE IF NOT EXISTS report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  file_url TEXT,
  export_type TEXT NOT NULL DEFAULT 'pdf',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cycles_tenant ON assessment_cycles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_respondent ON responses(respondent_id);
CREATE INDEX IF NOT EXISTS idx_questions_dimension ON questions(dimension);
CREATE INDEX IF NOT EXISTS idx_respondents_assessment ON respondents(assessment_id);


CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL CHECK (plan_key IN ('trial','essencial','pro','premium')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','overdue','canceled','expired')),
  provider TEXT NOT NULL DEFAULT 'internal',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly')),
  amount_cents INT NOT NULL DEFAULT 0,
  external_reference TEXT,
  checkout_url TEXT,
  qr_code_text TEXT,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'internal',
  amount_cents INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  provider_reference TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription ON payment_transactions(subscription_id);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS current_subscription_id UUID REFERENCES subscriptions(id);


-- Garantia incremental para ambientes já existentes sem constraint UNIQUE em questions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'questions'
  ) THEN
    DELETE FROM questions q
    USING questions q2
    WHERE q.id < q2.id
      AND q.dimension = q2.dimension
      AND q.pillar_label = q2.pillar_label
      AND q.prompt = q2.prompt;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'questions_dimension_pillar_label_prompt_key'
    ) THEN
      ALTER TABLE questions
      ADD CONSTRAINT questions_dimension_pillar_label_prompt_key
      UNIQUE (dimension, pillar_label, prompt);
    END IF;
  END IF;
END $$;



ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secondary_color TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS tenant_brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('logo_light','logo_dark','cover')),
  asset_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, asset_type)
);

CREATE TABLE IF NOT EXISTS premium_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_label TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_audit_logs_tenant ON premium_audit_logs(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  school_name TEXT,
  whatsapp TEXT,
  role_label TEXT,
  school_size TEXT,
  interest_plan TEXT,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'landing',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','won','lost')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);


ALTER TABLE respondents ADD COLUMN IF NOT EXISTS respondent_token TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'respondents_respondent_token_key'
  ) THEN
    ALTER TABLE respondents ADD CONSTRAINT respondents_respondent_token_key UNIQUE (respondent_token);
  END IF;
END $$;
UPDATE respondents
SET respondent_token = COALESCE(respondent_token, md5(id::text || random()::text || clock_timestamp()::text))
WHERE respondent_token IS NULL;


ALTER TABLE subscriptions ALTER COLUMN provider SET DEFAULT 'internal';
ALTER TABLE payment_transactions ALTER COLUMN provider SET DEFAULT 'internal';
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_method_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS payment_type_id TEXT;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
