import { Router } from 'express';
import { signup } from '../controllers/onboarding.controller.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.post('/signup', asyncHandler(signup));

export default router;
