import { Router } from 'express';
import { getPlans, getSummary, getLiveStatus, subscribe, confirmPayment, syncPayment, cancelSubscription } from '../controllers/billing.controller.js';
import { asyncHandler } from '../utils/helpers.js';

const router = Router();
router.get('/plans', asyncHandler(getPlans));
router.get('/summary', asyncHandler(getSummary));
router.get('/live-status', asyncHandler(getLiveStatus));
router.post('/subscribe', asyncHandler(subscribe));
router.post('/confirm-payment', asyncHandler(confirmPayment));
router.post('/sync-payment', asyncHandler(syncPayment));
router.post('/cancel', asyncHandler(cancelSubscription));

export default router;
