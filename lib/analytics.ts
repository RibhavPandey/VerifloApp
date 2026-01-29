// PostHog analytics wrapper
// To set up PostHog:
// 1. Create a free account at https://posthog.com
// 2. Create a new project
// 3. Copy your Project API Key
// 4. Add VITE_POSTHOG_KEY to your .env file

import posthog from 'posthog-js';
import { supabase } from './supabase';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let initialized = false;

export const initAnalytics = () => {
  if (posthogKey && !initialized) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      loaded: (posthog) => {
        if (import.meta.env.DEV) {
          console.log('PostHog initialized');
        }
      },
      capture_pageview: true,
      capture_pageleave: true,
    });
    initialized = true;

    // Identify user when they log in
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
        });
      } else if (event === 'SIGNED_OUT') {
        posthog.reset();
      }
    });
  } else if (!posthogKey && import.meta.env.PROD) {
    console.warn('PostHog key not configured. Analytics are disabled.');
  }
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (initialized && posthogKey) {
    // Remove any PII from properties
    const safeProperties = { ...properties };
    if (safeProperties.email) delete safeProperties.email;
    if (safeProperties.password) delete safeProperties.password;
    if (safeProperties.token) delete safeProperties.token;

    posthog.capture(eventName, safeProperties);
  }
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (initialized && posthogKey) {
    const safeTraits = { ...traits };
    if (safeTraits.email) safeTraits.email = '[REDACTED]'; // Don't send email as PII
    if (safeTraits.password) delete safeTraits.password;
    
    posthog.identify(userId, safeTraits);
  }
};

export const resetAnalytics = () => {
  if (initialized && posthogKey) {
    posthog.reset();
  }
};

export default {
  init: initAnalytics,
  track: trackEvent,
  identify: identifyUser,
  reset: resetAnalytics,
};
