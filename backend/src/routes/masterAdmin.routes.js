
import { Router } from 'express';
import { asyncHandler } from '../utils/helpers.js';
import { requirePlatformAdmin } from '../middlewares/auth.middleware.js';
import { getMasterOverview, listTenants, getTenantDetail, updateTenantAdmin, setTenantBlocked, resetTenantTrial, createPlatformAdmin } from '../controllers/masterAdmin.controller.js';

const router = Router();
router.use(requirePlatformAdmin);
router.get('/overview', asyncHandler(getMasterOverview));
router.get('/tenants', asyncHandler(listTenants));
router.get('/tenants/:id', asyncHandler(getTenantDetail));
router.patch('/tenants/:id', asyncHandler(updateTenantAdmin));
router.post('/tenants/:id/block', asyncHandler(setTenantBlocked));
router.post('/tenants/:id/reset-trial', asyncHandler(resetTenantTrial));
router.post('/platform-admins', asyncHandler(createPlatformAdmin));

export default router;
