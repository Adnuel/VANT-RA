import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';

interface AdminLoginPageProps {
  onNavigate: (url: string) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onNavigate }) => {
  const { adminUser, loginAdmin } = useAuth();
  const [isSetupNeeded, setIsSetupNeeded] = useState(false);
  const [email, setEmail] = useState('emmanueladarikwu@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If already logged in as admin, redirect to dashboard
    if (adminUser) {
      onNavigate('/admin/dashboard');
      return;
    }

    // Check backend setup status
    fetch('/api/admin/setup-status')
      .then((res) => res.json())
      .then((data) => {
        setIsSetupNeeded(!data.isPasswordSet);
      })
      .catch(() => {});
  }, [adminUser, onNavigate]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters for administrative security.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');

      loginAdmin(data.token, data.user);
      setSuccessMessage('Administrator credentials established successfully. Entering dashboard...');
      setTimeout(() => onNavigate('/admin/dashboard'), 1000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresSetup) {
          setIsSetupNeeded(true);
          throw new Error('Please establish your administrator password first.');
        }
        throw new Error(data.error || 'Authentication failed');
      }

      loginAdmin(data.token, data.user);
      onNavigate('/admin/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#10100f] text-[#f8f7f4] flex flex-col justify-center items-center p-4">
      {/* Brand header */}
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 bg-[#f8f7f4] text-[#121210] flex items-center justify-center font-serif text-xl font-bold mx-auto rounded-xs">
            V
          </div>
          <span className="text-xs uppercase tracking-[0.3em] font-mono text-[#c4a66b] block">
            PRIVATE EXECUTIVE PORTAL
          </span>
          <h1 className="font-serif text-3xl font-normal tracking-tight">
            VANTÉRA CEO Dashboard
          </h1>
          <p className="text-xs text-[#a9a69f] leading-relaxed">
            Restricted exclusively to authorized store leadership:{' '}
            <strong className="text-[#f8f7f4]">Adnuel (emmanueladarikwu@gmail.com)</strong>.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#181816] border border-[#252521] p-8 shadow-2xl rounded-xs space-y-6">
          {errorMessage && (
            <div className="p-3 bg-[#9b1c1c]/20 border border-[#9b1c1c]/50 text-[#f8b4b4] text-xs">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-[#1e7e34]/20 border border-[#1e7e34]/50 text-[#b2f5ea] text-xs">
              {successMessage}
            </div>
          )}

          {isSetupNeeded ? (
            /* Setup password form */
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="bg-[#252521]/60 p-3 border border-[#c4a66b]/30 text-xs text-[#c4a66b]">
                <strong className="block mb-1 text-white">First-Time CEO Security Setup</strong>
                Welcome, Adnuel. Please establish your master password for the private VANTÉRA CEO dashboard.
              </div>

              <div>
                <label className="block text-xs text-[#a9a69f] mb-1 font-mono">Authorized Email</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full bg-[#10100f] border border-[#252521] px-3.5 py-2.5 text-xs text-[#77746d] font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-xs text-[#f8f7f4] mb-1 font-medium">New CEO Password (min. 8 characters)</label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#10100f] border border-[#252521] px-3.5 py-2.5 text-xs text-[#f8f7f4] focus:border-[#c4a66b] focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="admin-confirm-password" className="block text-xs text-[#f8f7f4] mb-1 font-medium">Confirm Password</label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#10100f] border border-[#252521] px-3.5 py-2.5 text-xs text-[#f8f7f4] focus:border-[#c4a66b] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#c4a66b] text-[#121210] py-3 text-xs uppercase tracking-widest font-bold hover:bg-[#e2cfaa] transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Securing Credentials...' : 'Establish Master Password & Enter'}
              </button>
            </form>
          ) : (
            /* Standard Login form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-[#a9a69f] mb-1 font-mono">Authorized Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="emmanueladarikwu@gmail.com"
                  className="w-full bg-[#10100f] border border-[#252521] px-3.5 py-2.5 text-xs text-[#f8f7f4] font-mono focus:border-[#c4a66b] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs text-[#f8f7f4] mb-1 font-medium">CEO Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#10100f] border border-[#252521] px-3.5 py-2.5 text-xs text-[#f8f7f4] focus:border-[#c4a66b] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#c4a66b] text-[#121210] py-3 text-xs uppercase tracking-widest font-bold hover:bg-[#e2cfaa] transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Verifying Authorization...' : 'Access CEO Dashboard'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSetupNeeded(true)}
                  className="text-[11px] text-[#77746d] hover:text-[#c4a66b] transition-colors"
                >
                  Need to initialize password? Click here
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-[#252521] pt-4 text-center">
            <button
              onClick={() => onNavigate('/')}
              className="text-xs text-[#77746d] hover:text-[#f8f7f4] transition-colors"
            >
              ← Return to Customer Storefront
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
