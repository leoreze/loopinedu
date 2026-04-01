import { Router } from 'express';
import { getQuestions, getMethod, createLead } from '../controllers/meta.controller.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.get('/questions', asyncHandler(getQuestions));
router.get('/method', asyncHandler(getMethod));
router.post('/leads', asyncHandler(createLead));

export default router;
