import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/admin';
import { useToast } from './ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Users, Search, RefreshCw } from 'lucide-react';

interface User {
  id: string;
  email: string;
  credits: number;
  is_admin: boolean;
  subscription_plan: string;
  created_at: string;
}

const AdminUsers: React.FC = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(
        user =>
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          user.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      addToast('error', 'Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (userId: string, suspended: boolean) => {
    try {
      await adminApi.toggleUserSuspension(userId, suspended);
      addToast('success', 'Success', `User ${suspended ? 'suspended' : 'unsuspended'}`);
      await loadUsers();
    } catch (error: any) {
      addToast('error', 'Error', error.message || 'Failed to update user status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading users...</p>
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
              <Users className="w-5 h-5" />
              User Management ({filteredUsers.length})
            </CardTitle>
            <Button onClick={loadUsers} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by email or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Credits</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Plan</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Admin</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-4 py-3 text-sm">{user.email}</td>
                      <td className="px-4 py-3 text-sm font-medium">{user.credits || 0}</td>
                      <td className="px-4 py-3 text-sm">{user.subscription_plan || 'free'}</td>
                      <td className="px-4 py-3 text-sm">
                        {user.is_admin ? (
                          <span className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">Admin</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuspend(user.id, true)}
                        >
                          Suspend
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
