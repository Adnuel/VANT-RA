import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCart } from '../contexts/CartContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';
import { clientAuthFallback } from '../lib/clientAuthFallback.ts';
import { NIGERIAN_STATES, getLgasForState, validateNigerianPhone } from '../data/nigeriaLocations.ts';

interface AccountPageProps {
  onNavigate: (url: string) => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate, initialMode }) => {
  const { user, token, loginCustomer, logoutCustomer, updateUser } = useAuth();
  const { setIsCartOpen } = useCart();

  // Mode: 'login' | 'register' | 'forgot' | 'verify'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'verify'>(
    initialMode === 'register' ? 'register' : 'login'
  );
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'addresses' | 'security'>('orders');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnToCart, setReturnToCart] = useState(false);

  // Nigerian Registration Fields
  const [regState, setRegState] = useState('Lagos');
  const [regLga, setRegLga] = useState('Ikeja');
  const [regAddress, setRegAddress] = useState('');
  const [phoneValidation, setPhoneValidation] = useState<{ valid: boolean; formatted: string; error?: string }>({ valid: true, formatted: '' });

  // Email verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot password multi-step state
  const [forgotStep, setForgotStep] = useState<'request' | 'code' | 'reset'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  // Return & Cancellation Request Modal
  const [returnModalOrder, setReturnModalOrder] = useState<any | null>(null);
  const [returnType, setReturnType] = useState<'cancellation' | 'return'>('cancellation');
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSuccessMessage, setReturnSuccessMessage] = useState('');
  const [returnErrorMessage, setReturnErrorMessage] = useState('');

  // Sync mode with prop or URL search parameters (e.g. /account?mode=register)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const modeParam = params.get('mode');
      if (modeParam === 'register' || initialMode === 'register') {
        setAuthMode('register');
      } else if (modeParam === 'login' || initialMode === 'login') {
        setAuthMode('login');
      } else if (initialMode === 'forgot') {
        setAuthMode('forgot');
      }
      if (params.get('returnTo') === 'cart') {
        setReturnToCart(true);
      }
    } catch {
      if (initialMode && ['login', 'register', 'forgot'].includes(initialMode)) {
        setAuthMode(initialMode);
      }
    }
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
    city: 'Ikeja',
    state: 'Lagos',
    postalCode: '100001',
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
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
        }
        return;
      }

      // If server explicitly returned a business error (e.g. 401/429 with message)
      if ((result.status === 401 || result.status === 429) && result.data?.error) {
        if (result.status === 401) {
          const fallback = clientAuthFallback.login(cleanEmail, password);
          if (fallback.success && fallback.token && fallback.user) {
            loginCustomer(fallback.token, fallback.user as any);
            setSuccessMessage('Logged in successfully');
            if (returnToCart) {
              setIsCartOpen(true);
              onNavigate('/');
            }
            return;
          }
        }
        setErrorMessage(result.data.error);
        return;
      }

      // 2. Client fallback for static hosting / offline / 404 / 405
      const fallback = clientAuthFallback.login(cleanEmail, password);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Logged in successfully');
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
        }
        return;
      }

      setErrorMessage(fallback.error || 'Invalid email or password. Please verify your credentials.');
    } catch {
      const fallback = clientAuthFallback.login(cleanEmail, password);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Logged in successfully');
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
        }
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

    if (cleanPhone) {
      const phoneValidationCheck = validateNigerianPhone(cleanPhone);
      if (!phoneValidationCheck.valid) {
        setErrorMessage(phoneValidationCheck.error || 'Please enter a valid Nigerian phone number (+234...).');
        setIsSubmitting(false);
        return;
      }
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
      // 1. Send registration to server API with Nigerian fields
      const result = await safeFetchJson<{ token?: string; user?: any; error?: string }>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password,
          phone: cleanPhone ? validateNigerianPhone(cleanPhone).formatted : '',
          state: regState,
          lga: regLga,
          address: regAddress,
        }),
      });

      if (result.ok && result.data?.token && result.data?.user) {
        clientAuthFallback.register(cleanName, cleanEmail, password, cleanPhone);
        loginCustomer(result.data.token, result.data.user);
        setVerifyEmailAddress(cleanEmail);
        setAuthMode('verify');
        setSuccessMessage('Account created! A 6-digit verification code has been dispatched to your email.');
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
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
          return;
        }
        setSuccessMessage('Your VANTÉRA client account has been opened successfully! Welcome.');
        return;
      }

      setErrorMessage(fallback.error || 'An account with this email already exists. Please sign in.');
    } catch {
      const fallback = clientAuthFallback.register(cleanName, cleanEmail, password, cleanPhone);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
          return;
        }
        setSuccessMessage('Your VANTÉRA client account has been opened successfully! Welcome.');
        return;
      }
      setErrorMessage(fallback.error || 'Unable to open account. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Verify Email via 6-digit code
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const res = await safeFetchJson<{ success?: boolean; message?: string; error?: string; user?: any }>('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmailAddress || user?.email || email, code: verificationCode.trim() }),
      });
      if (res.ok && res.data?.success) {
        setSuccessMessage('✓ Email address verified successfully!');
        setVerificationCode('');
        if (user) {
          updateUser({ ...user, isEmailVerified: true, emailVerified: true });
        }
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
          return;
        }
        setAuthMode('login');
      } else {
        setErrorMessage(res.data?.error || 'Invalid verification code. Please check your inbox or spam folder.');
      }
    } catch {
      setErrorMessage('Verification failed. Please check your network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = verifyEmailAddress || user?.email || email;
    if (!targetEmail || resendCooldown > 0) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await safeFetchJson<{ success?: boolean; message?: string }>('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (res.ok) {
        setSuccessMessage('✓ A fresh 6-digit verification code has been dispatched to your email.');
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch {
      setErrorMessage('Unable to resend verification code right now.');
    }
  };

  // Handle Change Password (Security Tab)
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
    if (!currentPassword || !newPassword) {
      setPasswordChangeError('Current password and new password are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await safeFetchJson<{ success?: boolean; message?: string; error?: string }>('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok && res.data?.success) {
        setPasswordChangeSuccess('✓ Password successfully updated.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeError(res.data?.error || 'Unable to update password. Check your current password.');
      }
    } catch {
      setPasswordChangeError('Password update failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Return or Cancellation Request
  const handleCreateReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalOrder || !returnReason.trim()) return;
    setReturnSubmitting(true);
    setReturnErrorMessage('');
    try {
      const res = await safeFetchJson<{ success?: boolean; order?: any; error?: string }>(
        `/api/customer/orders/${returnModalOrder.id}/return`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            type: returnType,
            reason: returnReason.trim(),
            notes: returnReason.trim(),
          }),
        }
      );
      if (res.ok && res.data?.success) {
        if (res.data.order) {
          setOrders((prev) =>
            prev.map((o) => (o.id === res.data!.order.id ? res.data!.order : o))
          );
        }
        setReturnSuccessMessage(
          `✓ Your ${returnType} request for ${returnModalOrder.orderReference} has been logged and sent to CEO Adnuel.`
        );
        setReturnModalOrder(null);
        setReturnReason('');
      } else {
        setReturnErrorMessage(res.data?.error || 'Failed to file request.');
      }
    } catch {
      setReturnErrorMessage('Failed to submit request. Please try again.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Handle Forgot Password (3 steps: request OTP -> verify code -> reset password)
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      if (forgotStep === 'request') {
        const cleanEmail = email.trim();
        if (!cleanEmail) {
          setErrorMessage('Please enter your registered email address.');
          return;
        }
        const result = await safeFetchJson<{ message?: string; error?: string }>('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        });
        setSuccessMessage(
          result.data?.message || 'If an account exists with this email, a 6-digit security code has been sent.'
        );
        setForgotStep('code');
      } else if (forgotStep === 'code') {
        const res = await safeFetchJson<{ success?: boolean; resetToken?: string; error?: string }>(
          '/api/auth/verify-reset-code',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), code: resetCode.trim() }),
          }
        );
        if (res.ok && res.data?.success && res.data?.resetToken) {
          setResetToken(res.data.resetToken);
          setSuccessMessage('✓ Security code verified. Enter your new password below.');
          setForgotStep('reset');
        } else {
          setErrorMessage(res.data?.error || 'Invalid or expired security code.');
        }
      } else if (forgotStep === 'reset') {
        if (forgotNewPassword.length < 8) {
          setErrorMessage('New password must be at least 8 characters long.');
          return;
        }
        if (forgotNewPassword !== forgotConfirmPassword) {
          setErrorMessage('Passwords do not match.');
          return;
        }
        const res = await safeFetchJson<{ success?: boolean; message?: string; error?: string }>(
          '/api/auth/reset-password',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resetToken, newPassword: forgotNewPassword }),
          }
        );
        if (res.ok && res.data?.success) {
          setSuccessMessage('✓ Password updated successfully! Please sign in with your new credentials.');
          setForgotStep('request');
          setResetCode('');
          setResetToken('');
          setForgotNewPassword('');
          setForgotConfirmPassword('');
          setAuthMode('login');
        } else {
          setErrorMessage(res.data?.error || 'Could not reset password. Request a fresh code.');
        }
      }
    } catch {
      setErrorMessage('Unable to complete recovery step. Please check your connection.');
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
    setErrorMessage('');

    const phoneCheck = validateNigerianPhone(newAddress.phone);
    if (newAddress.country === 'Nigeria' && !phoneCheck.valid) {
      setErrorMessage(phoneCheck.error || 'Please provide a valid Nigerian +234 phone number.');
      return;
    }

    const formattedPayload = {
      ...newAddress,
      phone: newAddress.country === 'Nigeria' && phoneCheck.valid ? phoneCheck.formatted : newAddress.phone,
    };

    setIsSubmitting(true);

    try {
      const result = await safeFetchJson<{ address: any }>('/api/customer/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formattedPayload),
      });

      if (result.ok && result.data?.address) {
        setAddresses((prev) => [...prev, result.data!.address]);
        setIsAddingAddress(false);
      } else if (user) {
        const updatedAddrs = clientAuthFallback.saveAddress(user.id, formattedPayload);
        setAddresses(updatedAddrs);
        setIsAddingAddress(false);
      }

      setNewAddress({
        fullName: '',
        phone: '',
        streetAddress: '',
        apartment: '',
        city: 'Ikeja',
        state: 'Lagos',
        postalCode: '100001',
        country: 'Nigeria',
        isDefault: false,
      });
    } catch {
      if (user) {
        const updatedAddrs = clientAuthFallback.saveAddress(user.id, formattedPayload);
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-12 lg:py-16 space-y-8 font-meta">
      {/* If Not Logged In: Show Authentication Card */}
      {!user ? (
        <div className="w-full max-w-md mx-auto border border-white/10 bg-[#141416] p-6 sm:p-8 rounded-xs space-y-6">
          <div className="text-center space-y-2 mb-2">
            <div className="w-9 h-9 gold-gradient-bg flex items-center justify-center font-editorial text-base font-medium mx-auto rounded-xs">
              V
            </div>
            <h1 className="font-editorial text-2xl font-medium text-[#F5F1E8] break-words">
              {authMode === 'login' && 'Sign In to VANTÉRA'}
              {authMode === 'register' && 'Open Client Account'}
              {authMode === 'forgot' && 'Reset Password'}
            </h1>
            <p className="text-xs text-[#A8A297] break-words">
              {authMode === 'login' && 'Access saved Nigerian shipping addresses and track your orders.'}
              {authMode === 'register' && 'Create your client account for seamless checkout and tracking.'}
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
                  className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
                  <span className="text-sm">→</span>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-meta uppercase tracking-wider text-[#A9A69F]">
                      Phone / WhatsApp (+234 format)
                    </label>
                    {phone && (
                      <span className={`text-[9px] font-mono ${validateNigerianPhone(phone).valid ? 'text-[#10b981]' : 'text-red-400'}`}>
                        {validateNigerianPhone(phone).valid ? '✓ Valid format' : 'Invalid format'}
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 812 345 6789"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    State / Location (Nigeria)
                  </label>
                  <select
                    value={regState}
                    onChange={(e) => {
                      const s = e.target.value;
                      setRegState(s);
                      const lgas = getLgasForState(s);
                      setRegLga(lgas[0] || '');
                    }}
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  >
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s.state} value={s.state} className="bg-[#181818] text-[#F8F7F4]">
                        {s.state} ({s.zone === 'lagos' ? 'Lagos Zone' : s.deliveryEstimate})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                      LGA / City
                    </label>
                    <select
                      value={regLga}
                      onChange={(e) => setRegLga(e.target.value)}
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                    >
                      {getLgasForState(regState).map((city) => (
                        <option key={city} value={city} className="bg-[#181818] text-[#F8F7F4]">
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                      Delivery Address
                    </label>
                    <input
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="e.g. 14 Admiralty Way"
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                    />
                  </div>
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

              <div className="mt-auto pt-4 border-t border-white/10 space-y-3 w-full">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                  <span className="text-sm">→</span>
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

          {authMode === 'verify' && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] font-editorial text-xl mx-auto">
                  ✉
                </div>
                <h3 className="font-editorial text-lg text-[#F8F7F4] font-bold">
                  Verify Your Email Address
                </h3>
                <p className="text-xs text-[#8E8B82] leading-relaxed">
                  A 6-digit confirmation security code was dispatched to{' '}
                  <strong className="text-[#D4AF37]">{verifyEmailAddress || email}</strong>. Enter it below to activate verified client privileges.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1 text-center">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.5em] font-mono text-lg bg-[#181818] border border-white/10 px-4 py-3 text-[#D4AF37] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || verificationCode.length < 6}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-3 text-xs uppercase tracking-wider font-meta font-bold rounded-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Verifying...' : 'Verify Email & Enter Vault'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                  }}
                  className="text-[11px] text-[#8E8B82] hover:text-[#D4AF37] underline"
                >
                  Skip for now and continue to account
                </button>
              </div>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-3.5">
              {forgotStep === 'request' && (
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
              )}

              {forgotStep === 'code' && (
                <div>
                  <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                    Enter 6-Digit Security Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.45em] font-mono text-base bg-[#181818] border border-white/10 px-3 py-2.5 text-[#D4AF37] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>
              )}

              {forgotStep === 'reset' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                      New Password (min. 8 characters)
                    </label>
                    <input
                      type="password"
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-2.5 text-xs uppercase tracking-wider font-meta font-bold rounded-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting
                  ? 'Processing...'
                  : forgotStep === 'request'
                  ? 'Send 6-Digit Reset Code'
                  : forgotStep === 'code'
                  ? 'Verify Security Code'
                  : 'Save New Password'}
              </button>

              {forgotStep !== 'request' && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep('request');
                    setErrorMessage('');
                  }}
                  className="w-full text-center text-[11px] text-[#8E8B82] hover:text-[#D4AF37] cursor-pointer"
                >
                  Request a new code
                </button>
              )}

              <div className="text-center pt-3 border-t border-white/5 text-[11px] text-[#8E8B82]">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setForgotStep('request');
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
          <div className="border border-white/10 bg-[#141416] p-6 sm:p-8 rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#C8A96A] block">
                Client Account {user.isEmailVerified === false && !user.emailVerified ? '· Email Verification Pending' : '· Verified'}
              </span>
              <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#F5F1E8]">
                Welcome, {user.name}
              </h1>
              <p className="text-xs text-[#A8A297] font-mono">
                {user.email} {user.phone ? `· ${user.phone}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {returnToCart && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(true);
                    onNavigate('/');
                  }}
                  className="gold-gradient-bg text-[#0B0B0B] px-4 py-2 text-xs font-meta font-bold uppercase tracking-wider rounded-xs cursor-pointer"
                >
                  Return to Checkout →
                </button>
              )}
              <button
                onClick={logoutCustomer}
                className="px-4 py-2 text-xs border border-white/10 text-[#EDEDED] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors rounded-xs cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Email Verification Banner when pending */}
          {user.isEmailVerified === false && !user.emailVerified && (
            <form onSubmit={handleVerifyEmail} className="border border-[#D4AF37]/40 bg-[#1A160B] p-5 rounded-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[#D4AF37] block">
                    ACTION REQUIRED · SECURITY VERIFICATION
                  </span>
                  <h3 className="font-editorial text-base text-[#F8F7F4] font-semibold">
                    Verify Your Email ({user.email})
                  </h3>
                  <p className="text-xs text-[#A9A69F] mt-0.5">
                    Enter the 6-digit code dispatched to your inbox to unlock verified client receipts.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendVerification}
                  className="text-[11px] font-meta text-[#D4AF37] underline hover:text-white disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-2.5 bg-[#0F2E22] border border-[#34A853]/30 text-[#48BB78] text-xs rounded-xs">
                  {successMessage}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="flex-1 bg-[#121212] border border-white/10 px-3.5 py-2 text-sm font-mono tracking-[0.35em] text-[#D4AF37] rounded-xs focus:border-[#D4AF37] focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || verificationCode.length < 6}
                  className="gold-gradient-bg text-[#0B0B0B] px-5 py-2 text-xs font-meta font-bold uppercase tracking-wider rounded-xs hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Email'}
                </button>
              </div>
            </form>
          )}

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
            <button
              onClick={() => setActiveTab('security')}
              className={`pb-3 uppercase tracking-wider font-meta font-semibold transition-colors cursor-pointer ${
                activeTab === 'security'
                  ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              Security
            </button>
          </div>

          {/* Tab 1: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {returnSuccessMessage && (
                <div className="p-3 bg-[#0F2E22] border border-[#34A853]/30 text-[#48BB78] text-xs rounded-xs">
                  {returnSuccessMessage}
                </div>
              )}

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

                          <div className="flex flex-wrap items-center gap-2">
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

                            {order.returnRequested && (
                              <span className="px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-[#2D2412] text-[#D4AF37] border border-[#D4AF37]/30 rounded-xs">
                                Return: {order.returnStatus || 'pending'}
                              </span>
                            )}
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
                              <span className="font-semibold text-[#D4AF37]">
                                {order.currency === 'NGN'
                                  ? formatNGN(convertUsdCentsToNgn(item.totalCents || 0, order.exchangeRateUsed || 1500))
                                  : formatUSD(item.totalCents || 0)}
                              </span>
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
                                className="bg-[#181818] border border-white/10 text-[#F8F7F4] px-3 py-1.5 text-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors rounded-xs cursor-pointer"
                              >
                                Submit Transfer Ref
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setReturnModalOrder(order);
                                setReturnType(order.fulfilmentStatus === 'shipped' || order.fulfilmentStatus === 'delivered' ? 'return' : 'cancellation');
                                setReturnReason('');
                                setReturnErrorMessage('');
                              }}
                              className="border border-white/10 text-[#A0A09A] hover:border-[#D4AF37] hover:text-[#D4AF37] px-3 py-1.5 text-xs rounded-xs transition-colors cursor-pointer"
                            >
                              Request Return / Cancel
                            </button>

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
                  {errorMessage && (
                    <div className="p-2.5 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs">
                      {errorMessage}
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newAddress.fullName}
                      onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                      placeholder="Full recipient name"
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">Phone (+234 format)</label>
                    <input
                      type="tel"
                      required
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      placeholder="+234 801 234 5678"
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
                      placeholder="Plot / House number, street"
                      className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">Nigerian State / FCT</label>
                      <select
                        value={newAddress.state}
                        onChange={(e) => {
                          const s = e.target.value;
                          const lgas = getLgasForState(s);
                          setNewAddress({ ...newAddress, state: s, city: lgas[0] || '' });
                        }}
                        className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                      >
                        {NIGERIAN_STATES.map((s) => (
                          <option key={s.state} value={s.state} className="bg-[#181818] text-[#F8F7F4]">
                            {s.state}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-meta uppercase tracking-wider text-[#A9A69F] mb-1">LGA / City</label>
                      <select
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] rounded-xs"
                      >
                        {getLgasForState(newAddress.state || 'Lagos').map((city) => (
                          <option key={city} value={city} className="bg-[#181818] text-[#F8F7F4]">
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="gold-gradient-bg text-[#0B0B0B] px-5 py-2 text-xs uppercase tracking-wider font-meta font-bold rounded-xs cursor-pointer hover:opacity-90 disabled:opacity-50"
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

          {/* Tab 4: Security & Password */}
          {activeTab === 'security' && (
            <div className="border border-white/5 bg-[#121212] p-5 rounded-xs space-y-4 max-w-xl">
              <h3 className="font-editorial text-base text-[#F8F7F4] border-b border-white/5 pb-2">
                Security Credentials & Password
              </h3>

              {passwordChangeSuccess && (
                <div className="p-3 bg-[#0F2E22] border border-[#34A853]/30 text-[#48BB78] text-xs rounded-xs">
                  {passwordChangeSuccess}
                </div>
              )}

              {passwordChangeError && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs">
                  {passwordChangeError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs font-meta">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#A9A69F] mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#A9A69F] mb-1">
                    New Password (min. 8 characters) *
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[#A9A69F] mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#181818] border border-white/10 px-3 py-2 text-xs text-[#F8F7F4] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gold-gradient-bg text-[#0B0B0B] px-5 py-2.5 text-xs uppercase tracking-wider font-bold rounded-xs hover:opacity-90 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* Return & Cancellation Modal */}
          {returnModalOrder && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
              <div className="bg-[#121212] border border-[#D4AF37]/30 p-6 rounded-xs max-w-lg w-full space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h4 className="font-editorial text-base text-[#F8F7F4]">
                    Request Return / Cancellation
                  </h4>
                  <button
                    type="button"
                    onClick={() => setReturnModalOrder(null)}
                    className="text-[#888880] hover:text-[#EDEDED] text-lg font-bold"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-[#8E8B82] leading-relaxed">
                  Order Reference: <strong className="font-mono text-[#D4AF37]">{returnModalOrder.orderReference}</strong>
                </p>

                {returnErrorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs">
                    {returnErrorMessage}
                  </div>
                )}

                <form onSubmit={handleCreateReturnRequest} className="space-y-3.5 text-xs font-meta">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#A9A69F] mb-1">
                      Request Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReturnType('cancellation')}
                        className={`p-2.5 text-xs border rounded-xs transition-colors cursor-pointer ${
                          returnType === 'cancellation'
                            ? 'border-[#D4AF37] bg-[#181818] text-[#D4AF37] font-semibold'
                            : 'border-white/10 bg-[#0B0B0B] text-[#888880]'
                        }`}
                      >
                        Order Cancellation
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnType('return')}
                        className={`p-2.5 text-xs border rounded-xs transition-colors cursor-pointer ${
                          returnType === 'return'
                            ? 'border-[#D4AF37] bg-[#181818] text-[#D4AF37] font-semibold'
                            : 'border-white/10 bg-[#0B0B0B] text-[#888880]'
                        }`}
                      >
                        Return / Exchange
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#A9A69F] mb-1">
                      Reason & Details *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Please detail why you wish to cancel or return this order..."
                      className="w-full bg-[#181818] border border-white/10 p-3 text-xs text-[#EDEDED] placeholder-[#555] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReturnModalOrder(null)}
                      className="px-4 py-2 border border-white/10 text-[#888880] hover:text-[#EDEDED] text-xs rounded-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={returnSubmitting || !returnReason.trim()}
                      className="gold-gradient-bg text-[#0B0B0B] px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-xs hover:brightness-110 disabled:opacity-40"
                    >
                      {returnSubmitting ? 'Submitting...' : 'Submit Request to CEO'}
                    </button>
                  </div>
                </form>
              </div>
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
