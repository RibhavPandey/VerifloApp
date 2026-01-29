// Sentry error tracking for backend
// To set up Sentry:
// 1. Create a free account at https://sentry.io
// 2. Create a new project (Node.js)
// 3. Copy your DSN
// 4. Add SENTRY_DSN to your backend/.env file

import * as Sentry from '@sentry/node';

const sentryDsn = process.env.SENTRY_DSN;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1, // 10% of transactions
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove passwords and tokens from request data
        if (event.request.data) {
          const data = event.request.data as any;
          if (data.password) data.password = '[REDACTED]';
          if (data.token) data.token = '[REDACTED]';
          if (data.access_token) data.access_token = '[REDACTED]';
          if (data.apiKey) data.apiKey = '[REDACTED]';
        }
      }
      return event;
    },
  });
} else {
  console.warn('Sentry DSN not configured. Error tracking is disabled.');
}

export default Sentry;
