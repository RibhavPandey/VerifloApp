import express from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { chargeCredits, InsufficientCreditsError } from '../utils/credits.js';

const router = express.Router();

// Charge 5 credits for workflow run (called before running workflow)
router.post('/charge', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await chargeCredits(req.user.id, 5);
    res.json({ success: true });
  } catch (error: any) {
    if (error instanceof InsufficientCreditsError) {
      return res.status(402).json({
        error: 'Insufficient credits',
        required: error.required,
        available: error.available,
      });
    }
    throw error;
  }
});

export default router;
