// API utility functions
import { supabase } from './supabase';
import { fetchWithRetry, isOnline } from './network';
import { trackEvent } from './analytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to get auth token
const getAuthToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

// Helper to handle API errors with better messages
const handleApiError = async (response: Response, defaultMessage: string): Promise<never> => {
  let errorMessage = defaultMessage;
  
  // Check if offline
  if (!isOnline()) {
    throw new Error('You are currently offline. Please check your internet connection and try again.');
  }
  
  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      errorMessage = `Rate limit exceeded. Please try again in ${retryAfter} seconds.`;
    } else {
      errorMessage = 'Rate limit exceeded. Please slow down and try again.';
    }
    throw new Error(errorMessage);
  }
  
  // Handle authentication errors
  if (response.status === 401) {
    throw new Error('Your session has expired. Please log in again.');
  }
  
  // Try to parse error message from response
  try {
    const errorText = await response.text();
    if (errorText) {
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
    }
  } catch {
    errorMessage = `${defaultMessage} (Status: ${response.status})`;
  }
  
  throw new Error(errorMessage);
};

export const api = {
  extract: async (file: string, fields: string[], fileType: string, fileName?: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(
      `${API_URL}/api/extract`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ file, fields, fileType, fileName })
      },
      { maxRetries: 2, retryDelay: 2000 } // Extract is expensive, fewer retries
    );
    
    if (!response.ok) {
      await handleApiError(response, 'Extraction failed');
    }
    
    const result = await response.json();
    trackEvent('api_call', { endpoint: 'extract', success: true });
    return result;
  },

  enrich: async (entities: any[], prompt: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(
      `${API_URL}/api/enrich`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ entities, prompt })
      }
    );
    
    if (!response.ok) {
      await handleApiError(response, 'Enrichment failed');
    }
    
    return response.json();
  },

  analyze: async (query: string, fileContext: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(
      `${API_URL}/api/analyze`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query, fileContext })
      }
    );
    
    if (!response.ok) {
      await handleApiError(response, 'Analysis failed');
    }
    
    const result = await response.json();
    trackEvent('api_call', { endpoint: 'analyze', success: true });
    return result;
  },

  chat: async function* (prompt: string, fileContext: string, history: any[], isDataMode: boolean) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    let response: Response;
    try {
      response = await fetchWithRetry(
        `${API_URL}/api/chat/stream`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ prompt, fileContext, history, isDataMode })
        },
        { maxRetries: 2 } // Streaming has fewer retries
      );
    } catch (error: any) {
      // Handle network errors before checking response
      if (!isOnline()) {
        throw new Error('You are currently offline. Please check your internet connection.');
      }
      throw error;
    }

    if (!response.ok) {
      await handleApiError(response, 'Chat failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('Failed to get response stream');

    let buffer = '';
    let hasReceivedData = false;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!hasReceivedData) {
            throw new Error('No data received from server. The connection may have been interrupted.');
          }
          break;
        }

        hasReceivedData = true;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.done) return;
              yield data.text || '';
            } catch (e: any) {
              // If it's an error from the server, throw it
              if (e.message && e.message !== 'Unexpected end of JSON input') {
                throw e;
              }
              // Otherwise skip invalid JSON (partial chunks)
            }
          }
        }
      }
    } catch (error: any) {
      // Clean up reader on error
      try {
        reader.cancel();
      } catch {
        // Ignore cancel errors
      }
      throw error;
    }
  }
};
