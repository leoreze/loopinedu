import { Router } from 'express';
import { listCycles, createCycle, getCycle, updateCycle } from '../controllers/cycles.controller.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.get('/', asyncHandler(listCycles));
router.post('/', asyncHandler(createCycle));
router.get('/:id', asyncHandler(getCycle));
router.patch('/:id', asyncHandler(updateCycle));

export default router;
