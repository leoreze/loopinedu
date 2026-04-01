import { Router } from 'express';
import { getOverview, getByClass, getByGrade, getAlerts, getPremiumInsights, getAssessmentTrends } from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../utils/helpers.js';
import { requireFeature } from '../middlewares/auth.middleware.js';

const router = Router();
router.get('/overview', asyncHandler(getOverview));
router.get('/by-class', requireFeature('dashboard_advanced'), asyncHandler(getByClass));
router.get('/by-grade', requireFeature('dashboard_advanced'), asyncHandler(getByGrade));
router.get('/alerts', asyncHandler(getAlerts));
router.get('/premium-insights', requireFeature('premium_workspace'), asyncHandler(getPremiumInsights));
router.get('/trends', requireFeature('dashboard_advanced'), asyncHandler(getAssessmentTrends));

export default router;
