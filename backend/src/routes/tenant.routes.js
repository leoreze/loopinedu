
import { Router } from 'express';
import { asyncHandler, requireFeature, requireRole } from '../middlewares/auth.middleware.js';
import { getTenantSettings, updateTenantSettings, createTenantUser, updateTenantUser } from '../controllers/tenant.controller.js';
const router = Router();
router.get('/settings', requireFeature('premium_workspace'), asyncHandler(getTenantSettings));
router.patch('/settings', requireFeature('premium_workspace'), requireRole('admin', 'coordinator'), asyncHandler(updateTenantSettings));
router.post('/users', requireFeature('premium_workspace'), requireRole('admin'), asyncHandler(createTenantUser));
router.patch('/users/:userId', requireFeature('premium_workspace'), requireRole('admin'), asyncHandler(updateTenantUser));
export default router;
