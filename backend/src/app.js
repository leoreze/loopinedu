import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import studentsRoutes from './routes/students.routes.js';
import assessmentsRoutes from './routes/assessments.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import metaRoutes from './routes/meta.routes.js';
import cyclesRoutes from './routes/cycles.routes.js';
import onboardingRoutes from './routes/onboarding.routes.js';
import billingRoutes from './routes/billing.routes.js';
import { providerWebhook } from './controllers/billing.controller.js';
import { asyncHandler } from './utils/helpers.js';
import publicRoutes from './routes/public.routes.js';
import tenantRoutes from './routes/tenant.routes.js';
import masterAdminRoutes from './routes/masterAdmin.routes.js';
import { authMiddleware, billingAccessMiddleware } from './middlewares/auth.middleware.js';
import { notFoundMiddleware, errorMiddleware } from './middlewares/error.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../../frontend/public');

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, app: 'LoopinEdu', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.post('/api/billing/webhook', asyncHandler(providerWebhook));
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/tenant', authMiddleware, tenantRoutes);
  app.use('/api/master-admin', authMiddleware, masterAdminRoutes);
  app.use('/api/billing', billingAccessMiddleware, billingRoutes);
  app.use('/api/reports', authMiddleware, reportsRoutes);
  app.use('/api/students', authMiddleware, studentsRoutes);
  app.use('/api/assessments', authMiddleware, assessmentsRoutes);
  app.use('/api/dashboard', authMiddleware, dashboardRoutes);
  app.use('/api/cycles', authMiddleware, cyclesRoutes);

  app.use(express.static(frontendDir));

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
