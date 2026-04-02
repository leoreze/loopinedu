import { Router } from 'express';
import { asyncHandler } from '../utils/helpers.js';
import { getPublicRespondent, savePublicRespondentResponses } from '../controllers/assessments.controller.js';
import { listPublicRoadmap } from '../controllers/roadmap.controller.js';

const router = Router();
router.get('/respondent/:token', asyncHandler(getPublicRespondent));
router.post('/respondent/:token/responses', asyncHandler(savePublicRespondentResponses));
router.get('/roadmap', asyncHandler(listPublicRoadmap));

export default router;
