// API utility functions
import { supabase } from './supabase';

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

export const api = {
  extract: async (file: string, fields: string[], fileType: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/extract`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ file, fields, fileType })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Extraction failed');
    }
    return response.json();
  },

  enrich: async (entities: any[], prompt: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/enrich`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ entities, prompt })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Enrichment failed');
    }
    return response.json();
  },

  analyze: async (query: string, fileContext: string) => {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ query, fileContext })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }
    return response.json();
  },

  chat: async function* (prompt: string, fileContext: string, history: any[], isDataMode: boolean) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ prompt, fileContext, history, isDataMode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chat failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('Failed to get response stream');

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) throw new Error(data.error);
            if (data.done) return;
            yield data.text || '';
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }
};
