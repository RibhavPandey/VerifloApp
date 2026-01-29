import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../lib/admin';
import { useToast } from './ui/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Shield, Users, Coins, BarChart3, Heart, AlertCircle } from 'lucide-react';
import AdminUsers from './AdminUsers';
import AdminCredits from './AdminCredits';
import AdminAnalytics from './AdminAnalytics';
import AdminSupport from './AdminSupport';

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    checkAdminAccess();
    loadSystemHealth();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const admin = await adminApi.isAdmin();
      setIsAdmin(admin);
      if (!admin) {
        addToast('error', 'Access Denied', 'You do not have admin privileges');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Admin check error:', error);
      addToast('error', 'Error', 'Failed to verify admin access');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemHealth = async () => {
    try {
      const health = await adminApi.getSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return null; // Will redirect
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage users, credits, and system settings</p>
        </div>
        {systemHealth && (
          <div className="flex items-center gap-2">
            {systemHealth.status === 'healthy' ? (
              <Heart className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span className="text-sm font-medium">
              System: {systemHealth.status}
            </span>
          </div>
        )}
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="credits">
            <Coins className="w-4 h-4 mr-2" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="support">
            <Shield className="w-4 h-4 mr-2" />
            Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="credits">
          <AdminCredits />
        </TabsContent>

        <TabsContent value="analytics">
          <AdminAnalytics />
        </TabsContent>

        <TabsContent value="support">
          <AdminSupport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPanel;
