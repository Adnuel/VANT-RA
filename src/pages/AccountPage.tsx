import React, { useState, useEffect } from 'react';
import { ArrowRight, Mail, MessageCircle, X } from 'lucide-react';
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

  // Customer Registration Location Fields
  const [regState, setRegState] = useState('');
  const [regLga, setRegLga] = useState('');
  const [regAddress, setRegAddress] = useState('');

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

  useEffect(() => {
    if (!token && !user) return;

    if (token) {
      safeFetchJson<{ orders: any[] }>('/api/customer/orders', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok && res.data?.orders && Array.isArray(res.data.orders)) {
          setOrders(res.data.orders);
        } else if (user) {
          setOrders(clientAuthFallback.getOrders(user.id, user.email));
        }
      });

      safeFetchJson<{ addresses: any[] }>('/api/customer/addresses', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok && res.data?.addresses && Array.isArray(res.data.addresses)) {
          setAddresses(res.data.addresses);
        } else if (user) {
          setAddresses(clientAuthFallback.getAddresses(user.id));
        }
      });
    } else if (user) {
      setOrders(clientAuthFallback.getOrders(user.id, user.email));
      setAddresses(clientAuthFallback.getAddresses(user.id));
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
      const result = await safeFetchJson<{
        token?: string;
        user?: any;
        error?: string;
        requiresVerification?: boolean;
        email?: string;
      }>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      if (result.ok && result.data?.token && result.data?.user) {
        loginCustomer(result.data.token, result.data.user);
        setSuccessMessage('Signed in successfully.');
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
        }
        return;
      }

      if (result.status === 403 && result.data?.requiresVerification) {
        setVerifyEmailAddress(result.data.email || cleanEmail.toLowerCase());
        setVerificationCode('');
        setAuthMode('verify');
        setErrorMessage(
          result.data.error ||
            'Please enter the 6-digit verification code sent to your email to confirm your account.'
        );
        return;
      }

      if ((result.status === 401 || result.status === 429 || result.status === 400) && result.data?.error) {
        setErrorMessage(result.data.error);
        return;
      }

      const fallback = clientAuthFallback.login(cleanEmail, password);
      if (fallback.success && fallback.token && fallback.user) {
        loginCustomer(fallback.token, fallback.user as any);
        setSuccessMessage('Signed in successfully.');
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
        }
        return;
      }

      setErrorMessage(fallback.error || 'Invalid email or password. Please verify your credentials.');
    } catch {
      setErrorMessage('Unable to sign in right now. Please check your connection and try again.');
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
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
      setErrorMessage('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await safeFetchJson<{
        requiresVerification?: boolean;
        email?: string;
        emailSent?: boolean;
        message?: string;
        token?: string;
        user?: any;
        error?: string;
      }>('/api/auth/register', {
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

      if (result.ok && result.data?.requiresVerification) {
        setVerifyEmailAddress(result.data.email || cleanEmail);
        setVerificationCode('');
        setAuthMode('verify');
        if (result.data.emailSent === false) {
          setErrorMessage(
            result.data.message ||
              'Email delivery (SMTP / Resend API) is not configured on the server yet, so the verification email could not reach your inbox.'
          );
        } else {
          setSuccessMessage(
            result.data.message ||
              `A 6-digit verification code has been sent to ${cleanEmail}. Enter it below to confirm your account.`
          );
        }
        return;
      }

      if (result.data?.error) {
        setErrorMessage(result.data.error);
        return;
      }

      setErrorMessage(result.error || 'Unable to register account right now. Please try again.');
    } catch {
      setErrorMessage('Unable to register account right now. Please check your connection and try again.');
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
    setSuccessMessage('');
    try {
      const res = await safeFetchJson<{
        success?: boolean;
        message?: string;
        error?: string;
        token?: string;
        user?: any;
      }>('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: verifyEmailAddress || user?.email || email,
          code: verificationCode.trim(),
        }),
      });
      if (res.ok && res.data?.success) {
        setVerificationCode('');
        if (res.data.token && res.data.user) {
          loginCustomer(res.data.token, res.data.user);
        } else if (user) {
          updateUser({ ...user, isEmailVerified: true, emailVerified: true });
        }
        setSuccessMessage('Email verified and account confirmed.');
        if (returnToCart) {
          setIsCartOpen(true);
          onNavigate('/');
          return;
        }
        if (!res.data.token) {
          setAuthMode('login');
        }
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
      const res = await safeFetchJson<{
        success?: boolean;
        emailSent?: boolean;
        message?: string;
        error?: string;
      }>('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (res.ok && res.data?.success) {
        if (res.data.emailSent === false) {
          setErrorMessage(
            res.data.message ||
              'Code regenerated, but server email delivery (SMTP / Resend API) is not configured yet.'
          );
        } else {
          setSuccessMessage(res.data.message || 'A fresh 6-digit verification code has been sent to your email.');
        }
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
      } else {
        setErrorMessage(res.data?.error || 'Unable to resend verification code right now.');
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
      const res = await safeFetchJson<{ success?: boolean; message?: string; error?: string }>(
        '/api/auth/change-password',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );
      if (res.ok && res.data?.success) {
        setPasswordChangeSuccess('Password updated successfully.');
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
          setOrders((prev) => prev.map((o) => (o.id === res.data!.order.id ? res.data!.order : o)));
        }
        setReturnSuccessMessage(
          `Your ${returnType} request for ${returnModalOrder.orderReference} has been logged and sent to CEO Adnuel.`
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

  // Handle Forgot Password
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
          setSuccessMessage('Security code verified. Enter your new password below.');
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
          setSuccessMessage('Password updated successfully. Please sign in with your new credentials.');
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
        setSuccessMessage('Profile updated successfully.');
      } else if (user) {
        const updated = clientAuthFallback.updateProfile(user.id, { name: cleanName, phone: cleanPhone });
        if (updated) {
          updateUser(updated as any);
          setSuccessMessage('Profile updated successfully.');
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
        city: '',
        state: '',
        postalCode: '',
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
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-12 lg:py-20 space-y-8 font-meta text-[#111111]">
      {!user ? (
        <div className="w-full max-w-md mx-auto border border-[#111111]/12 bg-[#FAF7F2] p-6 sm:p-9 rounded-xs space-y-6">
          <div className="text-center space-y-2.5">
            <div className="w-10 h-10 bg-[#111111] text-[#F7F3EC] flex items-center justify-center font-editorial text-lg font-medium mx-auto rounded-xs">
              V
            </div>
            <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#111111] break-words">
              {authMode === 'login' && 'Sign In to VANTÉRA'}
              {authMode === 'register' && 'Create Client Account'}
              {authMode === 'verify' && 'Confirm Your Email'}
              {authMode === 'forgot' && 'Reset Password'}
            </h1>
            <p className="text-xs text-[#5C574E] leading-relaxed">
              {authMode === 'login' && 'Access saved Nigerian shipping addresses and track your orders.'}
              {authMode === 'register' && 'Enter your details to receive a 6-digit email confirmation code.'}
              {authMode === 'verify' && 'Enter the 6-digit verification code sent to your email to confirm your account.'}
              {authMode === 'forgot' && 'Enter your registered email to receive recovery instructions.'}
            </p>
          </div>

          {/* Dual Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-[#F7F3EC] border border-[#111111]/12 rounded-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2.5 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs transition-colors cursor-pointer ${
                authMode === 'login'
                  ? 'bg-[#B89B5E] text-[#111111]'
                  : 'text-[#5C574E] hover:text-[#111111]'
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
              className={`py-2.5 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs transition-colors cursor-pointer ${
                authMode === 'register'
                  ? 'bg-[#B89B5E] text-[#111111]'
                  : 'text-[#5C574E] hover:text-[#111111]'
              }`}
            >
              Open Account
            </button>
          </div>

          {errorMessage &&
            !errorMessage.includes('405') &&
            !errorMessage.includes('No response body') &&
            !errorMessage.includes('JSON') && (
              <div className="p-3 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs break-words">
                {errorMessage}
              </div>
            )}

          {successMessage && (
            <div className="p-3 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs rounded-xs break-words">
              {successMessage}
            </div>
          )}

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col justify-between min-h-[290px] w-full">
              <div className="flex-1 space-y-4 pb-4">
                <div>
                  <label htmlFor="login-email" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3.5 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="login-password" className="text-[10px] uppercase tracking-[0.16em] text-[#5C574E]">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('forgot');
                        setErrorMessage('');
                      }}
                      className="text-[10px] text-[#7A6230] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3.5 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-[#111111]/10 space-y-3 w-full">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>

                <div className="text-center text-[11px] text-[#5C574E]">
                  New client?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-medium text-[#7A6230] underline hover:text-[#111111] cursor-pointer"
                  >
                    Open an account now
                  </button>
                </div>
              </div>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col justify-between min-h-[460px] w-full">
              <div className="flex-1 space-y-3.5 pb-4">
                <div>
                  <label htmlFor="reg-name" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Full Name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Full Name"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Email Address
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="reg-phone" className="text-[10px] uppercase tracking-[0.16em] text-[#5C574E]">
                      Phone / WhatsApp (+234 format)
                    </label>
                    {phone && (
                      <span className={`text-[10px] ${validateNigerianPhone(phone).valid ? 'text-[#7A6230]' : 'text-[#8E3A3A]'}`}>
                        {validateNigerianPhone(phone).valid ? 'Valid format' : 'Invalid format'}
                      </span>
                    )}
                  </div>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 812 345 6789"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] tabular-nums placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label htmlFor="reg-state" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    State / Location (Nigeria)
                  </label>
                  <select
                    id="reg-state"
                    value={regState}
                    onChange={(e) => {
                      const s = e.target.value;
                      setRegState(s);
                      const lgas = getLgasForState(s);
                      setRegLga(lgas[0] || '');
                    }}
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  >
                    <option value="" className="bg-[#FAF7F2] text-[#5C574E]">
                      Select state / location...
                    </option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s.state} value={s.state} className="bg-[#FAF7F2] text-[#111111]">
                        {s.state} ({s.deliveryEstimate})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="reg-lga" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                      LGA / City
                    </label>
                    <select
                      id="reg-lga"
                      value={regLga}
                      onChange={(e) => setRegLga(e.target.value)}
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    >
                      {!regState && (
                        <option value="" className="bg-[#FAF7F2] text-[#5C574E]">
                          Select city / LGA...
                        </option>
                      )}
                      {(regState ? getLgasForState(regState) : []).map((city) => (
                        <option key={city} value={city} className="bg-[#FAF7F2] text-[#111111]">
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reg-address" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                      Delivery Address
                    </label>
                    <input
                      id="reg-address"
                      type="text"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      placeholder="Street address"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Password (min. 6 characters)
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label htmlFor="reg-confirm" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="reg-confirm"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-[#111111]/10 space-y-3 w-full">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs disabled:opacity-50 cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>

                <div className="text-center text-[11px] text-[#5C574E]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="font-medium text-[#7A6230] underline hover:text-[#111111] cursor-pointer"
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
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F7F3EC] border border-[#B89B5E]/50 text-[#7A6230] mx-auto">
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <h3 className="font-editorial text-xl text-[#111111] font-medium">
                  Enter Confirmation Code
                </h3>
                <p className="text-xs text-[#5C574E] leading-relaxed">
                  We sent a 6-digit confirmation code to{' '}
                  <strong className="text-[#111111]">{verifyEmailAddress || email}</strong>. Type it below to confirm your account.
                </p>
              </div>

              <div>
                <label htmlFor="verify-otp" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1.5 text-center">
                  6-Digit Email Verification Code
                </label>
                <input
                  id="verify-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-[0.45em] tabular-nums text-lg bg-[#F7F3EC] border border-[#111111]/15 px-4 py-3 text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || verificationCode.length < 6}
                className="w-full gold-gradient-bg py-3.5 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Confirming...' : 'Confirm Code & Activate Account'}
              </button>

              <div className="flex items-center justify-between pt-2 text-[11px] text-[#5C574E]">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendVerification}
                  className="text-[#7A6230] hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="hover:text-[#111111] underline cursor-pointer"
                >
                  Change email
                </button>
              </div>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              {forgotStep === 'request' && (
                <div>
                  <label htmlFor="forgot-email" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1.5">
                    Registered Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3.5 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>
              )}

              {forgotStep === 'code' && (
                <div>
                  <label htmlFor="forgot-code" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1.5">
                    Enter 6-Digit Security Code
                  </label>
                  <input
                    id="forgot-code"
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.45em] tabular-nums text-base bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>
              )}

              {forgotStep === 'reset' && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="forgot-new" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                      New Password (min. 8 characters)
                    </label>
                    <input
                      id="forgot-new"
                      type="password"
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3.5 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="forgot-confirm" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="forgot-confirm"
                      type="password"
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3.5 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full gold-gradient-bg py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs disabled:opacity-50 cursor-pointer"
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
                  className="w-full text-center text-[11px] text-[#5C574E] hover:text-[#7A6230] cursor-pointer"
                >
                  Request a new code
                </button>
              )}

              <div className="text-center pt-3 border-t border-[#111111]/10 text-[11px] text-[#5C574E]">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setForgotStep('request');
                    setErrorMessage('');
                  }}
                  className="font-medium text-[#7A6230] underline cursor-pointer"
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
          <div className="border border-[#111111]/12 bg-[#FAF7F2] p-6 sm:p-8 rounded-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold block">
                Client Account{' '}
                {user.isEmailVerified === false && !user.emailVerified ? '· Verification Pending' : '· Verified'}
              </span>
              <h1 className="font-editorial text-2xl sm:text-4xl font-medium text-[#111111]">
                Welcome, {user.name}
              </h1>
              <p className="text-xs text-[#5C574E] tabular-nums">
                {user.email} {user.phone ? `· ${user.phone}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {returnToCart && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(true);
                    onNavigate('/');
                  }}
                  className="gold-gradient-bg px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] rounded-xs cursor-pointer"
                >
                  Return to Checkout →
                </button>
              )}
              <button
                type="button"
                onClick={logoutCustomer}
                className="px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] border border-[#111111]/20 bg-[#F7F3EC] text-[#111111] hover:border-[#B89B5E] transition-colors rounded-xs cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Email Verification Banner when pending */}
          {user.isEmailVerified === false && !user.emailVerified && (
            <form
              onSubmit={handleVerifyEmail}
              className="border border-[#B89B5E]/50 bg-[#FAF7F2] p-5 sm:p-6 rounded-xs space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-[#7A6230] font-semibold block">
                    Action Required · Security Verification
                  </span>
                  <h3 className="font-editorial text-lg text-[#111111] font-medium">
                    Verify Your Email ({user.email})
                  </h3>
                  <p className="text-xs text-[#5C574E] mt-0.5">
                    Enter the 6-digit code dispatched to your inbox to unlock verified client receipts.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendVerification}
                  className="text-[11px] text-[#7A6230] underline hover:text-[#111111] disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="p-2.5 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs rounded-xs">
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
                  className="flex-1 bg-[#F7F3EC] border border-[#111111]/15 px-3.5 py-2.5 text-sm tabular-nums tracking-[0.35em] text-[#111111] rounded-xs focus:border-[#B89B5E] focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || verificationCode.length < 6}
                  className="gold-gradient-bg px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] rounded-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Email'}
                </button>
              </div>
            </form>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-[#111111]/12 gap-6 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`pb-3 uppercase tracking-[0.16em] font-semibold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'orders'
                  ? 'border-b-2 border-[#B89B5E] text-[#111111]'
                  : 'text-[#5C574E] hover:text-[#111111]'
              }`}
            >
              My Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`pb-3 uppercase tracking-[0.16em] font-semibold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'profile'
                  ? 'border-b-2 border-[#B89B5E] text-[#111111]'
                  : 'text-[#5C574E] hover:text-[#111111]'
              }`}
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('addresses')}
              className={`pb-3 uppercase tracking-[0.16em] font-semibold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'addresses'
                  ? 'border-b-2 border-[#B89B5E] text-[#111111]'
                  : 'text-[#5C574E] hover:text-[#111111]'
              }`}
            >
              Saved Addresses ({addresses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`pb-3 uppercase tracking-[0.16em] font-semibold transition-colors cursor-pointer shrink-0 ${
                activeTab === 'security'
                  ? 'border-b-2 border-[#B89B5E] text-[#111111]'
                  : 'text-[#5C574E] hover:text-[#111111]'
              }`}
            >
              Security
            </button>
          </div>

          {/* Tab 1: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {returnSuccessMessage && (
                <div className="p-3 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs rounded-xs">
                  {returnSuccessMessage}
                </div>
              )}

              {orders.length === 0 ? (
                <div className="border border-[#111111]/10 bg-[#FAF7F2] p-12 text-center space-y-4 rounded-xs">
                  <div className="font-editorial text-3xl text-[#7A6230]">V</div>
                  <h3 className="font-editorial text-xl text-[#111111]">No orders placed yet</h3>
                  <p className="text-xs text-[#5C574E]">
                    Your past purchases and bank transfer verifications will be tracked here.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('/shop')}
                    className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
                  >
                    Explore Collection
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const isPaid = order.paymentStatus === 'paid';
                    const isAwaiting = order.paymentStatus === 'awaiting_verification';

                    return (
                      <div
                        key={order.id || order.orderReference}
                        className="border border-[#111111]/12 bg-[#FAF7F2] p-5 space-y-4 rounded-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#111111]/10 pb-3">
                          <div>
                            <span className="text-sm font-semibold text-[#111111] tabular-nums">
                              {order.orderReference}
                            </span>
                            <span className="text-xs text-[#5C574E] ml-3">
                              Placed {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] rounded-xs border ${
                                isPaid
                                  ? 'bg-[#F7F3EC] text-[#111111] border-[#B89B5E]'
                                  : isAwaiting
                                  ? 'bg-[#F7F3EC] text-[#7A6230] border-[#B89B5E]/50'
                                  : 'bg-[#F7F3EC] text-[#5C574E] border-[#111111]/15'
                              }`}
                            >
                              Payment: {order.paymentStatus ? order.paymentStatus.replace('_', ' ') : 'pending'}
                            </span>

                            <span className="px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] bg-[#F7F3EC] text-[#111111] border border-[#111111]/15 rounded-xs">
                              {order.fulfilmentStatus || 'processing'}
                            </span>

                            {order.returnRequested && (
                              <span className="px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] bg-[#F7F3EC] text-[#7A6230] border border-[#B89B5E]/50 rounded-xs">
                                Return: {order.returnStatus || 'pending'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Items in order */}
                        <div className="divide-y divide-[#111111]/10">
                          {(order.items || []).map((item: any, i: number) => (
                            <div key={i} className="py-2.5 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.title}
                                    className="w-11 h-11 object-cover bg-[#EFEAE0] border border-[#111111]/10 rounded-xs"
                                  />
                                ) : (
                                  <div className="w-11 h-11 bg-[#EFEAE0] border border-[#111111]/10 flex items-center justify-center font-editorial text-xs text-[#7A6230] rounded-xs">
                                    V
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-[#111111]">{item.title}</p>
                                  <p className="text-[11px] text-[#5C574E] tabular-nums">Qty: {item.quantity}</p>
                                </div>
                              </div>
                              <span className="font-medium text-[#111111] tabular-nums">
                                {order.currency === 'NGN'
                                  ? formatNGN(convertUsdCentsToNgn(item.totalCents || 0, order.exchangeRateUsed || 1500))
                                  : formatUSD(item.totalCents || 0)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Tracking info if dispatched */}
                        {order.trackingNumber && (
                          <div className="bg-[#F7F3EC] border border-[#111111]/10 p-3 text-xs space-y-1 rounded-xs">
                            <span className="font-semibold text-[#7A6230] uppercase tracking-wider text-[10px] block">
                              Shipment Dispatched ({order.carrier || 'Standard Courier'})
                            </span>
                            <div className="flex items-center justify-between">
                              <span className="tabular-nums text-[#111111]">Tracking #{order.trackingNumber}</span>
                              {order.trackingUrl && (
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#7A6230] underline hover:text-[#111111]"
                                >
                                  Track Carrier Package →
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Order Summary footer */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 text-xs border-t border-[#111111]/10">
                          <span className="text-[#5C574E]">
                            Total Amount:{' '}
                            <strong className="text-[#111111] font-semibold text-sm tabular-nums">
                              {order.currency === 'NGN'
                                ? formatNGN(convertUsdCentsToNgn(order.totalCents || 0, order.exchangeRateUsed || 1500))
                                : formatUSD(order.totalCents || 0)}
                            </strong>
                          </span>

                          <div className="flex flex-wrap items-center gap-2">
                            {order.paymentStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProofOrderRef(order.orderReference);
                                  setPaymentProofNotes(order.paymentProofNotes || '');
                                }}
                                className="bg-[#F7F3EC] border border-[#111111]/15 text-[#111111] px-3 py-1.5 text-xs hover:border-[#B89B5E] transition-colors rounded-xs cursor-pointer"
                              >
                                Submit Transfer Ref
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setReturnModalOrder(order);
                                setReturnType(
                                  order.fulfilmentStatus === 'shipped' || order.fulfilmentStatus === 'delivered'
                                    ? 'return'
                                    : 'cancellation'
                                );
                                setReturnReason('');
                                setReturnErrorMessage('');
                              }}
                              className="border border-[#111111]/15 text-[#5C574E] hover:border-[#B89B5E] hover:text-[#111111] px-3 py-1.5 text-xs rounded-xs transition-colors cursor-pointer"
                            >
                              Request Return / Cancel
                            </button>

                            <a
                              href={`https://wa.me/2347015285932?text=${encodeURIComponent(
                                `Hello CEO Adnuel, checking on order ${order.orderReference}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#111111] border border-[#B89B5E]/50 bg-[#F7F3EC] px-3 py-1.5 rounded-xs hover:bg-[#B89B5E] transition-colors inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                              <span>WhatsApp Concierge</span>
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
            <div className="border border-[#111111]/12 bg-[#FAF7F2] p-6 rounded-xs space-y-4 max-w-xl">
              <h3 className="font-editorial text-lg text-[#111111] border-b border-[#111111]/10 pb-2.5">
                Personal Details
              </h3>

              {successMessage && (
                <div className="p-3 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs rounded-xs">
                  {successMessage}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="profile-email" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Email (Account identifier)
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full bg-[#EFEAE0] border border-[#111111]/10 px-3 py-2.5 text-xs text-[#5C574E] rounded-xs cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="profile-name" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Full Name
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    required
                    value={name || user.name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label htmlFor="profile-phone" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={phone !== '' ? phone : user.phone || ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 816 792 5842"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] tabular-nums focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer disabled:opacity-50"
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
                <h3 className="font-editorial text-lg text-[#111111]">Delivery Addresses</h3>
                <button
                  type="button"
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="bg-[#FAF7F2] border border-[#111111]/15 text-[#111111] px-4 py-2 text-xs hover:border-[#B89B5E] transition-colors rounded-xs cursor-pointer"
                >
                  {isAddingAddress ? 'Cancel' : '+ Add Address'}
                </button>
              </div>

              {isAddingAddress && (
                <form
                  onSubmit={handleAddAddress}
                  className="border border-[#111111]/12 bg-[#FAF7F2] p-5 space-y-3.5 max-w-xl text-xs rounded-xs"
                >
                  <h4 className="uppercase tracking-[0.2em] text-[#7A6230] text-[10px] font-semibold">
                    New Delivery Address
                  </h4>
                  {errorMessage && (
                    <div className="p-2.5 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
                      {errorMessage}
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newAddress.fullName}
                      onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                      placeholder="Full recipient name"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2 text-xs text-[#111111] rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                      Phone (+234 format)
                    </label>
                    <input
                      type="tel"
                      required
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      placeholder="+234 801 234 5678"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2 text-xs text-[#111111] tabular-nums rounded-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.streetAddress}
                      onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                      placeholder="Plot / House number, street"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2 text-xs text-[#111111] rounded-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                        Nigerian State / FCT
                      </label>
                      <select
                        required
                        value={newAddress.state}
                        onChange={(e) => {
                          const s = e.target.value;
                          const lgas = s ? getLgasForState(s) : [];
                          setNewAddress({ ...newAddress, state: s, city: lgas[0] || '' });
                        }}
                        className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2 text-xs text-[#111111] rounded-xs"
                      >
                        <option value="" className="bg-[#FAF7F2] text-[#5C574E]">
                          Select state...
                        </option>
                        {NIGERIAN_STATES.map((s) => (
                          <option key={s.state} value={s.state} className="bg-[#FAF7F2] text-[#111111]">
                            {s.state}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">LGA / City</label>
                      <select
                        required
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2 text-xs text-[#111111] rounded-xs"
                      >
                        {!newAddress.state && (
                          <option value="" className="bg-[#FAF7F2] text-[#5C574E]">
                            Select city / LGA...
                          </option>
                        )}
                        {(newAddress.state ? getLgasForState(newAddress.state) : []).map((city) => (
                          <option key={city} value={city} className="bg-[#FAF7F2] text-[#111111]">
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="gold-gradient-bg px-6 py-2.5 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer disabled:opacity-50"
                  >
                    Save Address
                  </button>
                </form>
              )}

              {addresses.length === 0 ? (
                <div className="border border-[#111111]/10 bg-[#FAF7F2] p-8 text-center text-xs text-[#5C574E] rounded-xs">
                  No delivery addresses saved yet. Add one above for faster checkout.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="border border-[#111111]/12 bg-[#FAF7F2] p-5 space-y-1.5 text-xs rounded-xs">
                      <div className="flex justify-between items-start">
                        <strong className="text-base font-editorial font-medium text-[#111111]">{addr.fullName}</strong>
                        <button
                          type="button"
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-[#8E3A3A] text-[11px] hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-[#5C574E] leading-relaxed">
                        {addr.streetAddress}
                        {addr.apartment ? `, ${addr.apartment}` : ''}
                        <br />
                        {addr.city}, {addr.state}
                        <br />
                        {addr.country}
                      </p>
                      <p className="text-[#7A6230] tabular-nums text-[11px] font-medium">{addr.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Security & Password */}
          {activeTab === 'security' && (
            <div className="border border-[#111111]/12 bg-[#FAF7F2] p-6 rounded-xs space-y-4 max-w-xl">
              <h3 className="font-editorial text-lg text-[#111111] border-b border-[#111111]/10 pb-2.5">
                Security Credentials & Password
              </h3>

              {passwordChangeSuccess && (
                <div className="p-3 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs rounded-xs">
                  {passwordChangeSuccess}
                </div>
              )}

              {passwordChangeError && (
                <div className="p-3 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
                  {passwordChangeError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="sec-current" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Current Password *
                  </label>
                  <input
                    id="sec-current"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label htmlFor="sec-new" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    New Password (min. 8 characters) *
                  </label>
                  <input
                    id="sec-new"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <div>
                  <label htmlFor="sec-confirm" className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    id="sec-confirm"
                    type="password"
                    required
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* Return & Cancellation Modal */}
          {returnModalOrder && (
            <div className="vantera-overlay-fade fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111111]/60 backdrop-blur-xs">
              <div className="bg-[#FAF7F2] border border-[#111111]/15 p-6 rounded-xs max-w-lg w-full space-y-4">
                <div className="flex items-center justify-between border-b border-[#111111]/10 pb-3">
                  <h4 className="font-editorial text-lg font-medium text-[#111111]">
                    Request Return / Cancellation
                  </h4>
                  <button
                    type="button"
                    onClick={() => setReturnModalOrder(null)}
                    aria-label="Close modal"
                    className="text-[#5C574E] hover:text-[#111111] p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>

                <p className="text-xs text-[#5C574E]">
                  Order Reference: <strong className="tabular-nums text-[#111111]">{returnModalOrder.orderReference}</strong>
                </p>

                {returnErrorMessage && (
                  <div className="p-3 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
                    {returnErrorMessage}
                  </div>
                )}

                <form onSubmit={handleCreateReturnRequest} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1.5">
                      Request Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReturnType('cancellation')}
                        className={`p-2.5 text-xs border rounded-xs transition-colors cursor-pointer ${
                          returnType === 'cancellation'
                            ? 'border-[#B89B5E] bg-[#F7F3EC] text-[#111111] font-semibold'
                            : 'border-[#111111]/12 bg-[#FAF7F2] text-[#5C574E]'
                        }`}
                      >
                        Order Cancellation
                      </button>
                      <button
                        type="button"
                        onClick={() => setReturnType('return')}
                        className={`p-2.5 text-xs border rounded-xs transition-colors cursor-pointer ${
                          returnType === 'return'
                            ? 'border-[#B89B5E] bg-[#F7F3EC] text-[#111111] font-semibold'
                            : 'border-[#111111]/12 bg-[#FAF7F2] text-[#5C574E]'
                        }`}
                      >
                        Return / Exchange
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                      Reason & Details *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      placeholder="Please detail why you wish to cancel or return this order..."
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-3 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReturnModalOrder(null)}
                      className="px-4 py-2 border border-[#111111]/15 text-[#5C574E] hover:text-[#111111] text-xs rounded-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={returnSubmitting || !returnReason.trim()}
                      className="gold-gradient-bg px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] rounded-xs disabled:opacity-40 cursor-pointer"
                    >
                      {returnSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Payment Proof Modal */}
          {proofOrderRef && (
            <div className="vantera-overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/60 backdrop-blur-xs p-4">
              <div className="bg-[#FAF7F2] max-w-md w-full p-6 border border-[#111111]/15 space-y-4 rounded-xs">
                <div className="flex justify-between items-center border-b border-[#111111]/10 pb-2.5">
                  <h3 className="font-editorial text-lg font-medium text-[#111111]">
                    Submit Bank Transfer Details
                  </h3>
                  <button
                    type="button"
                    onClick={() => setProofOrderRef(null)}
                    aria-label="Close modal"
                    className="text-[#5C574E] hover:text-[#111111] p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                <p className="text-xs text-[#5C574E]">
                  Order: <strong className="tabular-nums text-[#111111]">{proofOrderRef}</strong>
                </p>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.16em] text-[#5C574E] mb-1">
                    Transaction ID / Sender Name / Narration
                  </label>
                  <textarea
                    rows={3}
                    value={paymentProofNotes}
                    onChange={(e) => setPaymentProofNotes(e.target.value)}
                    placeholder="e.g. Sent from Zenith/GTBank account 'Comfort', Ref #894210"
                    className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setProofOrderRef(null)}
                    className="px-4 py-2 text-xs border border-[#111111]/15 text-[#111111] rounded-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitPaymentProof}
                    disabled={isSubmitting || !paymentProofNotes.trim()}
                    className="gold-gradient-bg px-4 py-2 text-[11px] uppercase tracking-[0.16em] font-semibold rounded-xs cursor-pointer disabled:opacity-50"
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
