import { Router } from 'express';
import { login, me, logout } from '../controllers/auth.controller.js';
import { billingAccessMiddleware } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();

router.post('/login', asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', billingAccessMiddleware, asyncHandler(me));

export default router;
