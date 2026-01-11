
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
import { supabase } from './lib/supabase';
import { ToastProvider } from './components/ui/toast';
import "./globals.css";
const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .catch((err) => {
        console.warn("Supabase auth check failed:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage onStart={() => window.location.href = '/auth'} onPricing={() => window.location.href = '/pricing'} />} />
          <Route path="/pricing" element={<PricingPage onBack={() => window.location.href = '/'} onStart={() => window.location.href = '/auth'} />} />
          <Route path="/auth" element={!session ? <Auth onSuccess={() => window.location.href = '/dashboard'} /> : <Navigate to="/dashboard" />} />

          {/* Protected Routes (Workspace Layout) */}
          <Route element={session ? <Workspace /> : <Navigate to="/auth" />}>
             <Route path="/dashboard" element={<DashboardWrapper />} />
             <Route path="/sheet/:id" element={<SpreadsheetView />} />
             <Route path="/workflows" element={<Workflows />} />
             <Route path="/extract/new" element={<ExtractionSetup />} />
             <Route path="/extract/:id/review" element={<VerificationPage />} />
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
