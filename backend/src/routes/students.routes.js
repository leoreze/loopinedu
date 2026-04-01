import { Router } from 'express';
import { listStudents, createStudent, getStudent, updateStudent, getStudentHistory } from '../controllers/students.controller.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.get('/', asyncHandler(listStudents));
router.post('/', asyncHandler(createStudent));
router.get('/:id', asyncHandler(getStudent));
router.patch('/:id', asyncHandler(updateStudent));
router.get('/:id/history', asyncHandler(getStudentHistory));

export default router;
