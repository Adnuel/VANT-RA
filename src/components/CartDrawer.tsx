import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import { trackEvent } from '../lib/tracker.ts';

interface CartDrawerProps {
  onNavigate: (url: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onNavigate }) => {
  const { items, itemCount, subtotalCents, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, clearCart } =
    useCart();
  const { user, token } = useAuth();
  const { currency, setCurrency, exchangeRate } = useCurrency();

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'confirmed'>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<'ngn' | 'usd' | null>(null);
  const [paymentNoteSent, setPaymentNoteSent] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: user?.phone || '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
    notes: '',
    paymentReference: '',
  });

  const [bankSettings, setBankSettings] = useState({
    bankName: 'Guaranty Trust Bank (GTBank)',
    accountName: 'ADARIKWU EMMANUEL UGBADA',
    accountNumber: '1033269410',
    sortCode: '058-152062',
    instructions:
      'Transfer the exact order total using your unique Order Reference as the transaction narration. Once sent, enter your payment reference below to notify CEO Adnuel for instant verification.',
    whatsapp: '+234 913 279 3670',
    email: 'emmanueladarikwu@gmail.com',
  });

  const [activeNgn, setActiveNgn] = useState<any>(null);
  const [activeUsd, setActiveUsd] = useState<any>(null);
  const [viewBankCurrency, setViewBankCurrency] = useState<'NGN' | 'USD'>('USD');

  useEffect(() => {
    fetch('/api/bank-details')
      .then((res) => res.json())
      .then((data) => {
        if (data.bankSettings) setBankSettings(data.bankSettings);
        if (data.activeNgn) setActiveNgn(data.activeNgn);
        if (data.activeUsd) setActiveUsd(data.activeUsd);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        customerName: prev.customerName || user.name,
        customerEmail: prev.customerEmail || user.email,
        customerPhone: prev.customerPhone || user.phone || '',
      }));
    }
  }, [user]);

  if (!isCartOpen) return null;

  // Coupon discount calculation
  let discountCents = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      discountCents = Math.round((subtotalCents * appliedCoupon.discountValue) / 100);
    } else {
      discountCents = Math.min(subtotalCents, appliedCoupon.discountValue);
    }
  }

  const shippingFeeCents = subtotalCents >= 5000 ? 0 : 500;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingFeeCents);

  // Real-time currency conversions
  const subtotalNgn = convertUsdCentsToNgn(subtotalCents, exchangeRate);
  const discountNgn = convertUsdCentsToNgn(discountCents, exchangeRate);
  const shippingFeeNgn = convertUsdCentsToNgn(shippingFeeCents, exchangeRate);
  const totalNgn = convertUsdCentsToNgn(totalCents, exchangeRate);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponMessage('');
    try {
      const res = await fetch('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), subtotalCents }),
      });
      const data = await res.json();
      if (data.valid && data.coupon) {
        setAppliedCoupon(data.coupon);
        setCouponMessage(`✓ Code ${data.coupon.code} applied (${data.coupon.discountValue}% off)`);
      } else {
        setCouponMessage(data.message || 'Invalid or expired reservation voucher');
      }
    } catch {
      setCouponMessage('Unable to validate voucher');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleClose = () => {
    setIsCartOpen(false);
    if (checkoutStep === 'confirmed') {
      setCheckoutStep('cart');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const orderPayload = {
        customerEmail: formData.customerEmail,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        shippingAddress: {
          fullName: formData.customerName,
          phone: formData.customerPhone,
          streetAddress: formData.streetAddress,
          apartment: formData.apartment,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode || '100001',
          country: formData.country,
        },
        cartItems: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
        currency: currency,
        couponCode: appliedCoupon?.code,
        notes: formData.notes,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      setConfirmedOrder(data.order);
      setViewBankCurrency(data.order.currency === 'NGN' ? 'NGN' : 'USD');
      setCheckoutStep('confirmed');
      clearCart();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentProofSubmit = async () => {
    if (!confirmedOrder || !formData.paymentReference) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders/payment-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference: confirmedOrder.orderReference,
          notes: formData.paymentReference,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmedOrder(data.order);
        setPaymentNoteSent(true);
      }
    } catch {
      setErrorMessage('Unable to record payment note at this time.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md transition-opacity">
      <div className="flex h-full w-full max-w-md flex-col bg-[#0B0B0B] text-[#EDEDED] shadow-[0_0_80px_rgba(0,0,0,0.95)] border-l border-white/5">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3.5 bg-[#0E0E0E]">
          <div className="flex items-center gap-2">
            <span className="font-editorial text-base text-[#F5F5F0]">
              {checkoutStep === 'cart' && `Atelier Bag (${itemCount})`}
              {checkoutStep === 'shipping' && 'Delivery Allocation'}
              {checkoutStep === 'confirmed' && 'Reservation Placed'}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-[#D4AF37] font-meta">VANTÉRA</span>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close bag drawer"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#888880] hover:text-[#EDEDED] hover:bg-white/5 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Real-Time Currency Selector & Live Rate Bar */}
          {checkoutStep !== 'confirmed' && (
            <div className="bg-[#121212] p-4 border border-white/5 rounded-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-meta tracking-[0.25em] text-[#D4AF37] font-semibold">
                  Settlement Currency
                </span>
                <span className="text-[10px] font-meta text-[#888880] flex items-center gap-1.5 bg-[#181818] px-2 py-0.5 rounded-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                  <span>1 USD = ₦{exchangeRate.toLocaleString()}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 px-3 text-[11px] font-meta tracking-wider uppercase font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer rounded-xs ${
                    currency === 'USD'
                      ? 'gold-gradient-bg text-[#0B0B0B] font-bold shadow-md'
                      : 'bg-[#181818] text-[#888880] border border-white/5 hover:border-white/10'
                  }`}
                >
                  <span>US Dollar ($ USD)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('NGN')}
                  className={`py-2 px-3 text-[11px] font-meta tracking-wider uppercase font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer rounded-xs ${
                    currency === 'NGN'
                      ? 'gold-gradient-bg text-[#0B0B0B] font-bold shadow-md'
                      : 'bg-[#181818] text-[#888880] border border-white/5 hover:border-white/10'
                  }`}
                >
                  <span>Naira (₦ NGN)</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-[#888880] font-meta">
                <span>
                  Active Subtotal:{' '}
                  <strong className="text-[#F5F5F0]">
                    {currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}
                  </strong>
                </span>
                <span className="text-[#D4AF37]">
                  ~{currency === 'NGN' ? formatUSD(totalCents) : formatNGN(totalNgn)}
                </span>
              </div>
            </div>
          )}

          {checkoutStep === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[#77746d]">
                  <div className="mb-4 text-4xl font-editorial text-[#D4AF37]">V</div>
                  <p className="text-sm font-medium text-[#EDEDED] font-editorial">Your Atelier Bag is Empty</p>
                  <p className="mt-2 text-xs text-[#888880] font-meta">Explore curated tech finds, charging monoliths, and acoustic relics.</p>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      onNavigate('/shop');
                    }}
                    className="mt-6 gold-gradient-bg text-[#0B0B0B] px-6 py-2.5 text-[10px] font-meta font-bold uppercase tracking-[0.2em] shadow-md hover:brightness-110"
                  >
                    Explore Curations
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map(({ product, quantity }) => {
                    const itemTotalCents = product.retailPriceCents * quantity;
                    const itemTotalNgn = convertUsdCentsToNgn(itemTotalCents, exchangeRate);

                    return (
                      <div
                        key={product.id}
                        className="flex items-start gap-4 bg-[#121212] p-4 border border-white/5 rounded-xs"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden bg-[#0a0a0a] p-1.5 border border-white/5 flex items-center justify-center">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.title}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="font-editorial text-sm text-[#D4AF37]">
                              V
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-editorial text-[#EDEDED] line-clamp-1">{product.title}</h4>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-editorial text-[#D4AF37] block">
                                {currency === 'NGN' ? formatNGN(itemTotalNgn) : formatUSD(itemTotalCents)}
                              </span>
                            </div>
                          </div>
                          <span className="text-[9px] uppercase tracking-[0.2em] text-[#73736E] font-meta block mt-1">{product.category}</span>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center border border-white/10 rounded-xs bg-[#0B0B0B]">
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, quantity - 1)}
                                className="px-2.5 py-0.5 text-xs text-[#888880] hover:text-[#EDEDED]"
                              >
                                -
                              </button>
                              <span className="px-2 text-xs font-meta text-[#EDEDED]">{quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, quantity + 1)}
                                className="px-2.5 py-0.5 text-xs text-[#888880] hover:text-[#EDEDED]"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              className="text-[10px] font-meta tracking-wider text-[#A0A09A] hover:text-red-400"
                            >
                              Release
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Promo Code Input */}
                  <div className="bg-[#121212] p-4 border border-white/5 space-y-2 rounded-xs">
                    <span className="text-[9px] font-meta font-semibold uppercase tracking-[0.25em] text-[#888880] block">
                      Privé Allocation Voucher
                    </span>
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="e.g. VANTERA10"
                        className="flex-1 bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs uppercase font-meta text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="bg-[#1C1C1C] text-[#D4AF37] border border-[#D4AF37]/30 px-4 py-2 text-[10px] font-meta uppercase tracking-[0.2em] hover:bg-[#D4AF37] hover:text-[#0B0B0B] transition-colors disabled:opacity-40"
                      >
                        {isApplyingCoupon ? '...' : 'Validate'}
                      </button>
                    </form>
                    {couponMessage && (
                      <p className={`text-[10px] font-meta ${couponMessage.startsWith('✓') ? 'text-[#10b981]' : 'text-red-400'}`}>
                        {couponMessage}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {checkoutStep === 'shipping' && (
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              {errorMessage && (
                <div className="border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 font-meta">
                  {errorMessage}
                </div>
              )}

              <div className="bg-[#121212] p-5 border border-white/5 space-y-3 rounded-xs">
                <h4 className="text-[10px] font-meta uppercase tracking-[0.25em] text-[#D4AF37]">
                  Recipient Credentials
                </h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-name" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">Full Legal Name *</label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="e.g. Emmanuel Adarikwu"
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-email" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">Email (Vault Confirmation) *</label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="e.g. emmanuel@example.com"
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">WhatsApp / Mobile *</label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="e.g. +234 913 279 3670"
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] p-5 border border-white/5 space-y-3 rounded-xs">
                <h4 className="text-[10px] font-meta uppercase tracking-[0.25em] text-[#D4AF37]">
                  Delivery Sanctuary
                </h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-street" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">Street Address *</label>
                    <input
                      id="checkout-street"
                      type="text"
                      required
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                      placeholder="e.g. 14 Victoria Island Way"
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="checkout-city" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">City *</label>
                      <input
                        id="checkout-city"
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Lagos"
                        className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label htmlFor="checkout-state" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">State / Province *</label>
                      <input
                        id="checkout-state"
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="e.g. Lagos State"
                        className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">Country *</label>
                    <input
                      type="text"
                      required
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Bank Settlement Notice */}
              <div className="border border-[#D4AF37]/30 bg-[#0F2E22]/20 p-5 space-y-2 rounded-xs">
                <div className="flex items-center justify-between">
                  <span className="font-editorial text-sm text-[#D4AF37]">
                    {currency === 'NGN' ? 'Nigerian Naira Bank Settlement' : 'USD Global Wire Transfer'}
                  </span>
                  <span className="text-[10px] font-meta bg-[#0B0B0B] text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded-xs">
                    {currency}
                  </span>
                </div>
                <p className="text-[11px] text-[#A0A09A] font-meta leading-relaxed">
                  You are allocating in <strong>{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'United States Dollar ($)'}</strong>. Upon confirmation, you will receive an allocation reference (e.g. VAN-2026-XXXX) and direct wire coordinates for instant CEO verification.
                </p>
              </div>
            </form>
          )}

          {checkoutStep === 'confirmed' && confirmedOrder && (
            <div className="space-y-6">
              <div className="border border-[#0F2E22] bg-[#0F2E22]/30 p-6 text-center rounded-xs">
                <span className="text-3xl text-[#D4AF37]">✦</span>
                <h3 className="mt-3 font-editorial text-lg font-medium text-[#F5F5F0]">Reservation Confirmed</h3>
                <p className="mt-1 text-xs text-[#A0A09A] font-meta">
                  Allocation Reference: <strong className="font-meta text-sm text-[#D4AF37]">{confirmedOrder.orderReference}</strong>
                </p>
                <div className="mt-3 bg-[#0B0B0B] p-3 border border-white/10 inline-block rounded-xs">
                  <span className="text-[9px] uppercase font-meta tracking-[0.2em] text-[#888880] block">Due for Wire Settlement</span>
                  <strong className="text-xl font-editorial text-[#D4AF37]">
                    {confirmedOrder.currency === 'NGN'
                      ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                      : formatUSD(confirmedOrder.totalCents)}
                  </strong>
                </div>
              </div>

              {/* Bank Account Toggle Switcher */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-meta uppercase tracking-[0.2em] text-[10px] text-[#A0A09A]">
                    Official Settlement Coordinates
                  </h4>
                  <div className="flex border border-white/10 text-[10px] font-meta rounded-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewBankCurrency('NGN')}
                      className={`px-3 py-1 transition-colors ${
                        viewBankCurrency === 'NGN'
                          ? 'gold-gradient-bg text-[#0B0B0B] font-bold'
                          : 'bg-[#141414] text-[#888880] hover:text-[#EDEDED]'
                      }`}
                    >
                      ₦ NGN Bank
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewBankCurrency('USD')}
                      className={`px-3 py-1 transition-colors ${
                        viewBankCurrency === 'USD'
                          ? 'gold-gradient-bg text-[#0B0B0B] font-bold'
                          : 'bg-[#141414] text-[#888880] hover:text-[#EDEDED]'
                      }`}
                    >
                      $ USD Wire
                    </button>
                  </div>
                </div>

                {viewBankCurrency === 'NGN' ? (
                  <div className="border border-white/5 bg-[#121212] p-5 space-y-3 text-xs rounded-xs">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="font-editorial text-[#F5F5F0]">Nigerian Naira (₦) GTBank Account</span>
                      <span className="text-[9px] bg-[#0F2E22] text-[#10b981] px-2 py-0.5 font-meta uppercase">Instant Clearing</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-meta">
                      <div>
                        <span className="text-[10px] text-[#73736E] block">Bank Entity</span>
                        <strong className="text-[#EDEDED]">{activeNgn?.bankName || bankSettings.bankName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#73736E] block">Account Number</span>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm tracking-widest text-[#D4AF37]">
                            {activeNgn?.accountNumber || bankSettings.accountNumber}
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeNgn?.accountNumber || bankSettings.accountNumber);
                              setCopiedKey('ngn');
                              setTimeout(() => setCopiedKey(null), 2000);
                            }}
                            className="text-[10px] text-[#D4AF37] hover:underline"
                          >
                            {copiedKey === 'ngn' ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-[#73736E] block">Beneficiary Name</span>
                        <strong className="text-[#EDEDED]">{activeNgn?.accountName || bankSettings.accountName}</strong>
                      </div>
                      <div className="col-span-2 bg-[#0B0B0B] p-2.5 border border-white/5 rounded-xs">
                        <span className="text-[9px] uppercase tracking-wider text-[#888880] block">Mandatory Transfer Narration</span>
                        <strong className="text-xs text-[#D4AF37]">{confirmedOrder.orderReference}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-white/5 bg-[#121212] p-5 space-y-3 text-xs rounded-xs">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="font-editorial text-[#F5F5F0]">USD Global Settlement Wire</span>
                      <span className="text-[9px] bg-[#0F2E22] text-[#10b981] px-2 py-0.5 font-meta uppercase">Mercury / Wire</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-meta">
                      <div>
                        <span className="text-[10px] text-[#73736E] block">Institution</span>
                        <strong className="text-[#EDEDED]">{activeUsd?.bankName || 'VANTÉRA Global Settlement'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#73736E] block">Account Number</span>
                        <div className="flex items-center gap-2">
                          <strong className="text-sm tracking-widest text-[#D4AF37]">
                            {activeUsd?.accountNumber || '984102938471'}
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeUsd?.accountNumber || '984102938471');
                              setCopiedKey('usd');
                              setTimeout(() => setCopiedKey(null), 2000);
                            }}
                            className="text-[10px] text-[#D4AF37] hover:underline"
                          >
                            {copiedKey === 'usd' ? '✓' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#73736E] block">Routing Number</span>
                        <strong className="text-[#EDEDED]">{activeUsd?.sortCodeOrRouting || '021000021'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#73736E] block">SWIFT / BIC</span>
                        <strong className="text-[#EDEDED]">{activeUsd?.swiftBic || 'MERCUS33XXX'}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-[#73736E] block">Beneficiary</span>
                        <strong className="text-[#EDEDED]">{activeUsd?.accountName || 'VANTÉRA ENTERPRISES - Adnuel'}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Proof Submission */}
              <div className="border border-white/5 bg-[#121212] p-5 space-y-3 rounded-xs">
                <h4 className="text-[10px] font-meta uppercase tracking-[0.25em] text-[#D4AF37]">
                  Notify CEO Adnuel of Settlement
                </h4>
                <p className="text-[11px] text-[#888880] font-meta">
                  Already wired? Enter your transfer transaction ID or bank sender name:
                </p>
                <input
                  type="text"
                  placeholder="e.g. Sent via GTWorld app, Narration Ref #984210"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                  className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                />
                {paymentNoteSent ? (
                  <div className="p-3 bg-[#0F2E22] text-[#10b981] border border-[#10b981]/30 text-xs font-meta text-center rounded-xs">
                    ✓ Notification transmitted. CEO Adnuel is verifying your allocation.
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting || !formData.paymentReference}
                    onClick={handlePaymentProofSubmit}
                    className="w-full gold-gradient-bg text-[#0B0B0B] py-3 text-[10px] font-meta font-bold uppercase tracking-[0.2em] hover:brightness-110 disabled:opacity-40"
                  >
                    {isSubmitting ? 'Transmitting...' : 'Confirm Transfer Transmitted'}
                  </button>
                )}
              </div>

              {/* Direct WhatsApp link to CEO */}
              <div className="text-center pt-2">
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello CEO Adnuel, I have allocated VANTÉRA order ${confirmedOrder.orderReference} for ${
                      confirmedOrder.currency === 'NGN'
                        ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                        : formatUSD(confirmedOrder.totalCents)
                    }. Here is my settlement proof.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-meta tracking-wide text-[#D4AF37] hover:underline"
                >
                  <span>Direct VIP Concierge with CEO Adnuel (+234 913 279 3670) ↗</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="border-t border-white/5 bg-[#0E0E0E] p-7">
          {checkoutStep === 'cart' && items.length > 0 && (
            <div>
              <div className="space-y-2 text-xs mb-5 font-meta">
                <div className="flex justify-between text-[#888880]">
                  <span>Subtotal</span>
                  <div className="text-right">
                    <span className="font-medium text-[#EDEDED]">
                      {currency === 'NGN' ? formatNGN(subtotalNgn) : formatUSD(subtotalCents)}
                    </span>
                  </div>
                </div>

                {discountCents > 0 && (
                  <div className="flex justify-between text-[#10b981]">
                    <span>Privé Privilege ({appliedCoupon?.code})</span>
                    <div className="text-right">
                      <span>-{currency === 'NGN' ? formatNGN(discountNgn) : formatUSD(discountCents)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-[#888880]">
                  <span>Courier Allocation</span>
                  <span className="text-[#EDEDED]">
                    {shippingFeeCents === 0
                      ? 'Complimentary'
                      : currency === 'NGN'
                      ? formatNGN(shippingFeeNgn)
                      : formatUSD(shippingFeeCents)}
                  </span>
                </div>

                <div className="flex justify-between text-sm pt-3 border-t border-white/5 font-editorial">
                  <div>
                    <span className="text-[#EDEDED]">Total ({currency})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base text-[#D4AF37] font-bold">
                      {currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  trackEvent('checkout_initiated', {
                    itemCount,
                    subtotalCents,
                    currency,
                    items: items.map((i) => ({ productId: i.product.id, title: i.product.title, quantity: i.quantity })),
                  });
                  setCheckoutStep('shipping');
                }}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-3.5 text-[10px] font-meta font-bold uppercase tracking-[0.25em] shadow-lg hover:brightness-110 active:scale-98 transition-all"
              >
                Proceed to Allocation
              </button>
            </div>
          )}

          {checkoutStep === 'shipping' && (
            <div className="space-y-3 font-meta">
              <div className="bg-[#121212] p-3 border border-white/5 text-xs space-y-1 rounded-xs">
                <div className="flex justify-between text-[#888880]">
                  <span>Settlement Currency</span>
                  <strong className="text-[#D4AF37]">{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}</strong>
                </div>
                <div className="flex justify-between text-[#EDEDED] font-editorial pt-1 border-t border-white/5">
                  <span>Total Amount</span>
                  <span className="text-[#D4AF37] font-bold">{currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}</span>
                </div>
              </div>

              <button
                type="submit"
                form="checkout-form"
                disabled={isSubmitting}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-3.5 text-[10px] font-meta font-bold uppercase tracking-[0.25em] hover:brightness-110 disabled:opacity-40 transition-all shadow-lg"
              >
                {isSubmitting
                  ? 'Allocating...'
                  : `Complete Allocation · ${currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}`}
              </button>
              <button
                type="button"
                onClick={() => setCheckoutStep('cart')}
                className="w-full text-center text-xs text-[#888880] hover:text-[#EDEDED] transition-colors"
              >
                ← Return to Atelier Bag
              </button>
            </div>
          )}

          {checkoutStep === 'confirmed' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onNavigate('/account');
                }}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-3 text-[10px] font-meta font-bold uppercase tracking-[0.2em] hover:brightness-110"
              >
                View in Client Account
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-center text-xs text-[#888880] hover:text-[#EDEDED] transition-colors"
              >
                Continue Atelier Exploration
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
