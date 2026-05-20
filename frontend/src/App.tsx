import { useEffect, useMemo, useState } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { AdminPage } from './components/AdminPage';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { toast, Toaster } from 'sonner';
import { useAppDispatch, useAppSelector } from './store/hooks';
import loginVideo from './assets/login.mp4';
import {
  clearAuthError,
  fetchMe,
  login,
  logout,
  selectAuthError,
  selectAuthLoading,
  selectAuthToken,
  selectAuthUser,
  signup,
} from './store/authSlice';
import { unwrapResult } from '@reduxjs/toolkit';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { UnauthorizedPage } from './components/UnauthorizedPage';
import { canAccessAdminArea } from './auth/rbac';
import { Checkbox } from './components/ui/checkbox';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function App() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const user = useAppSelector(selectAuthUser);
  const authLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!token || user) return;
    void dispatch(fetchMe());
  }, [dispatch, token, user]);

  useEffect(() => {
    if (!authError) return;
    toast.error(authError);
  }, [authError]);

  const submitAuth = async () => {
    if (mode === 'signup') {
      await dispatch(signup({ name, email, password }));
    } else {
      await dispatch(login({ email, password }));
    }
    setPassword('');
  };

  const formTitle = useMemo(() => (isSignup ? 'Create account' : 'Welcome back'), [isSignup]);
  const formSubtitle = useMemo(
    () => (isSignup ? 'Create an account to start using your workspace' : 'Log in to continue to your workspace'),
    [isSignup],
  );

  if (token && !user && authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-sm text-gray-600">Restoring session...</div>
        <Toaster richColors position="top-right" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-screen w-full bg-white overflow-hidden">
        <div className="hidden lg:block lg:w-[50%] h-screen shrink-0 relative overflow-hidden border-r border-[#fdfdfd]">
          <video
            className="absolute inset-0 size-full min-w-full min-h-full object-cover object-center"
            src={loginVideo}
            autoPlay
            muted
            loop
            playsInline
          />
        </div>

        <div className="w-full lg:w-[50%] flex items-center justify-center p-8 bg-white z-10">
          <div className="w-full max-w-[400px] space-y-8">
            <div className="space-y-2 text-center lg:text-left">
              <h1 className="text-[28px] font-bold text-heading leading-[34px]">
                {formTitle}
              </h1>
              <p className="text-sm text-subtitle mt-1">{formSubtitle}</p>
            </div>

            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                void submitAuth();
              }}
            >
              <div className="space-y-4">
                {isSignup && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700" htmlFor="name">
                      Name
                    </label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="email">
                    Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 transition-colors">
                      <Mail className="size-4" />
                    </div>
                    <Input
                      id="email"
                      type="text"
                      placeholder="Enter your email or username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700" htmlFor="password">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 transition-colors">
                      <Lock className="size-4" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline transition-colors"
                      onClick={() => toast.info('Forgot password is not implemented yet.')}
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline transition-all"
                      onClick={() => {
                        setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
                        setIsAdminLogin(false);
                        dispatch(clearAuthError());
                      }}
                    >
                      {isSignup ? 'Have an account? Sign in' : 'Need an account? Sign up'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Checkbox id="remember" />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none text-gray-600 cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                type="submit"
                disabled={authLoading}
              >
                {authLoading ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
              </Button>
            </form>

            {!isSignup && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">or</div>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    setIsAdminLogin(true);
                    setEmail('admin@gmail.com');
                    setPassword('admin123');
                    dispatch(clearAuthError());
                    try {
                      const resultAction = await dispatch(
                        login({ email: 'admin@gmail.com', password: 'admin123' }),
                      );
                      const payload = unwrapResult(resultAction);
                      if (canAccessAdminArea(payload.user.permissions)) {
                        toast.success('Admin access granted');
                      }
                    } catch {
                      // Error toast is already handled by authError effect.
                    }
                  }}
                  disabled={authLoading}
                >
                  Login as Admin
                </Button>
              </div>
            )}

            <div className="pt-8 border-t border-gray-100 text-center">
              <p className="mt-6 text-xs text-gray-500">
                Copyright © {new Date().getFullYear()}. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        <Toaster richColors position="top-right" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route
          path="/"
          element={<KanbanBoard onOpenAdmin={() => navigate('/admin')} />}
        />
        <Route
          path="/admin"
          element={
            !user ? (
              <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="text-sm text-gray-600">Restoring session...</div>
              </div>
            ) : canAccessAdminArea(user.permissions) ? (
              <AdminPage
                token={token}
                onBackToBoard={() => navigate('/')}
                onLogout={() => {
                  dispatch(logout());
                  navigate('/');
                }}
              />
            ) : (
              <UnauthorizedPage onGoHome={() => navigate('/')} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </div>
  );
}