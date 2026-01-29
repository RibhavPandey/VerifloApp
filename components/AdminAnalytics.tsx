import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/admin';
import { useToast } from './ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { BarChart3, Users, Coins, FileSpreadsheet, RefreshCw } from 'lucide-react';

const AdminAnalytics: React.FC = () => {
  const { addToast } = useToast();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAnalytics();
      setAnalytics(data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      addToast('error', 'Error', error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              System Analytics
            </CardTitle>
            <Button onClick={loadAnalytics} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium text-muted-foreground">Total Users</span>
                </div>
                <p className="text-3xl font-bold">{analytics.users || 0}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium text-muted-foreground">Total Credits</span>
                </div>
                <p className="text-3xl font-bold">{analytics.totalCredits || 0}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-muted-foreground">Total Jobs</span>
                </div>
                <p className="text-3xl font-bold">{analytics.jobs || 0}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No analytics data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
