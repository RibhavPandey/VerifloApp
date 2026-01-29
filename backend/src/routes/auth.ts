import express from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../utils/email.js';

const router = express.Router();

// Send welcome email (called after user signs up)
router.post('/welcome-email', async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id || !req.user?.email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name } = req.body;
    const email = req.user.email;

    const success = await sendWelcomeEmail(email, name || 'User');

    if (success) {
      return res.json({ message: 'Welcome email sent successfully' });
    } else {
      return res.status(500).json({ error: 'Failed to send welcome email' });
    }
  } catch (error: any) {
    console.error('Welcome email error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send welcome email' });
  }
});

export default router;
