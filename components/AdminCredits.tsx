import React, { useState, useEffect } from 'react';
import { adminApi } from '../lib/admin';
import { useToast } from './ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Coins, Plus, Minus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  credits: number;
}

const AdminCredits: React.FC = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      addToast('error', 'Error', error.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCredits = async (add: boolean) => {
    if (!selectedUserId || !creditAmount) {
      addToast('error', 'Validation Error', 'Please select a user and enter credit amount');
      return;
    }

    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast('error', 'Validation Error', 'Please enter a valid positive number');
      return;
    }

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      if (!selectedUser) {
        addToast('error', 'Error', 'User not found');
        return;
      }

      const newCredits = add
        ? selectedUser.credits + amount
        : Math.max(0, selectedUser.credits - amount);

      await adminApi.updateUserCredits(selectedUserId, newCredits);
      addToast('success', 'Success', `Credits ${add ? 'added' : 'removed'} successfully`);
      setCreditAmount('');
      await loadUsers();
    } catch (error: any) {
      addToast('error', 'Error', error.message || 'Failed to update credits');
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
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Credit Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user">Select User</Label>
            <select
              id="user"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} (Current: {user.credits || 0} credits)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Credit Amount</Label>
            <Input
              id="amount"
              type="number"
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Enter amount"
              min="1"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => handleUpdateCredits(true)}
              disabled={!selectedUserId || !creditAmount}
              className="flex-1"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Credits
            </Button>
            <Button
              onClick={() => handleUpdateCredits(false)}
              disabled={!selectedUserId || !creditAmount}
              variant="outline"
              className="flex-1"
            >
              <Minus className="w-4 h-4 mr-2" />
              Remove Credits
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Users Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">{user.email}</span>
                <span className="text-sm font-medium">{user.credits || 0} credits</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCredits;
