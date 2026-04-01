import { Router } from 'express';
import {
  listAssessments,
  createAssessmentHandler,
  getAssessment,
  updateAssessment,
  addRespondentsHandler,
  saveResponsesHandler,
  completeAssessmentHandler,
  getAssessmentRespondents,
  getPublicRespondent,
  savePublicRespondentResponses,
  getAssessmentComparisonHandler
} from '../controllers/assessments.controller.js';
import { asyncHandler } from '../utils/helpers.js';
import { requireFeature } from '../middlewares/auth.middleware.js';

const router = Router();
router.get('/', asyncHandler(listAssessments));
router.post('/', asyncHandler(createAssessmentHandler));
router.get('/:id', asyncHandler(getAssessment));
router.patch('/:id', asyncHandler(updateAssessment));
router.post('/:id/respondents', asyncHandler(addRespondentsHandler));
router.get('/:id/respondents', asyncHandler(getAssessmentRespondents));
router.get('/:id/comparison', requireFeature('respondent_comparison'), asyncHandler(getAssessmentComparisonHandler));
router.post('/:id/complete', asyncHandler(completeAssessmentHandler));
router.get('/public/respondent/:token', asyncHandler(getPublicRespondent));
router.post('/public/respondent/:token/responses', asyncHandler(savePublicRespondentResponses));
router.post('/respondents/:id/responses', asyncHandler(saveResponsesHandler));

export default router;
