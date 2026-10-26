import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn, formatPrice } from '../lib/commerceLogic.ts';
import { trackEvent } from '../lib/tracker.ts';
import { PayWithCard } from './PayWithCard.tsx';

interface CartDrawerProps {
  onNavigate: (url: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onNavigate }) => {
  const { items, itemCount, subtotalCents, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, clearCart } =
    useCart();
  const { user, token } = useAuth();
  const { currency, setCurrency, exchangeRate, formatAmount } = useCurrency();

  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping' | 'bank_instructions' | 'confirmed'>('cart');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<'ngn' | 'usd' | null>(null);
  const [paymentNoteSent, setPaymentNoteSent] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card_online' | 'bank_transfer'>('card_online');
  const [paystackConfig, setPaystackConfig] = useState<{ paystackEnabled: boolean; paystackPublicKey: string } | null>(null);
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

    fetch('/api/payment-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setPaystackConfig(data);
          if (!data.paystackEnabled) {
            setPaymentMethod('bank_transfer');
          }
        }
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
        setCouponMessage(data.message || 'Invalid or expired promo code');
      }
    } catch {
      setCouponMessage('Unable to validate promo code');
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
    <div className="drawer-backdrop fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
      <div className="cart-drawer flex h-full w-full max-w-md flex-col bg-[#f8f7f4] text-[#121210] shadow-2xl">
        {/* Drawer Header */}
        <div className="cart-drawer__header flex items-center justify-between border-b border-[#e7e4de] px-6 py-4 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-medium">
              {checkoutStep === 'cart' && `Review Cart (${itemCount})`}
              {checkoutStep === 'shipping' && 'Delivery Information'}
              {checkoutStep === 'confirmed' && 'Order Placed'}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[#c4a66b] font-mono">VANTÉRA</span>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close cart drawer"
            className="rounded-full p-2 text-[#77746d] hover:bg-[#eae7e0] hover:text-[#121210]"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Real-Time Currency Selector & Live Rate Bar */}
          {checkoutStep !== 'confirmed' && (
            <div className="bg-[#121210] text-[#f8f7f4] p-4 border border-[#252521] shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#c4a66b] font-bold">
                  Payment Currency
                </span>
                <span className="text-[10px] font-mono text-[#a9a69f] flex items-center gap-1.5 bg-[#1f1f1c] px-2 py-0.5 rounded-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
                  <span>1 USD = ₦{exchangeRate.toLocaleString()}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-[#c4a66b] text-[#121210] border-[#c4a66b] font-bold shadow-xs'
                      : 'bg-[#181816] text-[#d1d5db] border-[#2e2e2a] hover:border-[#77746d]'
                  }`}
                >
                  <span>🇺🇸</span>
                  <span>US Dollar ($ USD)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('NGN')}
                  className={`py-2 px-3 text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    currency === 'NGN'
                      ? 'bg-[#c4a66b] text-[#121210] border-[#c4a66b] font-bold shadow-xs'
                      : 'bg-[#181816] text-[#d1d5db] border-[#2e2e2a] hover:border-[#77746d]'
                  }`}
                >
                  <span>🇳🇬</span>
                  <span>Naira (₦ NGN)</span>
                </button>
              </div>

              <div className="pt-1.5 border-t border-[#252521] flex items-center justify-between text-[10px] text-[#a9a69f]">
                <span>
                  Active Total:{' '}
                  <strong className="text-white">
                    {currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}
                  </strong>
                </span>
                <span className="text-[#c4a66b] font-mono">
                  ~{currency === 'NGN' ? formatUSD(totalCents) : formatNGN(totalNgn)}
                </span>
              </div>
            </div>
          )}

          {checkoutStep === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[#77746d]">
                  <div className="mb-4 text-4xl font-serif">V</div>
                  <p className="text-sm font-medium text-[#121210]">Your review cart is empty</p>
                  <p className="mt-1 text-xs">Explore phone protection, charging, and audio essentials.</p>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      onNavigate('/shop');
                    }}
                    className="mt-6 bg-[#121210] px-5 py-2.5 text-xs text-[#f8f7f4] hover:bg-[#c4a66b] hover:text-[#121210]"
                  >
                    Browse collection
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
                        className="flex items-start gap-4 border border-[#e7e4de] bg-white p-3.5 shadow-xs"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden bg-[#f4f2ee] p-1 border border-[#e7e4de]">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.title}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-serif text-xs text-[#77746d]">
                              V
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs font-medium text-[#121210] line-clamp-1">{product.title}</h4>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-semibold text-[#121210] block">
                                {currency === 'NGN' ? formatNGN(itemTotalNgn) : formatUSD(itemTotalCents)}
                              </span>
                              <span className="text-[9px] text-[#77746d] font-mono block">
                                ~{currency === 'NGN' ? formatUSD(itemTotalCents) : formatNGN(itemTotalNgn)}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase text-[#77746d] block mt-0.5">{product.category}</span>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center border border-[#e7e4de]">
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, quantity - 1)}
                                className="px-2 py-0.5 text-xs hover:bg-[#eae7e0]"
                              >
                                -
                              </button>
                              <span className="px-2.5 text-xs font-mono">{quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, quantity + 1)}
                                className="px-2 py-0.5 text-xs hover:bg-[#eae7e0]"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              className="text-[10px] text-[#9b1c1c] hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Promo Code Input */}
                  <div className="border border-[#e7e4de] bg-white p-3 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#77746d] block">
                      Promotional Voucher
                    </span>
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="e.g. VANTERA10"
                        className="flex-1 border border-[#e7e4de] px-2.5 py-1.5 text-xs uppercase font-mono focus:border-[#121210] focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="bg-[#121210] text-[#f8f7f4] px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] disabled:opacity-50"
                      >
                        {isApplyingCoupon ? '...' : 'Apply'}
                      </button>
                    </form>
                    {couponMessage && (
                      <p className={`text-[10px] font-mono ${couponMessage.startsWith('✓') ? 'text-[#1e7e34]' : 'text-[#9b1c1c]'}`}>
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
                <div className="border border-[#f8b4b4] bg-[#fdf2f2] p-3 text-xs text-[#9b1c1c]">
                  {errorMessage}
                </div>
              )}

              <div className="bg-white p-4 border border-[#e7e4de]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210] mb-3">
                  Customer & Contact
                </h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-name" className="block text-[10px] text-[#77746d] mb-1">Full Name *</label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="e.g. Emmanuel Adarikwu"
                      className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-email" className="block text-[10px] text-[#77746d] mb-1">Email Address (Order Confirmation) *</label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="e.g. emmanuel@example.com"
                      className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-[10px] text-[#77746d] mb-1">WhatsApp / Phone *</label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="e.g. +234 913 279 3670"
                      className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 border border-[#e7e4de]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210] mb-3">
                  Delivery Address
                </h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-street" className="block text-[10px] text-[#77746d] mb-1">Street Address *</label>
                    <input
                      id="checkout-street"
                      type="text"
                      required
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                      placeholder="e.g. 14 Victoria Island Way"
                      className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="checkout-city" className="block text-[10px] text-[#77746d] mb-1">City *</label>
                      <input
                        id="checkout-city"
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="e.g. Lagos"
                        className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label htmlFor="checkout-state" className="block text-[10px] text-[#77746d] mb-1">State / Province *</label>
                      <input
                        id="checkout-state"
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        placeholder="e.g. Lagos State"
                        className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#77746d] mb-1">Country *</label>
                    <input
                      type="text"
                      required
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Direct Bank Transfer Notice with Currency details */}
              <div className="border border-[#c4a66b]/40 bg-[#fffdfa] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-[#9d8048]">
                    🏦 {currency === 'NGN' ? 'Nigerian Naira Bank Transfer' : 'USD Wire / Direct Transfer'}
                  </span>
                  <span className="text-[10px] font-mono bg-[#121210] text-[#c4a66b] px-2 py-0.5 rounded-xs">
                    {currency}
                  </span>
                </div>
                <p className="text-[11px] text-[#77746d] leading-relaxed">
                  You are paying in <strong>{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'United States Dollar ($)'}</strong>. Upon placing your order, you will receive your unique reference (e.g. VAN-2026-XXXX) and our official {currency} bank transfer details for immediate CEO verification.
                </p>
              </div>
            </form>
          )}

          {checkoutStep === 'confirmed' && confirmedOrder && (
            <div className="space-y-6">
              <div className="border border-[#c3e6cb] bg-[#eef8ee] p-5 text-center">
                <span className="text-2xl">✓</span>
                <h3 className="mt-2 font-serif text-lg font-bold text-[#1e7e34]">Order Placed Successfully</h3>
                <p className="mt-1 text-xs text-[#252521]">
                  Reference: <strong className="font-mono text-sm">{confirmedOrder.orderReference}</strong>
                </p>
                <div className="mt-2 bg-white/80 p-2.5 border border-[#c3e6cb] inline-block">
                  <span className="text-[10px] uppercase font-mono text-[#77746d] block">Total Amount Due</span>
                  <strong className="text-lg text-[#121210]">
                    {confirmedOrder.currency === 'NGN'
                      ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                      : formatUSD(confirmedOrder.totalCents)}
                  </strong>
                  <span className="text-[10px] text-[#77746d] font-mono block">
                    ~
                    {confirmedOrder.currency === 'NGN'
                      ? formatUSD(confirmedOrder.totalCents)
                      : formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))}
                  </span>
                </div>
              </div>

              {/* Bank Account Toggle Switcher */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold uppercase tracking-wider text-xs text-[#121210]">
                    Official Bank Transfer Details
                  </h4>
                  <div className="flex border border-[#e7e4de] text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setViewBankCurrency('NGN')}
                      className={`px-2 py-1 transition-colors ${
                        viewBankCurrency === 'NGN'
                          ? 'bg-[#121210] text-white font-bold'
                          : 'bg-white text-[#77746d] hover:text-[#121210]'
                      }`}
                    >
                      ₦ NGN Bank
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewBankCurrency('USD')}
                      className={`px-2 py-1 transition-colors ${
                        viewBankCurrency === 'USD'
                          ? 'bg-[#121210] text-white font-bold'
                          : 'bg-white text-[#77746d] hover:text-[#121210]'
                      }`}
                    >
                      $ USD Wire
                    </button>
                  </div>
                </div>

                {viewBankCurrency === 'NGN' ? (
                  <div className="border border-[#e7e4de] bg-white p-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#e7e4de] pb-2">
                      <span className="font-bold uppercase tracking-wider text-[#1e7e34]">Nigerian Naira (₦) Account</span>
                      <span className="text-[10px] bg-[#eef8ee] text-[#1e7e34] px-1.5 py-0.5 font-mono">Active GTBank</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#77746d] block">Bank Name</span>
                        <strong>{activeNgn?.bankName || bankSettings.bankName}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#77746d] block">Account Number</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-sm tracking-wide text-[#121210]">
                            {activeNgn?.accountNumber || bankSettings.accountNumber}
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeNgn?.accountNumber || bankSettings.accountNumber);
                              setCopiedKey('ngn');
                              setTimeout(() => setCopiedKey(null), 2000);
                            }}
                            className="text-[10px] text-[#c4a66b] font-mono hover:underline font-bold"
                            title="Copy Account Number"
                          >
                            {copiedKey === 'ngn' ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-[#77746d] block">Account Name</span>
                        <strong>{activeNgn?.accountName || bankSettings.accountName}</strong>
                      </div>
                      <div className="col-span-2 bg-[#f8f7f4] p-2 border border-[#e7e4de]">
                        <span className="text-[10px] text-[#77746d] block font-medium">Payment Narration / Reference</span>
                        <strong className="font-mono text-xs text-[#9d8048]">{confirmedOrder.orderReference}</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#77746d] leading-relaxed mt-2">
                      {activeNgn?.instructions || bankSettings.instructions}
                    </p>
                  </div>
                ) : (
                  <div className="border border-[#e7e4de] bg-white p-5 space-y-3 text-xs">
                    <div className="flex items-center justify-between border-b border-[#e7e4de] pb-2">
                      <span className="font-bold uppercase tracking-wider text-[#121210]">USD Global Settlement Wire</span>
                      <span className="text-[10px] bg-[#f4f2ee] text-[#121210] px-1.5 py-0.5 font-mono">Mercury / Wire</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-[#77746d] block">Bank Name</span>
                        <strong>{activeUsd?.bankName || 'VANTÉRA Global Settlement (Mercury / Wire)'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#77746d] block">Account Number</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-sm tracking-wide text-[#121210]">
                            {activeUsd?.accountNumber || '984102938471'}
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(activeUsd?.accountNumber || '984102938471');
                              setCopiedKey('usd');
                              setTimeout(() => setCopiedKey(null), 2000);
                            }}
                            className="text-[10px] text-[#c4a66b] font-mono hover:underline font-bold"
                            title="Copy Account Number"
                          >
                            {copiedKey === 'usd' ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#77746d] block">Routing Number</span>
                        <strong className="font-mono">{activeUsd?.sortCodeOrRouting || '021000021'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#77746d] block">SWIFT / BIC</span>
                        <strong className="font-mono">{activeUsd?.swiftBic || 'MERCUS33XXX'}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-[#77746d] block">Account Name</span>
                        <strong>{activeUsd?.accountName || 'VANTÉRA ENTERPRISES - Adnuel'}</strong>
                      </div>
                      <div className="col-span-2 bg-[#f8f7f4] p-2 border border-[#e7e4de]">
                        <span className="text-[10px] text-[#77746d] block font-medium">Payment Narration / Reference</span>
                        <strong className="font-mono text-xs text-[#9d8048]">{confirmedOrder.orderReference}</strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#77746d] leading-relaxed mt-2">
                      {activeUsd?.instructions || 'Wire transfer total in USD referencing your Order Reference in the memo.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Payment Proof Submission */}
              <div className="border border-[#e7e4de] bg-white p-5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">
                  Submit Payment Reference / Notes
                </h4>
                <p className="text-[11px] text-[#77746d]">
                  Already transferred? Enter your transaction ID, sender name, or narration to expedite CEO verification:
                </p>
                <input
                  type="text"
                  placeholder="e.g. Transferred via bank app, Ref #984210"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                  className="w-full border border-[#e7e4de] px-3 py-2 text-xs focus:border-[#121210] focus:outline-hidden"
                />
                {paymentNoteSent ? (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium text-center">
                    ✓ Payment note received! CEO Adnuel has been notified for verification.
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting || !formData.paymentReference}
                    onClick={handlePaymentProofSubmit}
                    className="w-full bg-[#121210] py-2.5 text-xs text-[#f8f7f4] hover:bg-[#c4a66b] hover:text-[#121210] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'I Have Transferred · Notify CEO'}
                  </button>
                )}
              </div>

              {/* Direct WhatsApp link to CEO */}
              <div className="text-center">
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello CEO Adnuel, I placed VANTÉRA order ${confirmedOrder.orderReference} for ${
                      confirmedOrder.currency === 'NGN'
                        ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                        : formatUSD(confirmedOrder.totalCents)
                    }. Here are my payment transfer details.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#1e7e34] hover:underline"
                >
                  <span>Chat directly with CEO Adnuel on WhatsApp (+234 913 279 3670)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="cart-drawer__bottom border-t border-[#e7e4de] bg-white p-6">
          {checkoutStep === 'cart' && items.length > 0 && (
            <div>
              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex justify-between text-[#77746d]">
                  <span>Subtotal</span>
                  <div className="text-right">
                    <span className="font-medium text-[#121210]">
                      {currency === 'NGN' ? formatNGN(subtotalNgn) : formatUSD(subtotalCents)}
                    </span>
                    <span className="text-[10px] text-[#77746d] block font-mono">
                      ~{currency === 'NGN' ? formatUSD(subtotalCents) : formatNGN(subtotalNgn)}
                    </span>
                  </div>
                </div>

                {discountCents > 0 && (
                  <div className="flex justify-between text-[#1e7e34]">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <div className="text-right">
                      <span>-{currency === 'NGN' ? formatNGN(discountNgn) : formatUSD(discountCents)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between text-[#77746d]">
                  <span>Delivery fee</span>
                  <span>
                    {shippingFeeCents === 0
                      ? 'Free (over $50 / ₦75k)'
                      : currency === 'NGN'
                      ? formatNGN(shippingFeeNgn)
                      : formatUSD(shippingFeeCents)}
                  </span>
                </div>

                <div className="flex justify-between font-semibold text-sm text-[#121210] pt-2 border-t border-[#e7e4de]">
                  <div>
                    <span>Total ({currency})</span>
                    <span className="text-[10px] text-[#77746d] block font-normal font-mono">
                      ~{currency === 'NGN' ? formatUSD(totalCents) : formatNGN(totalNgn)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-base text-[#121210]">
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
                className="w-full bg-[#121210] !text-white py-3 text-xs uppercase tracking-widest font-semibold transition-colors hover:bg-[#c4a66b] hover:!text-[#121210]"
              >
                Proceed to Checkout
              </button>
            </div>
          )}

          {checkoutStep === 'shipping' && (
            <div className="space-y-3">
              <div className="bg-[#f8f7f4] p-3 border border-[#e7e4de] text-xs space-y-1">
                <div className="flex justify-between text-[#77746d]">
                  <span>Payment Currency</span>
                  <strong className="text-[#121210]">{currency === 'NGN' ? 'Nigerian Naira (₦ NGN)' : 'US Dollar ($ USD)'}</strong>
                </div>
                <div className="flex justify-between font-bold text-[#121210] pt-1 border-t border-[#e7e4de]">
                  <span>Total Due</span>
                  <span>{currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}</span>
                </div>
              </div>

              <button
                type="submit"
                form="checkout-form"
                disabled={isSubmitting}
                className="w-full bg-[#121210] !text-white py-3 text-xs uppercase tracking-widest font-semibold transition-colors hover:bg-[#c4a66b] hover:!text-[#121210] disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Placing order...'
                  : `Complete Order · ${currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}`}
              </button>
              <button
                type="button"
                onClick={() => setCheckoutStep('cart')}
                className="w-full text-center text-xs text-[#77746d] hover:text-[#121210]"
              >
                ← Back to Cart Review
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
                className="w-full bg-[#121210] !text-white py-3 text-xs uppercase tracking-widest font-semibold hover:bg-[#c4a66b] hover:!text-[#121210]"
              >
                View in My Account Orders
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-center text-xs text-[#77746d] hover:text-[#121210]"
              >
                Continue Browsing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
