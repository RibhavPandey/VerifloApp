
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Workspace from './components/Workspace';
import Dashboard from './components/Dashboard';
import SpreadsheetView from './components/SpreadsheetView';
import VerificationPage from './components/VerificationPage';
import PricingPage from './components/Pricing';
import Auth from './components/Auth';
import Workflows from './components/Workflows';
import ExtractionSetup from './components/ExtractionSetup';
import Settings from './components/Settings';
import ResetPassword from './components/ResetPassword';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import ContactUs from './components/ContactUs';
import BlogList from './components/BlogList';
import BlogPost from './components/BlogPost';
import AdminPanel from './components/AdminPanel';
import { supabase } from './lib/supabase';
import { ToastProvider } from './components/ui/toast';
import { ThemeProvider } from './components/theme-provider';
import "./globals.css";
const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.warn("Session error:", error);
          // Try to refresh if session exists but is invalid
          if (session) {
            supabase.auth.refreshSession().then(({ data: { session: refreshed } }) => {
              setSession(refreshed);
            });
          }
        } else {
          setSession(session);
        }
      })
      .catch((err) => {
        console.warn("Supabase auth check failed:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle token refresh
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
        setSession(session);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setSession(session);
        // Welcome email for new Google/OAuth signups (no confirmation email for OAuth)
        if (session?.user?.email) {
          const created = new Date(session.user.created_at).getTime();
          const isNewUser = Date.now() - created < 120000;
          const sentKey = `welcome_sent_${session.user.id}`;
          if (isNewUser && !sessionStorage.getItem(sentKey)) {
            sessionStorage.setItem(sentKey, '1');
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
            const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'User';
            fetch(`${apiUrl}/api/auth/signup-welcome-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user.email, name })
            })
              .then(r => { if (!r.ok) console.error('Welcome email failed:', r.status); })
              .catch(err => console.error('Welcome email request failed:', err));
          }
        }
      } else if (event === 'USER_UPDATED') {
        setSession(session);
      } else {
        setSession(session);
      }
    });

    // Set up periodic session refresh (every 30 minutes)
    const refreshInterval = setInterval(async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          // Refresh if session is about to expire (within 5 minutes)
          const expiresAt = currentSession.expires_at;
          if (expiresAt) {
            const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
            if (expiresIn < 300) { // Less than 5 minutes
              const { data: { session: refreshed } } = await supabase.auth.refreshSession();
              if (refreshed) {
                setSession(refreshed);
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to check/refresh session:', error);
      }
    }, 30 * 60 * 1000); // Every 30 minutes

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <ToastProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage onStart={() => window.location.href = '/auth'} onPricing={() => window.location.href = '/pricing'} />} />
          <Route path="/pricing" element={<PricingPage onBack={() => window.location.href = '/'} onStart={() => window.location.href = '/auth'} />} />
          <Route path="/auth" element={
            !session
              ? <Auth onSuccess={() => { const d = new URLSearchParams(window.location.search).get('demo'); window.location.href = d ? '/dashboard?demo=1' : '/dashboard'; }} />
              : <Navigate to={window.location.search.includes('demo=1') ? '/dashboard?demo=1' : '/dashboard'} />
          } />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPost />} />

          {/* Protected Routes (Workspace Layout) */}
          <Route element={
            session ? (
              <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
                <Workspace />
              </ThemeProvider>
            ) : <Navigate to="/auth" />
          }>
             <Route path="/dashboard" element={<DashboardWrapper />} />
             <Route path="/sheet/:id" element={<SpreadsheetView />} />
             <Route path="/workflows" element={<Workflows />} />
             <Route path="/extract/new" element={<ExtractionSetup />} />
             <Route path="/extract/:id/review" element={<VerificationPage />} />
             <Route path="/settings" element={<Settings />} />
             <Route path="/admin" element={<AdminPanel />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

// Wrapper components to handle context passing if needed
const DashboardWrapper = () => {
    return <Dashboard />; 
};

export default App;
