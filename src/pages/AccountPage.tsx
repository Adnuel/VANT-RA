import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';

interface AccountPageProps {
  onNavigate: (url: string) => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({ onNavigate }) => {
  const { user, token, loginCustomer, logoutCustomer, updateUser } = useAuth();

  // Mode: 'login' | 'register' | 'forgot'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'addresses'>('orders');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer data
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

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
    if (!token) return;

    // Load customer's own orders
    fetch('/api/customer/orders', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.orders) setOrders(data.orders);
      })
      .catch(() => {});

    // Load customer's addresses
    fetch('/api/customer/addresses', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.addresses) setAddresses(data.addresses);
      })
      .catch(() => {});
  }, [token]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to login');
      loginCustomer(data.token, data.user);
      setSuccessMessage('Logged in successfully');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      loginCustomer(data.token, data.user);
      setSuccessMessage('Account created successfully');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Forgot Password
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setSuccessMessage(data.message);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      updateUser(data.user);
      setSuccessMessage('Profile updated successfully');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Add Address
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/customer/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newAddress),
      });
      const data = await res.json();
      if (res.ok) {
        setAddresses((prev) => [...prev, data.address]);
        setIsAddingAddress(false);
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
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await fetch(`/api/customer/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
    } catch {}
  };

  // Submit payment proof note
  const handleSubmitPaymentProof = async () => {
    if (!proofOrderRef || !paymentProofNotes.trim()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/orders/payment-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference: proofOrderRef,
          notes: paymentProofNotes.trim(),
        }),
      });
      if (res.ok) {
        setSuccessMessage('Payment verification details submitted! CEO Adnuel has been notified.');
        setProofOrderRef(null);
        setPaymentProofNotes('');
        // Reload orders
        fetch('/api/customer/orders', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .then((d) => d.orders && setOrders(d.orders));
      }
    } catch {
      setErrorMessage('Error submitting payment notes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      {/* If Not Logged In: Show Authentication Card */}
      {!user ? (
        <div className="max-w-md mx-auto border border-[#e7e4de] bg-white p-8 shadow-sm">
          <div className="text-center space-y-2 mb-8">
            <div className="w-8 h-8 bg-[#121210] text-[#f8f7f4] flex items-center justify-center font-serif text-base font-bold mx-auto">
              V
            </div>
            <h1 className="font-serif text-2xl font-normal text-[#121210]">
              {authMode === 'login' && 'Sign In to Your Account'}
              {authMode === 'register' && 'Create Your Customer Account'}
              {authMode === 'forgot' && 'Reset Your Password'}
            </h1>
            <p className="text-xs text-[#77746d]">
              {authMode === 'login' && 'Manage delivery addresses and track bank transfer orders.'}
              {authMode === 'register' && 'Join VANTÉRA for seamless tracking and saved shipping.'}
              {authMode === 'forgot' && 'Enter your email to receive a secure recovery code.'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-[#fdf2f2] border border-[#f8b4b4] text-[#9b1c1c] text-xs">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-[#eef8ee] border border-[#c3e6cb] text-[#1e7e34] text-xs">
              {successMessage}
            </div>
          )}

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#121210] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-[#121210]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setErrorMessage('');
                    }}
                    className="text-[11px] text-[#77746d] hover:text-[#121210] hover:underline"
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
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#121210] text-[#f8f7f4] py-3 text-xs uppercase tracking-widest font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="text-center pt-4 border-t border-[#e7e4de] text-xs text-[#77746d]">
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage('');
                  }}
                  className="font-medium text-[#121210] underline"
                >
                  Create one now
                </button>
              </div>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#121210] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Adewale Johnson"
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#121210] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#121210] mb-1">Phone / WhatsApp (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#121210] mb-1">Password (min. 6 characters)</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#121210] text-[#f8f7f4] py-3 text-xs uppercase tracking-widest font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>

              <div className="text-center pt-4 border-t border-[#e7e4de] text-xs text-[#77746d]">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                  }}
                  className="font-medium text-[#121210] underline"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#121210] mb-1">Your Registered Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#121210] text-[#f8f7f4] py-3 text-xs uppercase tracking-widest font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Recovery Instructions'}
              </button>

              <div className="text-center pt-4 border-t border-[#e7e4de] text-xs text-[#77746d]">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                  }}
                  className="font-medium text-[#121210] underline"
                >
                  Return to login
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* If Logged In: Customer Portal */
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#e7e4de] pb-6">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b]">CUSTOMER PORTAL</span>
              <h1 className="font-serif text-3xl font-normal text-[#121210]">
                Welcome back, {user.name}
              </h1>
              <p className="text-xs text-[#77746d] mt-1 font-mono">
                {user.email} · Account Role: Customer
              </p>
            </div>
            <button
              onClick={logoutCustomer}
              className="px-4 py-2 text-xs border border-[#e7e4de] hover:border-[#121210] transition-colors"
            >
              Sign Out
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-[#e7e4de] gap-8">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-3 text-xs uppercase tracking-wider font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'border-b-2 border-[#121210] text-[#121210]'
                  : 'text-[#77746d] hover:text-[#121210]'
              }`}
            >
              My Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 text-xs uppercase tracking-wider font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'border-b-2 border-[#121210] text-[#121210]'
                  : 'text-[#77746d] hover:text-[#121210]'
              }`}
            >
              Profile & Details
            </button>
            <button
              onClick={() => setActiveTab('addresses')}
              className={`pb-3 text-xs uppercase tracking-wider font-medium transition-colors ${
                activeTab === 'addresses'
                  ? 'border-b-2 border-[#121210] text-[#121210]'
                  : 'text-[#77746d] hover:text-[#121210]'
              }`}
            >
              Delivery Addresses ({addresses.length})
            </button>
          </div>

          {/* Tab 1: Orders */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {orders.length === 0 ? (
                <div className="border border-[#e7e4de] bg-white p-12 text-center space-y-3">
                  <div className="font-serif text-3xl text-[#77746d]">V</div>
                  <h3 className="font-serif text-base text-[#121210]">No orders placed yet</h3>
                  <p className="text-xs text-[#77746d]">
                    Your past purchases and bank transfer verifications will be tracked here.
                  </p>
                  <button
                    onClick={() => onNavigate('/shop')}
                    className="bg-[#121210] text-[#f8f7f4] px-5 py-2 text-xs uppercase tracking-wider"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const isPaid = order.paymentStatus === 'paid';
                    const isAwaiting = order.paymentStatus === 'awaiting_verification';

                    return (
                      <div
                        key={order.id}
                        className="border border-[#e7e4de] bg-white p-5 space-y-4 transition-all hover:border-[#121210]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e7e4de]/60 pb-3">
                          <div>
                            <span className="font-mono text-sm font-bold text-[#121210]">
                              {order.orderReference}
                            </span>
                            <span className="text-xs text-[#77746d] ml-3">
                              Placed {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Payment Badge */}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                                isPaid
                                  ? 'bg-[#eef8ee] text-[#1e7e34] border border-[#c3e6cb]'
                                  : isAwaiting
                                  ? 'bg-[#e8f4fd] text-[#0c5460] border border-[#bee5eb]'
                                  : 'bg-[#fff8e6] text-[#856404] border border-[#ffeeba]'
                              }`}
                            >
                              Payment: {order.paymentStatus.replace('_', ' ')}
                            </span>

                            {/* Fulfilment Badge */}
                            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider bg-[#f4f2ee] text-[#252521] border border-[#e7e4de]">
                              Status: {order.fulfilmentStatus}
                            </span>
                          </div>
                        </div>

                        {/* Items in order */}
                        <div className="divide-y divide-[#e7e4de]/40">
                          {order.items.map((item: any, i: number) => (
                            <div key={i} className="py-2 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                {item.image ? (
                                  <img src={item.image} alt={item.title} className="w-10 h-10 object-contain bg-[#f4f2ee] p-1 border border-[#e7e4de]" />
                                ) : (
                                  <div className="w-10 h-10 bg-[#f4f2ee] border border-[#e7e4de] flex items-center justify-center font-serif text-xs">V</div>
                                )}
                                <div>
                                  <p className="font-medium text-[#121210]">{item.title}</p>
                                  <p className="text-[10px] text-[#77746d]">Qty: {item.quantity}</p>
                                </div>
                              </div>
                              <span className="font-semibold text-[#121210]">{formatUSD(item.totalCents)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Tracking info if dispatched */}
                        {order.trackingNumber && (
                          <div className="bg-[#f0eef8] border border-[#d6bcfa] p-3 text-xs space-y-1">
                            <span className="font-semibold text-[#553c9a] uppercase tracking-wide text-[10px] block">
                              📦 Shipment Dispatched ({order.carrier})
                            </span>
                            <div className="flex items-center justify-between">
                              <span className="font-mono">Tracking #{order.trackingNumber}</span>
                              {order.trackingUrl && (
                                <a
                                  href={order.trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#553c9a] underline hover:text-[#121210]"
                                >
                                  Track Carrier Package →
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Order Summary footer */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
                          <span className="text-[#77746d]">
                            Total Amount:{' '}
                            <strong className="text-[#121210] font-bold text-sm">
                              {order.currency === 'NGN'
                                ? formatNGN(convertUsdCentsToNgn(order.totalCents, order.exchangeRateUsed || 1500))
                                : formatUSD(order.totalCents)}
                            </strong>
                            <span className="text-[10px] text-[#77746d] font-mono ml-2">
                              (~
                              {order.currency === 'NGN'
                                ? formatUSD(order.totalCents)
                                : formatNGN(convertUsdCentsToNgn(order.totalCents, order.exchangeRateUsed || 1500))}
                              )
                            </span>
                          </span>

                          <div className="flex items-center gap-2">
                            {order.paymentStatus === 'pending' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProofOrderRef(order.orderReference);
                                  setPaymentProofNotes(order.paymentProofNotes || '');
                                }}
                                className="bg-[#121210] text-[#f8f7f4] px-3.5 py-1.5 text-xs hover:bg-[#c4a66b] hover:text-[#121210] transition-colors"
                              >
                                Submit Transfer Reference
                              </button>
                            )}

                            <a
                              href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                                `Hello CEO Adnuel, checking on order ${order.orderReference}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#1e7e34] border border-[#c3e6cb] bg-[#eef8ee] px-3 py-1.5 hover:bg-[#c3e6cb]"
                            >
                              WhatsApp CEO Adnuel
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
            <div className="max-w-xl border border-[#e7e4de] bg-white p-6 space-y-6">
              <h3 className="font-serif text-lg text-[#121210] border-b border-[#e7e4de] pb-3">
                Customer Profile
              </h3>

              {successMessage && (
                <div className="p-3 bg-[#eef8ee] border border-[#c3e6cb] text-[#1e7e34] text-xs">
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#77746d] mb-1">Email (Account identifier)</label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full border border-[#e7e4de] bg-[#f4f2ee] px-3.5 py-2 text-xs text-[#77746d] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[#121210] font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name || user.name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[#121210] font-medium mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    value={phone !== '' ? phone : user.phone || ''}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234..."
                    className="w-full border border-[#e7e4de] px-3.5 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#121210] text-[#f8f7f4] px-6 py-2.5 text-xs uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors"
                >
                  Save Profile Changes
                </button>
              </form>
            </div>
          )}

          {/* Tab 3: Delivery Addresses */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg text-[#121210]">Saved Delivery Addresses</h3>
                <button
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="bg-[#121210] text-[#f8f7f4] px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210]"
                >
                  {isAddingAddress ? 'Cancel' : '+ Add New Address'}
                </button>
              </div>

              {isAddingAddress && (
                <form onSubmit={handleAddAddress} className="border border-[#e7e4de] bg-white p-6 space-y-4 max-w-xl text-xs">
                  <h4 className="font-semibold uppercase tracking-wider text-[#121210]">New Address</h4>
                  <div>
                    <label className="block text-[#77746d] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newAddress.fullName}
                      onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1">Phone</label>
                    <input
                      type="tel"
                      required
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      value={newAddress.streetAddress}
                      onChange={(e) => setNewAddress({ ...newAddress, streetAddress: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[#77746d] mb-1">City</label>
                      <input
                        type="text"
                        required
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        className="w-full border border-[#e7e4de] p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[#77746d] mb-1">State</label>
                      <input
                        type="text"
                        required
                        value={newAddress.state}
                        onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                        className="w-full border border-[#e7e4de] p-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#77746d] mb-1">Country</label>
                    <input
                      type="text"
                      required
                      value={newAddress.country}
                      onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                      className="w-full border border-[#e7e4de] p-2"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#121210] text-[#f8f7f4] px-5 py-2 text-xs uppercase tracking-wider"
                  >
                    Save Address
                  </button>
                </form>
              )}

              {addresses.length === 0 ? (
                <div className="border border-[#e7e4de] bg-white p-8 text-center text-xs text-[#77746d]">
                  No delivery addresses saved yet. Add one above for faster checkout.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="border border-[#e7e4de] bg-white p-4 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <strong className="text-sm font-serif">{addr.fullName}</strong>
                        <button
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="text-[#9b1c1c] text-[10px] hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-[#77746d] leading-relaxed">
                        {addr.streetAddress}
                        {addr.apartment ? `, ${addr.apartment}` : ''}
                        <br />
                        {addr.city}, {addr.state}
                        <br />
                        {addr.country}
                      </p>
                      <p className="text-[#a9a69f] font-mono text-[11px]">{addr.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment Proof Modal */}
          {proofOrderRef && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-white max-w-md w-full p-6 border border-[#e7e4de] shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
                  <h3 className="font-serif text-lg font-bold text-[#121210]">
                    Submit Bank Transfer Details
                  </h3>
                  <button onClick={() => setProofOrderRef(null)} className="text-[#77746d] hover:text-[#121210]">
                    ✕
                  </button>
                </div>
                <p className="text-xs text-[#77746d]">
                  Order: <strong className="font-mono text-[#121210]">{proofOrderRef}</strong>
                </p>
                <div>
                  <label className="block text-xs text-[#121210] font-medium mb-1">
                    Transaction ID / Sender Name / Narration
                  </label>
                  <textarea
                    rows={3}
                    value={paymentProofNotes}
                    onChange={(e) => setPaymentProofNotes(e.target.value)}
                    placeholder="e.g. Sent from GTBank account 'John Doe', Transaction ref #894210"
                    className="w-full border border-[#e7e4de] p-2.5 text-xs focus:border-[#121210] focus:outline-hidden"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setProofOrderRef(null)}
                    className="px-4 py-2 text-xs border border-[#e7e4de]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitPaymentProof}
                    disabled={isSubmitting || !paymentProofNotes.trim()}
                    className="bg-[#121210] text-[#f8f7f4] px-5 py-2 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : 'Submit to CEO Adnuel'}
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
