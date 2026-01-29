import React, { useState } from "react"
import { supabase } from "../lib/supabase"
import { trackEvent } from "../lib/analytics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

interface AuthProps {
  onSuccess: () => void
}

const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Validation states
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  
  // Email validation
  const validateEmail = (value: string): string | null => {
    if (!value) return 'Email is required'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) return 'Please enter a valid email address'
    return null
  }
  
  // Password validation
  const validatePassword = (value: string, isSignUp: boolean): string | null => {
    if (!value) return 'Password is required'
    if (isSignUp) {
      if (value.length < 6) return 'Password must be at least 6 characters'
      if (value.length > 128) return 'Password is too long (max 128 characters)'
    }
    return null
  }
  
  // Name validation
  const validateName = (value: string): string | null => {
    if (!isLogin && !value.trim()) return 'Name is required'
    if (value.length > 100) return 'Name is too long (max 100 characters)'
    return null
  }
  
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    setEmailError(validateEmail(value))
  }
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    setPasswordError(validatePassword(value, !isLogin))
  }
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setName(value)
    setNameError(validateName(value))
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate all fields
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password, !isLogin)
    const nameErr = !isLogin ? validateName(name) : null
    
    setEmailError(emailErr)
    setPasswordError(passwordErr)
    setNameError(nameErr)
    
    if (emailErr || passwordErr || nameErr) {
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        trackEvent('user_login', { method: 'email' });
      } else {
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteUrl}/auth`,
            data: {
              full_name: name,
              name: name
            }
          }
        })
        if (error) throw error
        trackEvent('user_signup', { method: 'email' });
        
        // Send welcome email (non-blocking)
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch(`${apiUrl}/api/auth/welcome-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ name })
            }).catch(err => console.error('Failed to send welcome email:', err));
          }
        } catch (emailErr) {
          // Don't block signup if email fails
          console.error('Welcome email error:', emailErr);
        }
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth`,
        }
      })
      if (error) throw error
      trackEvent('user_login', { method: 'google' });
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter your email address first')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/reset-password`,
      })
      if (error) throw error
      setError(null)
      alert('Password reset email sent! Please check your inbox.')
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Blur background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 -left-20 w-72 h-72 bg-primary rounded-full opacity-20 blur-3xl animate-pulse" />
        <div className="absolute bottom-20 -right-20 w-96 h-96 bg-accent rounded-full opacity-20 blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-secondary rounded-full opacity-10 blur-3xl animate-pulse [animation-delay:2s]" />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md p-8 border-4 border-border shadow-xl bg-card/95 backdrop-blur-sm">
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2 text-center">
              <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
                {isLogin ? "Login" : "Sign Up"}
              </h1>
              <p className="text-muted-foreground font-bold">{isLogin ? "Welcome back!" : "Create your account"}</p>
            </div>

            {error && (
              <div className="p-3 bg-red-100 border-2 border-red-500 text-red-700 text-sm font-bold rounded">
                {error}
              </div>
            )}

            {/* Google Auth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-bold border-4 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all bg-transparent"
              onClick={handleGoogleAuth}
              disabled={isLoading}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-4 border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card font-bold text-muted-foreground uppercase">Or</span>
              </div>
            </div>

            {/* Email Auth Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-bold uppercase">
                    Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={handleNameChange}
                    required={!isLogin}
                    className={`h-12 border-4 border-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${nameError ? 'border-red-500' : ''}`}
                  />
                  {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold uppercase">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  className={`h-12 border-4 border-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${emailError ? 'border-red-500' : ''}`}
                />
                {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-bold uppercase">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className={`h-12 border-4 border-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${passwordError ? 'border-red-500' : ''}`}
                />
                {passwordError && <p className="text-xs text-red-600 mt-1">{passwordError}</p>}
                {!isLogin && password && !passwordError && (
                  <p className="text-xs text-gray-500 mt-1">Password strength: {password.length >= 8 ? 'Strong' : password.length >= 6 ? 'Medium' : 'Weak'}</p>
                )}
              </div>

              {isLogin && (
                <div className="text-right">
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold uppercase border-4 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                disabled={isLoading}
              >
                {isLoading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
              </Button>
            </form>

            {/* Toggle Login/Signup */}
            <div className="text-center pt-4 border-t-4 border-border">
              <p className="text-sm font-bold text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setName("")
                    setEmail("")
                    setPassword("")
                    setError(null)
                    setEmailError(null)
                    setPasswordError(null)
                    setNameError(null)
                  }}
                  className="ml-2 text-primary hover:underline font-black uppercase"
                >
                  {isLogin ? "Sign Up" : "Login"}
                </button>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Auth

