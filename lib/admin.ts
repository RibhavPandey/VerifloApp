// Admin API utilities
import { supabase } from './supabase';
import { fetchWithRetry } from './network';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
};

export const adminApi = {
  // Check if current user is admin
  async isAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      
      return profile?.is_admin === true;
    } catch (error) {
      console.error('Failed to check admin status:', error);
      return false;
    }
  },

  // Get all users
  async getUsers(): Promise<any[]> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(`${API_URL}/api/admin/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    return response.json();
  },

  // Update user credits
  async updateUserCredits(userId: string, credits: number): Promise<void> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(`${API_URL}/api/admin/users/${userId}/credits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credits }),
    });

    if (!response.ok) {
      throw new Error('Failed to update credits');
    }
  },

  // Suspend/unsuspend user
  async toggleUserSuspension(userId: string, suspended: boolean): Promise<void> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(`${API_URL}/api/admin/users/${userId}/suspend`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ suspended }),
    });

    if (!response.ok) {
      throw new Error('Failed to update user status');
    }
  },

  // Get system analytics
  async getAnalytics(): Promise<any> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(`${API_URL}/api/admin/analytics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }

    return response.json();
  },

  // Get system health
  async getSystemHealth(): Promise<any> {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetchWithRetry(`${API_URL}/api/admin/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch system health');
    }

    return response.json();
  },
};
