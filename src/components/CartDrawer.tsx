import React, { useState, useEffect } from 'react';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import { trackEvent } from '../lib/tracker.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';
import { clientAuthFallback } from '../lib/clientAuthFallback.ts';
import { PayWithCard } from './PayWithCard.tsx';
import {
  NIGERIAN_STATES,
  getLgasForState,
  validateNigerianPhone,
  FREE_SHIPPING_THRESHOLD_NGN,
  FREE_SHIPPING_THRESHOLD_USD_CENTS,
} from '../data/nigeriaLocations.ts';

interface CartDrawerProps {
  onNavigate: (url: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onNavigate }) => {
  const { items, itemCount, subtotalCents, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, clearCart } =
    useCart();
  const { user, token } = useAuth();
  const { currency, setCurrency, exchangeRate } = useCurrency();

  const [checkoutStep, setCheckoutStep] = useState<
    'cart' | 'auth_required' | 'shipping' | 'confirming_payment' | 'confirmed' | 'payment_failed'
  >('cart');
  const [paymentMethod, setPaymentMethod] = useState<'card_online' | 'bank_transfer'>('card_online');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [pendingPaymentRef, setPendingPaymentRef] = useState<string>('');
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<'ngn' | 'usd' | null>(null);
  const [paymentNoteSent, setPaymentNoteSent] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Nigerian Logistics State
  const [selectedState, setSelectedState] = useState<string>('Lagos');
  const [selectedLga, setSelectedLga] = useState<string>('Ikeja');
  const [phoneValidation, setPhoneValidation] = useState<{ valid: boolean; formatted: string; error?: string }>({ valid: true, formatted: '' });

  // Form fields
  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: user?.phone || '',
    streetAddress: '',
    apartment: '',
    city: 'Ikeja',
    state: 'Lagos',
    postalCode: '100001',
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

  // Real CJ Logistics Quote state (only surfaces when cart contains CJ-sourced variants)
  const [cjQuoteCountry, setCjQuoteCountry] = useState<string>('NG');
  const [cjQuoteLoading, setCjQuoteLoading] = useState(false);
  const [cjQuoteData, setCjQuoteData] = useState<{
    hasCjItems: boolean;
    options: Array<{
      logisticName: string;
      logisticAging: string;
      totalPostageFeeCents: number;
      totalPostageFeeNgn: number;
    }>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    safeFetchJson<any>('/api/bank-details').then((res) => {
      if (res.ok && res.data) {
        if (res.data.bankSettings) setBankSettings(res.data.bankSettings);
        if (res.data.activeNgn) setActiveNgn(res.data.activeNgn);
        if (res.data.activeUsd) setActiveUsd(res.data.activeUsd);
      }
    });
  }, []);

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        customerName: prev.customerName || user.name,
        customerEmail: prev.customerEmail || user.email,
        customerPhone: prev.customerPhone || user.phone || '',
      }));

      if (token) {
        safeFetchJson<{ addresses: any[] }>('/api/customer/addresses', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((res) => {
          const list = res.ok && res.data?.addresses ? res.data.addresses : [];
          const def = list.find((a) => a.isDefault) || list[0];
          if (def) {
            setSelectedState(def.state || 'Lagos');
            setSelectedLga(def.city || 'Ikeja');
            setFormData((prev) => ({
              ...prev,
              customerName: prev.customerName || def.fullName || user.name,
              customerPhone: prev.customerPhone || def.phone || user.phone || '',
              streetAddress: prev.streetAddress || def.streetAddress || '',
              apartment: prev.apartment || def.apartment || '',
              state: def.state || prev.state,
              city: def.city || prev.city,
              postalCode: def.postalCode || prev.postalCode || '100001',
            }));
          }
        });
      }
    }
  }, [user?.id, token]);

  // Live automatic polling while confirming online Wavy payment
  useEffect(() => {
    if (checkoutStep !== 'confirming_payment' || !confirmedOrder?.orderReference) {
      return;
    }

    let active = true;
    const pollPayment = async () => {
      try {
        const refToCheck = pendingPaymentRef || confirmedOrder.paymentReference || confirmedOrder.orderReference;
        const verifyRes = await safeFetchJson<{
          success?: boolean;
          failed?: boolean;
          pending?: boolean;
          order?: any;
          error?: string;
        }>('/api/payments/wavy/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: refToCheck,
            orderReference: confirmedOrder.orderReference,
          }),
        });

        if (!active) return;

        if (verifyRes.ok && verifyRes.data?.success && verifyRes.data?.order) {
          const paidOrder = verifyRes.data.order;
          setConfirmedOrder(paidOrder);
          if (user) {
            clientAuthFallback.addOrder(user.id, user.email, paidOrder);
          }
          clearCart();
          setCheckoutStep('confirmed');
          return;
        }

        if (verifyRes.data?.failed) {
          setFailureReason(verifyRes.data.error || 'The transaction was declined or cancelled at the gateway.');
          setCheckoutStep('payment_failed');
          return;
        }

        // Fallback status check in case webhook updated DB independently
        const statusRes = await safeFetchJson<any>(
          `/api/orders/status/${encodeURIComponent(confirmedOrder.orderReference)}`
        );
        if (!active) return;
        const statusOrder = statusRes.data?.order || statusRes.data;
        if (statusRes.ok && statusOrder?.paymentStatus === 'paid') {
          setConfirmedOrder(statusOrder);
          if (user) {
            clientAuthFallback.addOrder(user.id, user.email, statusOrder);
          }
          clearCart();
          setCheckoutStep('confirmed');
        } else if (statusRes.ok && statusOrder?.paymentStatus === 'failed') {
          setFailureReason('The payment could not be confirmed and was declined.');
          setCheckoutStep('payment_failed');
        }
      } catch {}
    };

    pollPayment();
    const interval = setInterval(pollPayment, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [checkoutStep, confirmedOrder?.orderReference, pendingPaymentRef, user?.id]);

  // Fetch authoritative CJ carrier freight quotes when viewing shipping step
  useEffect(() => {
    if (!isCartOpen || checkoutStep !== 'shipping' || items.length === 0) return;

    let cancelled = false;
    setCjQuoteLoading(true);
    safeFetchJson<any>('/api/shipping/cj-quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationCountryCode: cjQuoteCountry,
        zip: formData.postalCode || undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      }),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.data) {
          setCjQuoteData({
            hasCjItems: Boolean(res.data.hasCjItems),
            options: Array.isArray(res.data.options) ? res.data.options : [],
            error: res.data.error || (!res.ok ? res.error : undefined),
          });
        } else {
          setCjQuoteData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCjQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isCartOpen, checkoutStep, cjQuoteCountry, items]);

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

  // Real-time currency conversions & state-based delivery fee
  const subtotalNgn = convertUsdCentsToNgn(subtotalCents, exchangeRate);
  const discountNgn = convertUsdCentsToNgn(discountCents, exchangeRate);

  const activeStateInfo = NIGERIAN_STATES.find(
    (s) => s.state.toLowerCase() === (formData.state || selectedState).toLowerCase()
  ) || NIGERIAN_STATES[0];

  const isComplimentaryShipping =
    currency === 'NGN'
      ? subtotalNgn >= FREE_SHIPPING_THRESHOLD_NGN
      : subtotalCents >= FREE_SHIPPING_THRESHOLD_USD_CENTS;
  const shippingFeeNgn = isComplimentaryShipping ? 0 : activeStateInfo.feeNgn;
  const shippingFeeCents = isComplimentaryShipping ? 0 : activeStateInfo.feeUsdCents;

  const totalCents = Math.max(0, subtotalCents - discountCents + shippingFeeCents);
  const totalNgn = Math.max(0, subtotalNgn - discountNgn + shippingFeeNgn);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    setCouponMessage('');
    try {
      const res = await safeFetchJson<{ valid?: boolean; coupon?: any; message?: string }>('/api/coupons/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), subtotalCents }),
      });
      if (res.ok && res.data?.valid && res.data?.coupon) {
        setAppliedCoupon(res.data.coupon);
        setCouponMessage(`✓ Code ${res.data.coupon.code} applied (${res.data.coupon.discountValue}% off)`);
      } else {
        setCouponMessage(res.data?.message || res.error || 'Invalid or expired reservation voucher');
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

  const buildOrderPayload = (method: 'bank_transfer' | 'card_online', payRef?: string) => ({
    customerEmail: formData.customerEmail.trim(),
    customerName: formData.customerName.trim(),
    customerPhone: validateNigerianPhone(formData.customerPhone).formatted || formData.customerPhone.trim(),
    shippingAddress: {
      fullName: formData.customerName.trim(),
      phone: validateNigerianPhone(formData.customerPhone).formatted || formData.customerPhone.trim(),
      streetAddress: formData.streetAddress.trim(),
      apartment: formData.apartment.trim(),
      city: formData.city || selectedLga,
      state: formData.state || selectedState,
      postalCode: formData.postalCode || '100001',
      country: formData.country || 'Nigeria',
    },
    cartItems: items.map((i) => ({
      productId: i.product.id,
      variantId: i.variantId,
      quantity: i.quantity,
    })),
    currency,
    couponCode: appliedCoupon?.code,
    notes: formData.notes,
    paymentMethod: method,
    paymentReference: payRef || null,
    paymentGateway: method === 'card_online' ? 'wavy' : null,
  });

  const validateCheckoutFields = (): string | null => {
    if (!user || !token) {
      setCheckoutStep('auth_required');
      return 'Please sign in or create an account before placing an order.';
    }
    if (!formData.customerName.trim() || !formData.customerEmail.trim() || !formData.streetAddress.trim()) {
      return 'Please complete all required name, email, and delivery address fields.';
    }
    const phoneCheck = validateNigerianPhone(formData.customerPhone);
    setPhoneValidation(phoneCheck);
    if (!phoneCheck.valid) {
      return phoneCheck.error || 'Please provide a valid Nigerian +234 mobile number.';
    }
    return null;
  };

  // Bank Transfer order submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const validationErr = validateCheckoutFields();
    if (validationErr) {
      setErrorMessage(validationErr);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await safeFetchJson<{ order?: any; error?: string; requiresAuth?: boolean }>('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildOrderPayload('bank_transfer')),
      });

      if (res.status === 401 || res.data?.requiresAuth) {
        setCheckoutStep('auth_required');
        return;
      }

      if (res.ok && res.data?.order) {
        setConfirmedOrder(res.data.order);
        if (user) {
          clientAuthFallback.addOrder(user.id, user.email, res.data.order);
        }
        setViewBankCurrency(res.data.order.currency === 'NGN' ? 'NGN' : 'USD');
        setCheckoutStep('confirmed');
        clearCart();
        return;
      }

      setErrorMessage(res.data?.error || res.error || 'Order could not be placed. Please review your details.');
    } catch {
      setErrorMessage('Order could not be finalized. Please check your network or try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Server-first Card Checkout initiation via Wavy (order remains 'pending' until server confirms)
  const handleInitiateOnlineOrder = async () => {
    setErrorMessage('');
    const validationErr = validateCheckoutFields();
    if (validationErr) {
      setErrorMessage(validationErr);
      return null;
    }

    const payRef = `WAVY_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const res = await safeFetchJson<{ order?: any; error?: string; requiresAuth?: boolean }>('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(buildOrderPayload('card_online', payRef)),
    });

    if (res.status === 401 || res.data?.requiresAuth) {
      setCheckoutStep('auth_required');
      return null;
    }

    if (!res.ok || !res.data?.order) {
      setErrorMessage(res.data?.error || res.error || 'Could not reserve inventory for checkout.');
      return null;
    }

    return {
      order: res.data.order,
      paymentReference: payRef,
    };
  };

  const handleGatewaySessionReady = (order: any, payRef: string, checkoutUrl?: string) => {
    setConfirmedOrder(order);
    setPendingPaymentRef(payRef);
    setPendingCheckoutUrl(checkoutUrl || '');
    setFailureReason('');
    setCheckoutStep('confirming_payment');
  };

  const handleCancelOnlinePayment = async () => {
    if (confirmedOrder?.orderReference) {
      await safeFetchJson('/api/payments/wavy/fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference: confirmedOrder.orderReference,
          reference: pendingPaymentRef,
          reason: 'Customer cancelled payment before gateway completion.',
        }),
      });
    }
    setFailureReason('Your payment session was cancelled before authorization. No charges were made and your bag remains intact.');
    setCheckoutStep('payment_failed');
  };

  const handleOnlinePaymentSuccess = async (reference: string) => {
    if (!confirmedOrder) return;
    const res = await safeFetchJson<{ success?: boolean; order?: any }>('/api/payments/wavy/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, orderReference: confirmedOrder.orderReference }),
    });
    if (res.ok && res.data?.success && res.data?.order) {
      setConfirmedOrder(res.data.order);
      if (user) {
        clientAuthFallback.addOrder(user.id, user.email, res.data.order);
      }
      clearCart();
      setCheckoutStep('confirmed');
    }
  };

  const handlePaymentProofSubmit = async () => {
    if (!confirmedOrder || !formData.paymentReference) return;
    setIsSubmitting(true);
    try {
      const res = await safeFetchJson<{ order: any }>('/api/orders/payment-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderReference: confirmedOrder.orderReference,
          notes: formData.paymentReference,
        }),
      });
      if (res.ok && res.data?.order) {
        setConfirmedOrder(res.data.order);
      }
      setPaymentNoteSent(true);
    } catch {
      setPaymentNoteSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md transition-opacity">
      <div className="flex h-full w-full max-w-md flex-col bg-[#0B0B0C] text-[#F5F1E8] border-l border-white/8">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 bg-[#141416]">
          <div className="flex items-center gap-2">
            <span className="font-editorial text-lg text-[#F5F1E8]">
              {checkoutStep === 'cart' && `Shopping Bag (${itemCount})`}
              {checkoutStep === 'auth_required' && 'Account Required'}
              {checkoutStep === 'shipping' && 'Delivery & Payment'}
              {checkoutStep === 'confirming_payment' && 'Confirming Payment'}
              {checkoutStep === 'payment_failed' && 'Payment Failed'}
              {checkoutStep === 'confirmed' && (confirmedOrder?.paymentStatus === 'paid' ? 'Payment Successful' : 'Order Placed')}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96A] font-meta">VANTÉRA</span>
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
          {checkoutStep !== 'confirmed' && checkoutStep !== 'confirming_payment' && checkoutStep !== 'payment_failed' && (
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
                  {items.map(({ product, quantity, variantId, variantLabel, unitPriceCents }) => {
                    const effectiveUnitPrice = unitPriceCents ?? product.retailPriceCents;
                    const itemTotalCents = effectiveUnitPrice * quantity;
                    const itemTotalNgn = convertUsdCentsToNgn(itemTotalCents, exchangeRate);
                    const itemKey = variantId ? `${product.id}::${variantId}` : product.id;

                    return (
                      <div
                        key={itemKey}
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
                          {variantLabel && (
                            <span className="text-[10px] text-[#C8A96A] font-meta block mt-0.5 truncate">
                              {variantLabel}
                            </span>
                          )}
                          <span className="text-[9px] uppercase tracking-[0.2em] text-[#73736E] font-meta block mt-1">{product.category}</span>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center border border-white/10 rounded-xs bg-[#0B0B0B]">
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, quantity - 1, variantId)}
                                className="px-2.5 py-0.5 text-xs text-[#888880] hover:text-[#EDEDED]"
                              >
                                -
                              </button>
                              <span className="px-2 text-xs font-meta text-[#EDEDED]">{quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(product.id, quantity + 1, variantId)}
                                className="px-2.5 py-0.5 text-xs text-[#888880] hover:text-[#EDEDED]"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id, variantId)}
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

          {checkoutStep === 'auth_required' && (
            <div className="space-y-6 py-6 px-2 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#181818] border border-[#D4AF37]/40 text-[#D4AF37] font-editorial text-2xl shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                V
              </div>
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-[0.25em] font-meta text-[#D4AF37] block">
                  Client Account Strictly Required
                </span>
                <h3 className="font-editorial text-xl font-bold text-[#F8F7F4]">
                  Authenticate to Allocate Tech
                </h3>
                <p className="text-xs text-[#8E8B82] max-w-xs mx-auto leading-relaxed">
                  To ensure genuine client data isolation and verified transaction allocation, guest checkout has been decommissioned. Your shopping bag remains saved.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    onNavigate('/account?mode=login&returnTo=cart');
                  }}
                  className="w-full gold-gradient-bg text-[#0B0B0B] py-3.5 text-xs font-meta font-bold uppercase tracking-widest rounded-xs hover:brightness-110 cursor-pointer shadow-lg"
                >
                  Sign In to Existing Account
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    onNavigate('/account?mode=register&returnTo=cart');
                  }}
                  className="w-full bg-[#181818] border border-white/10 text-[#EDEDED] py-3.5 text-xs font-meta uppercase tracking-widest rounded-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Create New Client Account
                </button>

                <button
                  type="button"
                  onClick={() => setCheckoutStep('cart')}
                  className="text-[11px] text-[#73736E] hover:text-[#EDEDED] underline pt-2 block mx-auto cursor-pointer"
                >
                  ← Back to Shopping Bag
                </button>
              </div>
            </div>
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
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="checkout-phone" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880]">
                        WhatsApp / Mobile (+234 format) *
                      </label>
                      {formData.customerPhone && (
                        <span className={`text-[9px] font-mono ${phoneValidation.valid ? 'text-[#10b981]' : 'text-red-400'}`}>
                          {phoneValidation.valid ? '✓ Valid format' : 'Invalid format'}
                        </span>
                      )}
                    </div>
                    <input
                      id="checkout-phone"
                      type="tel"
                      required
                      value={formData.customerPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        const check = validateNigerianPhone(val);
                        setPhoneValidation(check);
                        setFormData({ ...formData, customerPhone: val });
                      }}
                      placeholder="+234 913 279 3670"
                      className={`w-full bg-[#0B0B0B] border px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:outline-hidden ${
                        formData.customerPhone && !phoneValidation.valid
                          ? 'border-red-500/50 focus:border-red-500'
                          : 'border-white/10 focus:border-[#D4AF37]'
                      }`}
                    />
                    {formData.customerPhone && !phoneValidation.valid && (
                      <p className="text-[10px] text-red-400 mt-1">{phoneValidation.error}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#121212] p-5 border border-white/5 space-y-3 rounded-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-meta uppercase tracking-[0.25em] text-[#D4AF37]">
                    Delivery Sanctuary
                  </h4>
                  <span className="text-[9px] font-meta uppercase tracking-wider text-[#10b981]">
                    ⚡ {activeStateInfo.deliveryEstimate}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-state" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">
                      Nigerian State / FCT *
                    </label>
                    <select
                      id="checkout-state"
                      value={formData.state || selectedState}
                      onChange={(e) => {
                        const newState = e.target.value;
                        setSelectedState(newState);
                        const lgas = getLgasForState(newState);
                        const defaultLga = lgas[0] || '';
                        setSelectedLga(defaultLga);
                        setFormData({ ...formData, state: newState, city: defaultLga });
                      }}
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden"
                    >
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s.state} value={s.state} className="bg-[#121212] text-[#EDEDED]">
                          {s.state} — {currency === 'NGN' ? formatNGN(s.feeNgn) : formatUSD(s.feeUsdCents)} ({s.deliveryEstimate})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="checkout-city" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">
                        LGA / Major City *
                      </label>
                      <select
                        id="checkout-city"
                        value={formData.city || selectedLga}
                        onChange={(e) => {
                          setSelectedLga(e.target.value);
                          setFormData({ ...formData, city: e.target.value });
                        }}
                        className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden"
                      >
                        {getLgasForState(formData.state || selectedState).map((city) => (
                          <option key={city} value={city} className="bg-[#121212] text-[#EDEDED]">
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="checkout-postal" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">
                        Postal Code
                      </label>
                      <input
                        id="checkout-postal"
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="100001"
                        className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="checkout-street" className="block text-[10px] font-meta uppercase tracking-wider text-[#888880] mb-1">
                      Full Street Address / Building Details *
                    </label>
                    <input
                      id="checkout-street"
                      type="text"
                      required
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                      placeholder="e.g. Plot 14 Admiralty Way, Lekki Phase 1"
                      className="w-full bg-[#0B0B0B] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] placeholder-[#444] focus:border-[#D4AF37] focus:outline-hidden"
                    />
                  </div>

                  <div className="bg-[#0B0B0B] p-2.5 border border-white/5 rounded-xs flex items-center justify-between text-[11px] font-meta">
                    <span className="text-[#888880]">Estimated Delivery:</span>
                    <span className="text-[#D4AF37] font-semibold">{activeStateInfo.deliveryEstimate}</span>
                  </div>

                  {cjQuoteData?.hasCjItems && (
                    <div className="bg-[#0B0B0B] p-3 border border-white/10 rounded-xs space-y-2 text-[11px] font-meta">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-[#D4AF37]">
                          Global Supplier Freight Estimate
                        </span>
                        <select
                          aria-label="CJ freight destination country"
                          value={cjQuoteCountry}
                          onChange={(e) => setCjQuoteCountry(e.target.value)}
                          className="bg-[#141416] border border-white/15 px-2 py-0.5 text-[10px] text-[#EDEDED]"
                        >
                          <option value="NG">Nigeria (NG)</option>
                          <option value="US">United States (US)</option>
                          <option value="GB">United Kingdom (GB)</option>
                          <option value="CA">Canada (CA)</option>
                          <option value="GH">Ghana (GH)</option>
                        </select>
                      </div>
                      {cjQuoteLoading ? (
                        <p className="text-[10px] text-[#888880]">Checking live carrier schedules...</p>
                      ) : cjQuoteData.error ? (
                        <p className="text-[10px] text-[#E57373]">{cjQuoteData.error}</p>
                      ) : cjQuoteData.options.length > 0 ? (
                        <div className="space-y-1">
                          {cjQuoteData.options.slice(0, 3).map((opt) => (
                            <div key={opt.logisticName} className="flex items-center justify-between gap-2 text-[10px]">
                              <span className="text-[#EDEDED] truncate">
                                {opt.logisticName} ({opt.logisticAging})
                              </span>
                              <span className="text-[#D4AF37] shrink-0 font-mono">
                                {currency === 'NGN'
                                  ? formatNGN(opt.totalPostageFeeNgn)
                                  : formatUSD(opt.totalPostageFeeCents)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#888880]">
                          No international carrier methods returned for {cjQuoteCountry}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Selector: Wavy vs Bank Transfer */}
              <div className="bg-[#121212] p-4 border border-white/5 space-y-3 rounded-xs">
                <span className="text-[9px] font-meta uppercase tracking-[0.25em] text-[#D4AF37] font-semibold block">
                  Select Settlement Channel
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card_online')}
                    className={`p-3 text-left border rounded-xs transition-all cursor-pointer ${
                      paymentMethod === 'card_online'
                        ? 'border-[#D4AF37] bg-[#181818] shadow-sm'
                        : 'border-white/5 bg-[#0B0B0B] text-[#888880] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-editorial font-bold ${paymentMethod === 'card_online' ? 'text-[#D4AF37]' : 'text-[#EDEDED]'}`}>
                        Card / Wavy
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#0F2E22] text-[#48BB78] rounded-xs uppercase">
                        LIVE
                      </span>
                    </div>
                    <p className="text-[10px] text-[#888880] leading-tight">
                      Mastercard, Visa, Verve & Apple Pay via Wavy.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-3 text-left border rounded-xs transition-all cursor-pointer ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-[#D4AF37] bg-[#181818] shadow-sm'
                        : 'border-white/5 bg-[#0B0B0B] text-[#888880] hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-editorial font-bold ${paymentMethod === 'bank_transfer' ? 'text-[#D4AF37]' : 'text-[#EDEDED]'}`}>
                        Direct Wire
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#2D2412] text-[#D4AF37] rounded-xs uppercase">
                        GTB/ZENITH
                      </span>
                    </div>
                    <p className="text-[10px] text-[#888880] leading-tight">
                      Instant bank transfer with automated narration.
                    </p>
                  </button>
                </div>

                {paymentMethod === 'card_online' ? (
                  <div className="pt-2">
                    <PayWithCard
                      email={formData.customerEmail}
                      customerName={formData.customerName}
                      customerPhone={formData.customerPhone}
                      amountKobo={totalNgn * 100}
                      centsUSD={totalCents}
                      currency={currency}
                      exchangeRate={exchangeRate}
                      orderReference={`VAN-${Date.now().toString(36).toUpperCase()}`}
                      onInitiateOrderCheckout={handleInitiateOnlineOrder}
                      onGatewaySessionReady={handleGatewaySessionReady}
                      onPaymentSuccess={handleOnlinePaymentSuccess}
                      onPaymentFailed={(reason) => {
                        setFailureReason(reason);
                      }}
                      disabled={!formData.customerName || !formData.customerEmail || !formData.streetAddress}
                    />
                  </div>
                ) : (
                  <div className="border border-[#D4AF37]/30 bg-[#0F2E22]/20 p-4 space-y-2 rounded-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-editorial text-xs text-[#D4AF37]">
                        {currency === 'NGN' ? 'Nigerian Naira Bank Settlement' : 'USD Global Wire Transfer'}
                      </span>
                      <span className="text-[10px] font-meta bg-[#0B0B0B] text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded-xs">
                        {currency}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A0A09A] font-meta leading-relaxed">
                      You are allocating in <strong>{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'United States Dollar ($)'}</strong>. Bank transfer orders remain Awaiting Payment until verified by CEO Adnuel.
                    </p>
                  </div>
                )}
              </div>
            </form>
          )}

          {checkoutStep === 'confirming_payment' && confirmedOrder && (
            <div className="py-12 px-4 text-center space-y-6">
              <div className="w-12 h-12 rounded-full border border-[#C8A96A]/40 flex items-center justify-center mx-auto font-editorial text-xl text-[#C8A96A]">
                V
              </div>

              <div className="w-36 h-0.5 bg-white/10 mx-auto overflow-hidden rounded-full">
                <div className="h-full w-1/2 bg-[#C8A96A] vantera-loader-bar" />
              </div>

              <div className="space-y-2.5">
                <span className="text-[10px] font-meta uppercase tracking-[0.22em] text-[#C8A96A] block">
                  Live Gateway Verification
                </span>
                <h3 className="font-editorial text-2xl font-medium text-[#F5F1E8]">
                  Confirming your payment...
                </h3>
                <p className="text-xs text-[#A8A297] leading-relaxed max-w-xs mx-auto">
                  Waiting for Wavy to confirm payment for{' '}
                  <strong className="text-[#C8A96A] font-mono">{confirmedOrder.orderReference}</strong> (
                  {confirmedOrder.currency === 'NGN'
                    ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                    : formatUSD(confirmedOrder.totalCents)}
                  ). This screen updates automatically — no refresh needed.
                </p>
              </div>

              {pendingCheckoutUrl && (
                <a
                  href={pendingCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full gold-gradient-bg py-3 text-[11px] font-meta font-semibold uppercase tracking-[0.2em] rounded-xs"
                >
                  Open Wavy Payment Window ↗
                </a>
              )}

              <button
                type="button"
                onClick={handleCancelOnlinePayment}
                className="w-full border border-white/12 text-[#A8A297] hover:text-red-400 hover:border-red-500/30 py-2.5 text-[11px] uppercase tracking-[0.16em] font-meta rounded-xs cursor-pointer transition-colors"
              >
                Cancel Payment & Keep Bag Intact
              </button>
            </div>
          )}

          {checkoutStep === 'payment_failed' && (
            <div className="border border-red-500/30 bg-red-950/20 p-6 text-center space-y-4 rounded-xs my-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-950/50 border border-red-500/40 text-red-400 text-xl font-bold">
                ✕
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-400 block">
                  TRANSACTION NOT COMPLETED
                </span>
                <h3 className="font-editorial text-xl font-bold text-[#F8F7F4]">
                  Payment Failed
                </h3>
                <p className="text-xs text-[#8E8B82] leading-relaxed">
                  {failureReason || 'Your card authorization could not be completed. No charge was captured and your bag items remain intact.'}
                </p>
              </div>
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setCheckoutStep('shipping');
                  }}
                  className="w-full gold-gradient-bg text-[#0B0B0B] py-3 text-xs font-meta font-bold uppercase tracking-widest rounded-xs hover:brightness-110 cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutStep('cart')}
                  className="w-full border border-white/10 text-[#EDEDED] py-2.5 text-xs font-meta uppercase tracking-wider rounded-xs hover:border-[#D4AF37] cursor-pointer"
                >
                  Return to Atelier Bag
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 'confirmed' && confirmedOrder && (
            <div className="space-y-5">
              {/* Prominent Real-World Payment Status Banner */}
              <div
                className={`p-6 text-center rounded-xs border ${
                  confirmedOrder.paymentStatus === 'paid'
                    ? 'border-[#34A853]/40 bg-[#0F2E22]/50'
                    : 'border-[#D4AF37]/30 bg-[#2D2412]/30'
                }`}
              >
                <span className="text-3xl text-[#D4AF37]">
                  {confirmedOrder.paymentStatus === 'paid' ? '✓' : '✦'}
                </span>
                <div className="mt-2 inline-block">
                  <span
                    className={`px-3 py-1 text-[10px] font-mono font-bold tracking-widest uppercase rounded-xs ${
                      confirmedOrder.paymentStatus === 'paid'
                        ? 'bg-[#0F2E22] text-[#48BB78] border border-[#34A853]/40'
                        : 'bg-[#181818] text-[#D4AF37] border border-[#D4AF37]/40'
                    }`}
                  >
                    STATUS: {confirmedOrder.paymentStatus === 'paid' ? 'PAID & VERIFIED' : 'AWAITING PAYMENT'}
                  </span>
                </div>
                <h3 className="mt-2 font-editorial text-lg font-medium text-[#F5F5F0]">
                  {confirmedOrder.paymentStatus === 'paid'
                    ? 'Payment Successful'
                    : 'Reservation Placed — Awaiting Bank Transfer'}
                </h3>
                <p className="mt-1 text-xs text-[#A0A09A] font-meta">
                  Order Number: <strong className="font-mono text-sm text-[#D4AF37]">{confirmedOrder.orderReference}</strong>
                </p>
                {confirmedOrder.paymentReference && (
                  <p className="text-[10px] font-mono text-[#888880] mt-0.5">
                    Gateway Reference: {confirmedOrder.paymentReference}
                  </p>
                )}
                <div className="mt-3 bg-[#0B0B0B] p-3 border border-white/10 inline-block rounded-xs">
                  <span className="text-[9px] uppercase font-meta tracking-[0.2em] text-[#888880] block">
                    {confirmedOrder.paymentStatus === 'paid' ? `Amount Paid (${confirmedOrder.currency})` : `Due (${confirmedOrder.currency})`}
                  </span>
                  <strong className="text-xl font-editorial text-[#D4AF37]">
                    {confirmedOrder.currency === 'NGN'
                      ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                      : formatUSD(confirmedOrder.totalCents)}
                  </strong>
                </div>
              </div>

              {/* Order Items & Delivery Summary Receipt */}
              <div className="border border-white/5 bg-[#121212] p-4 rounded-xs space-y-3 text-xs font-meta">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] block font-semibold">
                  Order Receipt & Delivery
                </span>
                <div className="divide-y divide-white/5">
                  {(confirmedOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[#EDEDED] block truncate">{item.title}</span>
                        <span className="text-[10px] text-[#73736E]">Qty: {item.quantity}</span>
                      </div>
                      <span className="text-[#D4AF37] font-mono shrink-0">
                        {confirmedOrder.currency === 'NGN'
                          ? formatNGN(convertUsdCentsToNgn(item.totalCents || 0, confirmedOrder.exchangeRateUsed || exchangeRate))
                          : formatUSD(item.totalCents || 0)}
                      </span>
                    </div>
                  ))}
                </div>
                {confirmedOrder.shippingAddress && (
                  <div className="pt-2 border-t border-white/5 text-[11px] text-[#8E8B82] space-y-0.5">
                    <div className="text-[#EDEDED] font-semibold">{confirmedOrder.shippingAddress.fullName}</div>
                    <div>
                      {confirmedOrder.shippingAddress.streetAddress}, {confirmedOrder.shippingAddress.city},{' '}
                      {confirmedOrder.shippingAddress.state}
                    </div>
                    <div>{confirmedOrder.shippingAddress.phone}</div>
                    {confirmedOrder.estimatedTransitTime && (
                      <div className="text-[#D4AF37]">Estimated Delivery: {confirmedOrder.estimatedTransitTime}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Bank Account Coordinates & Proof (only shown for unpaid Bank Transfer orders) */}
              {confirmedOrder.paymentStatus !== 'paid' && (
                <>
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
                </>
              )}

              {/* Direct WhatsApp link to CEO */}
              <div className="text-center pt-2">
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello CEO Adnuel, regarding VANTÉRA order ${confirmedOrder.orderReference} (${
                      confirmedOrder.currency === 'NGN'
                        ? formatNGN(convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate))
                        : formatUSD(confirmedOrder.totalCents)
                    }).`
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
                  if (!user) {
                    setCheckoutStep('auth_required');
                  } else {
                    setCheckoutStep('shipping');
                  }
                }}
                className="w-full gold-gradient-bg text-[#0B0B0B] py-3.5 text-[10px] font-meta font-bold uppercase tracking-[0.25em] shadow-lg hover:brightness-110 active:scale-98 transition-all cursor-pointer"
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

              {paymentMethod === 'bank_transfer' && (
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className="w-full gold-gradient-bg text-[#0B0B0B] py-3.5 text-[10px] font-meta font-bold uppercase tracking-[0.25em] hover:brightness-110 disabled:opacity-40 transition-all shadow-lg"
                >
                  {isSubmitting
                    ? 'Allocating...'
                    : `Place Bank Transfer Order · ${currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}`}
                </button>
              )}
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
