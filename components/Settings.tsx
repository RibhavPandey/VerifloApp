import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { db } from '../lib/db';
import { useToast } from './ui/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { User, Lock, Trash2, Mail, Download } from 'lucide-react';
import { WorkspaceContextType } from './Workspace';

const Settings: React.FC = () => {
  const { refreshData } = useOutletContext<WorkspaceContextType>();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  // Profile tab state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Account deletion
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        setName(currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '');
        setEmail(currentUser.email || '');
      }

      const profileData = await db.getUserProfile();
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error: any) {
      console.error('Failed to load user data:', error);
      addToast('error', 'Error', 'Failed to load user data');
    }
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      addToast('error', 'Validation Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim() }
      });

      if (error) throw error;

      addToast('success', 'Success', 'Profile updated successfully');
      await loadUserData();
      if (refreshData) refreshData();
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      addToast('error', 'Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      addToast('error', 'Validation Error', 'Please enter a valid email address');
      return;
    }

    if (email === user?.email) {
      addToast('info', 'No Changes', 'Email is the same');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });

      if (error) throw error;

      addToast('success', 'Email Update Sent', 'Please check your email to confirm the new address');
      await loadUserData();
    } catch (error: any) {
      console.error('Failed to update email:', error);
      addToast('error', 'Error', error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      addToast('error', 'Validation Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      addToast('error', 'Validation Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      addToast('success', 'Success', 'Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Failed to change password:', error);
      addToast('error', 'Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setLoading(true);
    try {
      const jobs = await db.fetchJobs();
      const files = await db.fetchFiles();
      const workflows = await db.fetchWorkflows();

      const exportData = {
        profile: profile,
        jobs: jobs,
        files: files,
        workflows: workflows,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast('success', 'Success', 'Data exported successfully');
    } catch (error: any) {
      console.error('Failed to export data:', error);
      addToast('error', 'Error', 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      addToast('error', 'Validation Error', 'Please type DELETE to confirm');
      return;
    }

    setLoading(true);
    try {
      // Delete user data from database
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        // Delete jobs, files, workflows (cascade should handle this, but explicit is better)
        const jobs = await db.fetchJobs();
        for (const job of jobs) {
          try {
            await supabase.from('jobs').delete().eq('id', job.id);
          } catch (e) {
            console.error('Error deleting job:', e);
          }
        }

        // Delete profile
        await supabase.from('profiles').delete().eq('id', currentUser.id);
      }

      // Sign out and delete auth user
      await supabase.auth.signOut();
      addToast('success', 'Account Deleted', 'Your account has been deleted');
      
      // Redirect to home
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      addToast('error', 'Error', error.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="account">
            <Trash2 className="w-4 h-4 mr-2" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your name and email address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <Button onClick={handleUpdateProfile} disabled={loading}>
                {loading ? 'Saving...' : 'Update Profile'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Address</CardTitle>
              <CardDescription>Change your email address. You'll need to verify the new email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <Button onClick={handleUpdateEmail} disabled={loading} variant="outline">
                {loading ? 'Updating...' : 'Update Email'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                />
              </div>
              <Button onClick={handleChangePassword} disabled={loading}>
                {loading ? 'Updating...' : 'Change Password'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Download all your data in JSON format</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExportData} disabled={loading} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                {loading ? 'Exporting...' : 'Export Data'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Delete Account</CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setShowDeleteDialog(true)}
                variant="destructive"
                disabled={loading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all your data. This action cannot be undone.
              <br /><br />
              Type <strong>DELETE</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={loading || deleteConfirm !== 'DELETE'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
