import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';
import { clientAuthFallback } from '../lib/clientAuthFallback.ts';

interface AccountPageProps {
  onNavigate: (url: string) => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate, initialMode }) => {
  const { user, token, loginCustomer, logoutCustomer, updateUser } = useAuth();

  // Mode: 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>(
    initialMode === 'register' ? 'register' : 'login'
  );
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'addresses'>('orders');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync mode with prop or URL search parameters (e.g. /account?mode=register)
  useEffect(() => {
    if (initialMode && ['login', 'register', 'forgot'].includes(initialMode)) {
      setAuthMode(initialMode);
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'register') {
        setAuthMode('register');
      } else if (modeParam === 'login') {
        setAuthMode('login');
      }
    } catch {}
  }, [initialMode]);

  // Customer data
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);

  // New address form
  const [newAddress, setNewAddress] = useState({
    fullName: '',
    phone: '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
    isDefault: true,
  });
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  // Payment proof modal
  const [paymentProofNotes, setPaymentProofNotes] = useState('');
  const [proofOrderRef, setProofOrderRef] = useState<string | null>(null);

  // Load customer orders & addresses if logged in
  useEffect(() => {
    if (!token && !user) return;

    // Load customer's own orders
    if (token) {
      safeFetchJson<{ orders: any[] }>('/api/customer/orders', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok && res.data?.orders && Array.isArray(res.data.orders)) {
          setOrders(res.data.orders);
        } else if (user) {
          const localOrders = clientAuthFallback.getOrders(user.id, user.email);
          setOrders(localOrders);
        }
      });

      // Load customer's addresses
      safeFetchJson<{ addresses: any[] }>('/api/customer/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok && res.data?.addresses && Array.isArray(res.data.addresses)) {
          setAddresses(res.data.addresses);
        } else if (user) {
          const localAddrs = clientAuthFallback.getAddresses(user.id);
          setAddresses(localAddrs);
        }
      });
    } else if (user) {
      const localOrders = clientAuthFallback.getOrders(user.id, user.email);
      setOrders(localOrders);
      const localAddrs = clientAuthFallback.getAddresses(user.id);
      setAddresses(localAddrs);
    }
  }, [token, user]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter your email and password.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Try server endpoint first
      const result = await safeFetchJson<{ token?: string; user?: any; error?: string }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (result.ok && result.data?.token && result.data?.user) {
        loginCustomer(result.data.token, result.data.user);
        setSuccessMessage('Logged in successfully');
        return;
      }

      // If server explicitly returned a business error (e.g. 401 with message)
      if (result.status === 401 && result.data?.error) {
        // Double-check local fallback
        const fallback = clientAuthFallback.login(cleanEmail, password);
        if (fallback.success && fallback.token && fallback.user) {
          loginCustomer(fallback.token, fallback.user as any);
          setSuccessMessage('Logged in successfully');
          return;
        }
        setErrorMessage(result.data.error);
        return;
      }

      // 2. Client fallback for static hosting / offline / 404 / 405
      const fallback = clientAuthFallback.login(cleanEmail, password);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Logged in successfully');
        return;
      }

      setErrorMessage(fallback.error || 'Invalid email or password. Please verify your credentials.');
    } catch {
      const fallback = clientAuthFallback.login(cleanEmail, password);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Logged in successfully');
        return;
      }
      setErrorMessage('Invalid email or password. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Open Account / Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanEmail || !password) {
      setErrorMessage('Please fill in your name, email, and password.');
      setIsSubmitting(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      setIsSubmitting(false);
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both passwords match.');
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Send registration to server API
      const result = await safeFetchJson<{ token?: string; user?: any; error?: string }>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
          phone: cleanPhone,
        }),
      });

      if (result.ok && result.data?.token && result.data?.user) {
        clientAuthFallback.register(cleanName, cleanEmail, password, cleanPhone);
        loginCustomer(result.data.token, result.data.user);
        setSuccessMessage('Your VANTÉRA client account has been opened successfully! Welcome.');
        return;
      }

      // If server returned a business error (e.g. email exists)
      if (result.data?.error && result.status === 400) {
        setErrorMessage(result.data.error);
        return;
      }

      // 2. Resilient Client Fallback (on 404, 405, 500 or static hosting)
      const fallback = clientAuthFallback.register(cleanName, cleanEmail, password, cleanPhone);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Your VANTÉRA client account has been opened successfully! Welcome.');
        return;
      }

      setErrorMessage(fallback.error || 'An account with this email already exists. Please sign in.');
    } catch {
      const fallback = clientAuthFallback.register(cleanName, cleanEmail, password, cleanPhone);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Your VANTÉRA client account has been opened successfully! Welcome.');
        return;
      }
      setErrorMessage(fallback.error || 'Unable to open account. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await safeFetchJson<{ message?: string; error?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (result.ok && result.data?.message) {
        setSuccessMessage(result.data.message);
      } else {
        setSuccessMessage('If an account exists with this email, recovery instructions have been dispatched.');
      }
    } catch {
      setSuccessMessage('If an account exists with this email, recovery instructions have been dispatched.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const cleanName = (name || user?.name || '').trim();
      const cleanPhone = (phone !== '' ? phone : user?.phone || '').trim();

      const result = await safeFetchJson<{ user: any }>('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: cleanName, phone: cleanPhone }),
      });

      if (result.ok && result.data?.user) {
        updateUser(result.data.user);
        setSuccessMessage('Profile updated successfully');
      } else if (user) {
        const updated = clientAuthFallback.updateProfile(user.id, { name: cleanName, phone: cleanPhone });
        if (updated) {
          updateUser(updated as any);
          setSuccessMessage('Profile updated successfully');
        } else {
          setErrorMessage('Profile update could not be saved.');
        }
      }
    } catch {
      setErrorMessage('Profile update encountered a temporary issue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Address
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await safeFetchJson<{ address: any }>('/api/customer/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(newAddress),
      });

      if (result.ok && result.data?.address) {
        setAddresses((prev) => [...prev, result.data!.address]);
        setIsAddingAddress(false);
      } else if (user) {
        const updatedAddrs = clientAuthFallback.saveAddress(user.id, newAddress);
        setAddresses(updatedAddrs);
        setIsAddingAddress(false);
      }

      setNewAddress({
        fullName: '',
        phone: '',
        streetAddress: '',
        apartment: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'Nigeria',
        isDefault: false,
      });
    } catch {
      if (user) {
        const updatedAddrs = clientAuthFallback.saveAddress(user.id, newAddress);
        setAddresses(updatedAddrs);
        setIsAddingAddress(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      if (token) {
        await safeFetchJson(`/api/customer/addresses/${addressId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (user) {
        clientAuthFallback.deleteAddress(user.id, addressId);
      }
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    } catch {
      if (user) {
        clientAuthFallback.deleteAddress(user.id, addressId);
        setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      }
    }
  };

  // Submit payment proof note
  const handleSubmitPaymentProof = async () => {
    if (!proofOrderRef || !paymentProofNotes.trim()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await safeFetchJson('/api/orders/payment-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference: proofOrderRef,
          notes: paymentProofNotes.trim(),
        }),
      });

      setSuccessMessage('Payment verification reference submitted. CEO Adnuel has been notified.');
      setProofOrderRef(null);
      setPaymentProofNotes('');

      // Reload orders
      if (token) {
        safeFetchJson<{ orders: any[] }>('/api/customer/orders', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => {
          if (r.ok && r.data?.orders) setOrders(r.data.orders);
        });
      }
    } catch {
      setErrorMessage('Unable to submit transfer reference at this time.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-3.5 py-6 space-y-6 font-sans">
      {/* If Not Logged In: Show Authentication Card */}
      {!user ? (
        <div className="w-full border border-white/5 bg-[#121212] p-5 rounded-xs shadow-sm space-y-5">
          <div className="text-center space-y-1.5 mb-2">
            <div className="w-8 h-8 gold-gradient-bg text-[#0B0B0B] flex items-center justify-center font-editorial text-sm font-bold mx-auto rounded-xs">
              V
            </div>
            <h1 className="font-editorial text-xl font-bold text-[#F8F7F4] break-words">
              {authMode === 'login' && 'Sign In to VANTÉRA'}
              {authMode === 'register' && 'Open Client Account'}
              {authMode === 'forgot' && 'Reset Password'}
            </h1>
            <p className="text-[11px] text-[#8E8B82] font-light break-words">
              {authMode === 'login' && 'Access saved shipping details and track your luxury orders.'}
              {authMode === 'register' && 'Create your personal client account for seamless checkout and tracking.'}
              {authMode === 'forgot' && 'Enter your email to receive recovery instructions.'}
            </p>
          </div>

          {/* Dual Mode Switcher: Sign In vs Open Client Account */}
          <div className="grid grid-cols-2 p-1 bg-[#181818] border border-white/10 rounded-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 text-[11px] font-meta uppercase tracking-wider font-semibold rounded-xs transition-colors cursor-pointer ${
                authMode === 'login'
                  ? 'gold-gradient-bg text-[#0B0B0B]'
                  : 'text-[#A9A69F] hover:text-[#EDEDED]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 text-[11px] font-meta uppercase tracking-wider font-semibold rounded-xs transition-colors cursor-pointer ${
                authMode === 'register'
                  ? 'gold-gradient-bg text-[#0B0B0B]'
                  : 'text-[#A9A69F] hover:text-[#EDEDED]'
              }`}
            >
              Open Account
            </button>
          </div>

          {errorMessage && !errorMessage.includes('405') && !errorMessage.includes('No response body') && !errorMessage.includes('JSON') && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs break-words">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-[#0F2E22] border border-[#34A853]/30 text-[#48BB78] text-xs rounded-xs break-words">
              {successMessage}
            </div>
          )}

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col justify-between min-h-[320px] w-full">
              <div className="flex-1 space-y-3.5 pb-4">
                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-meta uppercase tracking-wider text-[#A9A69F]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setErrorMessage('');
                      }}
                      className="text-[10px] text-[#8E8B82] hover:text-[#D4AF37] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/10 space-y-3 w-full">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#D4AF37] hover:bg-[#E5C158] active:bg-[#B89326] text-[#0B0B0B] py-3.5 px-4 text-xs uppercase tracking-widest font-meta font-black rounded-xs shadow-[0_4px_25px_rgba(212,175,55,0.45)] hover:shadow-[0_6px_30px_rgba(212,175,55,0.6)] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'SIGNING IN...' : 'SIGN IN'}</span>
                  <span className="text-sm font-bold">→</span>
                </button>

                <div className="text-center text-[11px] text-[#8E8B82]">
                  New client?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-medium text-[#D4AF37] underline hover:text-[#E5C158] cursor-pointer"
                  >
                    Open an account now
                  </button>
                </div>
              </div>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col justify-between min-h-[480px] w-full">
              {/* Top Form Fields Container (flex-1) */}
              <div className="flex-1 space-y-3.5 pb-4">
                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Phone / WhatsApp (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08123456789"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Password (min. 6 characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>
              </div>

              {/* Dedicated Bottom Container Anchoring the Action Button via Flexbox */}
              <div className="mt-auto pt-4 border-t border-white/10 space-y-3 w-full">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#D4AF37] hover:bg-[#E5C158] active:bg-[#B89326] text-[#0B0B0B] py-3.5 px-4 text-xs uppercase tracking-widest font-meta font-black rounded-xs shadow-[0_4px_25px_rgba(212,175,55,0.45)] hover:shadow-[0_6px_30px_rgba(212,175,55,0.6)] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}</span>
                  <span className="text-sm font-bold">→</span>
                </button>

                <div className="text-center text-[11px] text-[#8E8B82]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-medium text-[#D4AF37] underline hover:text-[#E5C158] cursor-pointer"
                  >
                    Sign in here
                  </button>
                </div>
              </div>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                  Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-2.5 text-xs uppercase tracking-wider font-meta font-bold rounded-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Sending...' : 'Send Recovery Instructions'}
              </button>

              <div className="text-center pt-3 border-t border-white/5 text-[11px] text-[#8E8B82]">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                  }}
                  className="font-medium text-[#D4AF37] underline cursor-pointer"
                >
                  Return to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* If Logged In: Customer Portal */
        <div className="space-y-6">
          {/* Header */}
          <div className="border border-white/5 bg-[#121212] p-5 rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-[9px] uppercase tracking-widest font-mono text-[#D4AF37] block">
                CLIENT ATELIER ACCOUNT
              </span>
              <h1 className="font-editorial text-2xl font-bold text-[#F8F7F4]">
                Welcome, {user.name}
              </h1>
              <p className="text-xs text-[#8E8B82] mt-0.5 font-mono">
                {user.email} {user.phone ? `· ${user.phone}` : ''}
              </p>
            </div>
            <button
              onClick={logoutCustomer}
              className="px-4 py-2 text-xs border border-white/10 text-[#EDEDED] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors rounded-xs cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 gap-6 text-xs">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 uppercase tracking-wider font-meta font-semibold transition-colors cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              My Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 uppercase tracking-wider font-meta font-semibold transition-colors cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`pb-3 uppercase tracking-wider font-meta font-semibold transition-colors cursor-pointer ${
                activeTab === 'addresses'
                  ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              Saved Addresses ({addresses.length})
            </button>
          </div>

          {/* Tab 1: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="border border-white/5 bg-[#121212] p-10 text-center space-y-3 rounded-xs">
                  <div className="font-editorial text-3xl text-[#D4AF37]">V</div>
                  <h3 className="font-editorial text-base text-[#F8F7F4]">No orders placed yet</h3>
                  <p className="text-xs text-[#8E8B82]">
                    Your past purchases and bank transfer verifications will be tracked here.
                  </p>
                  <button
                    onClick={() => onNavigate('/shop')}
                    className="gold-gradient-bg text-[#0B0B0B] px-5 py-2 text-xs uppercase tracking-wider font-meta font-bold rounded-xs hover:opacity-90 cursor-pointer"
                  >
                    Explore Finds
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const isPaid = order.paymentStatus === 'paid';
                    const isAwaiting = order.paymentStatus === 'awaiting_verification';

                    return (
                      <div
                        key={order.id || order.orderReference}
                        className="border border-white/5 bg-[#121212] p-4 space-y-3 rounded-xs hover:border-white/10 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                          <div>
                            <span className="font-mono text-xs font-bold text-[#D4AF37]">
                              {order.orderReference}
                            </span>
                            <span className="text-[11px] text-[#8E8B82] ml-3">
                              Placed {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded-xs ${
                                isPaid
                                  ? 'bg-[#0F2E22] text-[#48BB78] border border-[#34A853]/30'
                                  : isAwaiting
                                  ? 'bg-[#182635] text-[#63B3ED] border border-[#3182CE]/30'
                                  : 'bg-[#2D2412] text-[#D4AF37] border border-[#D4AF37]/30'
                              }`}
                            >
                              Payment: {order.paymentStatus ? order.paymentStatus.replace('_', ' ') : 'pending'}
                            </span>

                            <span className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-[#181818] text-[#EDEDED] border border-white/10 rounded-xs">
                              Status: {order.fulfilmentStatus || 'processing'}
                            </span>
                          </div>
                        </div>

                        {/* Items in order */}
                        <div className="divide-y divide-white/5">
                          {(order.items || []).map((item: any, i: number) => (
                            <div key={i} className="py-2 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-10 h-10 object-contain bg-[#181818] p-1 border border-white/5 rounded-xs"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-[#181818] border border-white/5 flex items-center justify-center font-editorial text-xs text-[#D4AF37]">
                                    V
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-[#F8F7F4]">{item.title}</p>
                                  <p className="text-[10px] text-[#8E8B82]">Qty: {item.quantity}</p>
                                </div>
                              </div>
                              <span className="font-semibold text-[#D4AF37]">{formatUSD(item.totalCents || 0)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Tracking info if dispatched */}
                        {order.trackingNumber && (
                          <div className="bg-[#181818] border border-white/10 p-3 text-xs space-y-1 rounded-xs">
                            <span className="font-semibold text-[#D4AF37] uppercase tracking-wide text-[10px] block">
                              📦 Shipment Dispatched ({order.carrier || 'Standard Courier'})
                            </span>
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[#EDEDED]">Tracking #{order.trackingNumber}</span>
                              {order.trackingUrl && (
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#D4AF37] underline hover:text-white"
                                >
                                  Track Carrier Package →
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Order Summary footer */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs border-t border-white/5">
                          <span className="text-[#8E8B82]">
                            Total Amount:{' '}
                            <strong className="text-[#F8F7F4] font-bold text-sm">
                              {order.currency === 'NGN'
                                ? formatNGN(convertUsdCentsToNgn(order.totalCents || 0, order.exchangeRateUsed || 1500))
                                : formatUSD(order.totalCents || 0)}
                            </strong>
                          </span>

                          <div className="flex items-center gap-2">
                            {order.paymentStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProofOrderRef(order.orderReference);
                                  setPaymentProofNotes(order.paymentProofNotes || '');
                                }}
                                className="bg-[#181818] border border-white/10 text-[#F8F7F4] px-3.5 py-1.5 text-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors rounded-xs cursor-pointer"
                              >
                                Submit Transfer Ref
                              </button>
                            )}

                            <a
                              href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                                `Hello CEO Adnuel, checking on order ${order.orderReference}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#48BB78] border border-[#34A853]/30 bg-[#0F2E22] px-3 py-1.5 rounded-xs hover:bg-[#153e2f] transition-colors"
                            >
                              WhatsApp Concierge
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Profile */}
          {activeTab === 'profile' && (
            <div className="border border-white/5 bg-[#121212] p-5 rounded-xs space-y-4 max-w-xl">
              <h3 className="font-editorial text-base text-[#F8F7F4] border-b border-white/5 pb-2">
                Personal Details
              </h3>

              {successMessage && (
                <div className="p-3 bg-[#0F2E22] border border-[#34A853]/30 text-[#48BB78] text-xs rounded-xs">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Email (Account identifier)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full bg-[#181818]/60 border border-white/5 px-3 py-2 text-xs text-[#8E8B82] rounded-xs cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name || user.name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone !== '' ? phone : user.phone || ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08167925842"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gold-gradient-bg text-[#0B0B0B] px-5 py-2.5 text-xs uppercase tracking-wider font-meta font-bold rounded-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  Save Profile Changes
                </button>
              </form>
            </div>
          )}

          {/* Tab 3: Delivery Addresses */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-editorial text-base text-[#F8F7F4]">Delivery Addresses</h3>
                <button
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="bg-[#181818] border border-white/10 text-[#F8F7F4] px-3.5 py-1.5 text-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors rounded-xs cursor-pointer"
                >
                  {isAddingAddress ? 'Cancel' : '+ Add Address'}
                </button>
              </div>

              {isAddingAddress && (
                <form onSubmit={handleAddAddress} className="border border-white/5 bg-[#121212] p-4 space-y-3 max-w-xl text-xs rounded-xs">
                  <h4 className="font-meta uppercase tracking-wider text-[#D4AF37] text-[10px]">New Delivery Address</h4>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newAddress.fullName}
                      onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">Phone</label>
                    <input
                      type="tel"
                      required
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={newAddress.streetAddress}
                      onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">City</label>
                      <input
                        type="text"
                        required
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">State</label>
                      <input
                        type="text"
                        required
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="gold-gradient-bg text-[#0B0B0B] px-5 py-2 text-xs uppercase tracking-wider font-meta font-bold rounded-xs cursor-pointer hover:opacity-90"
                  >
                    Save Address
                  </button>
                </form>
              )}

              {addresses.length === 0 ? (
                <div className="border border-white/5 bg-[#121212] p-8 text-center text-xs text-[#8E8B82] rounded-xs">
                  No delivery addresses saved yet. Add one above for faster checkout.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="border border-white/5 bg-[#121212] p-4 space-y-1.5 text-xs rounded-xs">
                      <div className="flex justify-between items-start">
                        <strong className="text-sm font-editorial text-[#F8F7F4]">{addr.fullName}</strong>
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-red-400 text-[10px] hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-[#8E8B82] leading-relaxed">
                        {addr.streetAddress}
                        {addr.apartment ? `, ${addr.apartment}` : ''}
                        <br />
                        {addr.city}, {addr.state}
                        <br />
                        {addr.country}
                      </p>
                      <p className="text-[#D4AF37] font-mono text-[11px]">{addr.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Proof Modal */}
          {proofOrderRef && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
              <div className="bg-[#121212] max-w-md w-full p-5 border border-white/10 shadow-2xl space-y-3.5 rounded-xs">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <h3 className="font-editorial text-base font-bold text-[#F8F7F4]">
                    Submit Bank Transfer Details
                  </h3>
                  <button onClick={() => setProofOrderRef(null)} className="text-[#8E8B82] hover:text-white cursor-pointer">
                    ✕
                  </button>
                </div>
                <p className="text-xs text-[#8E8B82]">
                  Order: <strong className="font-mono text-[#D4AF37]">{proofOrderRef}</strong>
                </p>
                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Transaction ID / Sender Name / Narration
                  </label>
                  <textarea
                    rows={3}
                    value={paymentProofNotes}
                    onChange={(e) => setPaymentProofNotes(e.target.value)}
                    placeholder="e.g. Sent from Zenith/GTBank account 'Comfort', Ref #894210"
                    className="w-full bg-[#181818] border border-white/10 p-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setProofOrderRef(null)}
                    className="px-3.5 py-1.5 text-xs border border-white/10 text-[#EDEDED] rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitPaymentProof}
                    disabled={isSubmitting || !paymentProofNotes.trim()}
                    className="gold-gradient-bg text-[#0B0B0B] px-4 py-1.5 text-xs uppercase tracking-wider font-meta font-bold rounded-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit to CEO Adnuel'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
