import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../db/index.js';
import { tenantHasFeature } from '../config/plans.js';
import { asyncHandler } from '../utils/helpers.js';

function tenantAccessState(tenant) {
  if (!tenant) return { allowed: false, reason: 'TENANT_NOT_FOUND' };
  if (tenant.status === 'blocked') return { allowed: false, reason: 'TENANT_BLOCKED' };
  if ((tenant.subscription_status === 'overdue' || tenant.subscription_status === 'canceled') && tenant.plan !== 'premium') {
    return { allowed: false, reason: 'TENANT_BILLING_BLOCKED' };
  }
  if (tenant.plan === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
    return { allowed: false, reason: 'TENANT_TRIAL_EXPIRED' };
  }
  return { allowed: true, reason: null };
}

async function attachTenantFromToken(req, token) {
  req.user = jwt.verify(token, env.jwtSecret);
  if (!req.user.tenantId) {
    throw new Error('Tenant inválido.');
  }
  const tenantResult = await query(
    `SELECT id, name, slug, plan, status, trial_ends_at, subscription_status, billing_email, primary_color, current_subscription_id
     FROM tenants WHERE id = $1 LIMIT 1`,
    [req.user.tenantId]
  );
  req.tenant = tenantResult.rows[0] || null;
  req.tenantAccess = tenantAccessState(req.tenant);
}

function createMiddleware({ allowBlocked = false } = {}) {
  return async function(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const tokenFromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = tokenFromHeader || req.query.token || null;

    if (!token) {
      return res.status(401).json({ error: 'Token ausente.' });
    }

    try {
      await attachTenantFromToken(req, token);
      if (!allowBlocked && !req.tenantAccess.allowed) {
        return res.status(403).json({
          error: 'Seu ambiente precisa de regularização do trial ou da assinatura para continuar.',
          code: req.tenantAccess.reason,
          tenant: req.tenant
        });
      }
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido.' });
    }
  };
}

export const authMiddleware = createMiddleware({ allowBlocked: false });
export const billingAccessMiddleware = createMiddleware({ allowBlocked: true });

export function requireFeature(featureKey) {
  return function(req, res, next) {
    if (!req.tenant) {
      return res.status(401).json({ error: 'Tenant não carregado.' });
    }
    if (!tenantHasFeature(req.tenant, featureKey)) {
      return res.status(403).json({
        error: 'Seu plano atual não libera este recurso.',
        code: 'FEATURE_BLOCKED',
        feature: featureKey,
        plan: req.tenant.plan
      });
    }
    next();
  };
}


export function requireRole(...allowedRoles) {
  return function(req, res, next) {
    if (!req.user?.role) return res.status(401).json({ error: 'Perfil não identificado.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Seu perfil não possui permissão para esta ação.', code: 'ROLE_BLOCKED', role: req.user.role });
    }
    next();
  };
}

export { asyncHandler };


export function requirePlatformAdmin(req, res, next) {
  if (!req.user?.isPlatformAdmin) {
    return res.status(403).json({ error: 'Acesso restrito ao painel central da plataforma.', code: 'PLATFORM_ADMIN_ONLY' });
  }
  next();
}
