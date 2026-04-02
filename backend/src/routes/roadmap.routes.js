import { Router } from 'express';
import { asyncHandler, requireRole } from '../middlewares/auth.middleware.js';
import { listRoadmap, moveRoadmapCard } from '../controllers/roadmap.controller.js';

const router = Router();

router.get('/', asyncHandler(listRoadmap));
router.patch('/:cardId/move', requireRole('admin', 'coordinator'), asyncHandler(moveRoadmapCard));

export default router;
