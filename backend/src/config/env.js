import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret',
  openAiApiKey: process.env.OPENAI_API_KEY || '',
  openAiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  appName: process.env.APP_NAME || 'LoopinEdu',
  appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
  defaultAdminName: process.env.DEFAULT_ADMIN_NAME || 'Administrador',
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || 'admin@loopinedu.com',
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || '123456',
  defaultTenantName: process.env.DEFAULT_TENANT_NAME || 'Escola Demo LoopinEdu',
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'demo-loopinedu',
  trialDays: Number(process.env.TRIAL_DAYS || 15),
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '',
  mercadoPagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || '',
  mercadoPagoStatementDescriptor: process.env.MERCADOPAGO_STATEMENT_DESCRIPTOR || 'LOOPINEDU',
  mercadoPagoIntegratorId: process.env.MERCADOPAGO_INTEGRATOR_ID || ''
};

export const isProduction = env.nodeEnv === 'production';
