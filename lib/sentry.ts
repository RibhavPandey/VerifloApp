// Sentry error tracking initialization
// To set up Sentry:
// 1. Create a free account at https://sentry.io
// 2. Create a new project (React)
// 3. Copy your DSN
// 4. Add VITE_SENTRY_DSN to your .env file

import * as Sentry from '@sentry/react';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        // Remove passwords and tokens from request data
        if (event.request.data) {
          const data = event.request.data as any;
          if (data.password) data.password = '[REDACTED]';
          if (data.token) data.token = '[REDACTED]';
          if (data.access_token) data.access_token = '[REDACTED]';
        }
      }
      return event;
    },
  });
} else if (!sentryDsn && import.meta.env.PROD) {
  console.warn('Sentry DSN not configured. Error tracking is disabled.');
}

export default Sentry;
