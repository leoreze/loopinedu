import { Router } from 'express';
import { getReport, generateReport, getReportPdf, getReportHtml, getFamilyReport } from '../controllers/reports.controller.js';
import { asyncHandler } from '../utils/helpers.js';
import { requireFeature } from '../middlewares/auth.middleware.js';

const router = Router();
router.get('/:assessmentId', asyncHandler(getReport));
router.post('/:assessmentId/generate', requireFeature('reports_premium'), asyncHandler(generateReport));
router.get('/:assessmentId/html', requireFeature('reports_premium'), asyncHandler(getReportHtml));
router.get('/:assessmentId/pdf', requireFeature('reports_premium'), asyncHandler(getReportPdf));
router.get('/:assessmentId/family', requireFeature('family_report'), asyncHandler(getFamilyReport));

export default router;
