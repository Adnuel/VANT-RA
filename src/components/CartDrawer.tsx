import React, { useState, useEffect } from 'react';
import { Check, Copy, Lock, MessageCircle, Minus, Plus, X } from 'lucide-react';
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
  const {
    items,
    itemCount,
    subtotalCents,
    isCartOpen,
    setIsCartOpen,
    checkoutStep,
    setCheckoutStep,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();
  const { user, token } = useAuth();
  const { currency, setCurrency, exchangeRate } = useCurrency();

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
  const [phoneValidation, setPhoneValidation] = useState<{ valid: boolean; formatted: string; error?: string }>({
    valid: true,
    formatted: '',
  });

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

  const activeStateInfo =
    NIGERIAN_STATES.find((s) => s.state.toLowerCase() === (formData.state || selectedState).toLowerCase()) ||
    NIGERIAN_STATES[0];

  const isComplimentaryShipping =
    currency === 'NGN' ? subtotalNgn >= FREE_SHIPPING_THRESHOLD_NGN : subtotalCents >= FREE_SHIPPING_THRESHOLD_USD_CENTS;
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
        setCouponMessage(res.data?.message || res.error || 'Invalid or expired voucher code');
      }
    } catch {
      setCouponMessage('Unable to validate voucher');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleClose = () => {
    setIsCartOpen(false);
    if (checkoutStep === 'confirmed' || checkoutStep === 'payment_failed') {
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

  // Server-first Card Checkout initiation via Wavy
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag Drawer"
      className="vantera-overlay-fade fixed inset-0 z-50 flex justify-end bg-[#111111]/55 backdrop-blur-xs"
    >
      <div className="vantera-slide-in-right flex h-full w-full max-w-md flex-col bg-[#F7F3EC] text-[#111111] border-l border-[#111111]/12 font-meta">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#111111]/10 px-5 py-4 bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <span className="font-editorial text-lg font-medium text-[#111111]">
              {checkoutStep === 'cart' && `Shopping Bag (${itemCount})`}
              {checkoutStep === 'auth_required' && 'Client Access'}
              {checkoutStep === 'shipping' && 'Delivery & Payment'}
              {checkoutStep === 'confirming_payment' && 'Confirming Payment'}
              {checkoutStep === 'payment_failed' && 'Payment Failed'}
              {checkoutStep === 'confirmed' &&
                (confirmedOrder?.paymentStatus === 'paid' ? 'Payment Successful' : 'Order Placed')}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#7A6230] font-semibold">VANTÉRA</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close bag drawer"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#5C574E] hover:text-[#111111] hover:bg-[#111111]/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Real-Time Currency Selector & Live Rate Bar */}
          {checkoutStep !== 'confirmed' &&
            checkoutStep !== 'confirming_payment' &&
            checkoutStep !== 'payment_failed' && (
              <div className="bg-[#FAF7F2] p-4 border border-[#111111]/10 rounded-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-[0.24em] text-[#7A6230] font-semibold">
                    Settlement Currency
                  </span>
                  <span className="text-[10px] text-[#5C574E] flex items-center gap-1.5 bg-[#F7F3EC] border border-[#111111]/10 px-2 py-0.5 rounded-xs tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B89B5E]" />
                    <span>1 USD = ₦{exchangeRate.toLocaleString()}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`py-2 px-3 text-[11px] tracking-[0.14em] uppercase font-medium flex items-center justify-center transition-colors cursor-pointer rounded-xs border ${
                      currency === 'USD'
                        ? 'bg-[#B89B5E] text-[#111111] border-[#B89B5E] font-semibold'
                        : 'bg-[#F7F3EC] text-[#5C574E] border-[#111111]/12 hover:text-[#111111]'
                    }`}
                  >
                    US Dollar ($ USD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('NGN')}
                    className={`py-2 px-3 text-[11px] tracking-[0.14em] uppercase font-medium flex items-center justify-center transition-colors cursor-pointer rounded-xs border ${
                      currency === 'NGN'
                        ? 'bg-[#B89B5E] text-[#111111] border-[#B89B5E] font-semibold'
                        : 'bg-[#F7F3EC] text-[#5C574E] border-[#111111]/12 hover:text-[#111111]'
                    }`}
                  >
                    Naira (₦ NGN)
                  </button>
                </div>

                <div className="pt-2 border-t border-[#111111]/10 flex items-center justify-between text-[11px] text-[#5C574E]">
                  <span>
                    Active Total:{' '}
                    <strong className="text-[#111111] font-semibold tabular-nums">
                      {currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}
                    </strong>
                  </span>
                  <span className="text-[#7A6230] tabular-nums">
                    ~{currency === 'NGN' ? formatUSD(totalCents) : formatNGN(totalNgn)}
                  </span>
                </div>
              </div>
            )}

          {checkoutStep === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full border border-[#B89B5E]/40 flex items-center justify-center font-editorial text-2xl text-[#7A6230]">
                    V
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-lg font-medium text-[#111111] font-editorial">Your Shopping Bag is Empty</p>
                    <p className="text-xs text-[#5C574E] max-w-xs mx-auto leading-relaxed">
                      Explore inspected everyday tech, workspace pieces, and smart home essentials.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCartOpen(false);
                      onNavigate('/shop');
                    }}
                    className="gold-gradient-bg px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] rounded-xs cursor-pointer"
                  >
                    Explore Collection
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
                        className="flex items-start gap-4 bg-[#FAF7F2] p-4 border border-[#111111]/10 rounded-xs"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden bg-[#EFEAE0] border border-[#111111]/10 flex items-center justify-center rounded-xs">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="font-editorial text-sm text-[#7A6230]">V</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-editorial font-medium text-[#111111] line-clamp-1">
                              {product.title}
                            </h4>
                            <span className="text-xs font-medium text-[#111111] shrink-0 tabular-nums">
                              {currency === 'NGN' ? formatNGN(itemTotalNgn) : formatUSD(itemTotalCents)}
                            </span>
                          </div>
                          {variantLabel && (
                            <span className="text-[10px] text-[#7A6230] block mt-0.5 truncate">{variantLabel}</span>
                          )}
                          <span className="text-[9px] uppercase tracking-[0.18em] text-[#5C574E] block mt-1">
                            {product.category.replace(/-/g, ' ')}
                          </span>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="inline-flex items-center border border-[#111111]/15 rounded-xs bg-[#F7F3EC]">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() => updateQuantity(product.id, quantity - 1, variantId)}
                                className="px-2.5 py-1.5 text-[#5C574E] hover:text-[#111111] cursor-pointer"
                              >
                                <Minus className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <span className="px-2.5 text-xs text-[#111111] tabular-nums">{quantity}</span>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                onClick={() => updateQuantity(product.id, quantity + 1, variantId)}
                                className="px-2.5 py-1.5 text-[#5C574E] hover:text-[#111111] cursor-pointer"
                              >
                                <Plus className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id, variantId)}
                              className="text-[10px] uppercase tracking-[0.14em] text-[#5C574E] hover:text-[#8E3A3A] cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Promo Code Input */}
                  <div className="bg-[#FAF7F2] p-4 border border-[#111111]/10 space-y-2.5 rounded-xs">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#5C574E] block">
                      Voucher Code
                    </span>
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="e.g. VANTERA10"
                        className="flex-1 bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2 text-xs uppercase text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                      />
                      <button
                        type="submit"
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="bg-[#111111] text-[#F7F3EC] hover:bg-[#B89B5E] hover:text-[#111111] px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors disabled:opacity-40 rounded-xs cursor-pointer"
                      >
                        {isApplyingCoupon ? '...' : 'Apply'}
                      </button>
                    </form>
                    {couponMessage && (
                      <p
                        className={`text-[11px] ${
                          couponMessage.startsWith('✓') ? 'text-[#7A6230] font-medium' : 'text-[#8E3A3A]'
                        }`}
                      >
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
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#FAF7F2] border border-[#B89B5E]/50 text-[#7A6230] font-editorial text-2xl">
                V
              </div>
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-[0.24em] text-[#7A6230] font-semibold block">
                  Client Account Required
                </span>
                <h3 className="font-editorial text-2xl font-medium text-[#111111]">
                  Sign in to complete checkout
                </h3>
                <p className="text-xs text-[#5C574E] max-w-xs mx-auto leading-relaxed">
                  VANTÉRA keeps every order connected to your verified client account. Your shopping bag items remain saved.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    onNavigate('/account?mode=login&returnTo=cart');
                  }}
                  className="w-full gold-gradient-bg py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs cursor-pointer"
                >
                  Sign In to Existing Account
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    onNavigate('/account?mode=register&returnTo=cart');
                  }}
                  className="w-full bg-[#FAF7F2] border border-[#111111]/20 text-[#111111] py-3.5 text-[11px] uppercase tracking-[0.2em] rounded-xs hover:border-[#B89B5E] transition-colors cursor-pointer"
                >
                  Create Client Account
                </button>

                <button
                  type="button"
                  onClick={() => setCheckoutStep('cart')}
                  className="text-xs text-[#5C574E] hover:text-[#111111] underline pt-2 block mx-auto cursor-pointer"
                >
                  ← Back to Shopping Bag
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 'shipping' && (
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              {errorMessage && (
                <div className="border border-[#8E3A3A]/30 bg-[#8E3A3A]/8 p-3 text-xs text-[#8E3A3A] rounded-xs">
                  {errorMessage}
                </div>
              )}

              <div className="bg-[#FAF7F2] p-5 border border-[#111111]/10 space-y-3.5 rounded-xs">
                <h4 className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">
                  Recipient Details
                </h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-name" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                      Full Name *
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      required
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="e.g. Emmanuel Adarikwu"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-email" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                      Email (Receipt & Tracking) *
                    </label>
                    <input
                      id="checkout-email"
                      type="email"
                      required
                      value={formData.customerEmail}
                      onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                      placeholder="e.g. client@example.com"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="checkout-phone" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E]">
                        WhatsApp / Mobile (+234 format) *
                      </label>
                      {formData.customerPhone && (
                        <span className={`text-[10px] ${phoneValidation.valid ? 'text-[#7A6230]' : 'text-[#8E3A3A]'}`}>
                          {phoneValidation.valid ? 'Valid format' : 'Invalid format'}
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
                      className={`w-full bg-[#F7F3EC] border px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:outline-hidden rounded-xs tabular-nums ${
                        formData.customerPhone && !phoneValidation.valid
                          ? 'border-[#8E3A3A]/60 focus:border-[#8E3A3A]'
                          : 'border-[#111111]/15 focus:border-[#B89B5E]'
                      }`}
                    />
                    {formData.customerPhone && !phoneValidation.valid && (
                      <p className="text-[11px] text-[#8E3A3A] mt-1">{phoneValidation.error}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF7F2] p-5 border border-[#111111]/10 space-y-3.5 rounded-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">
                    Delivery Destination
                  </h4>
                  <span className="text-[10px] text-[#5C574E]">
                    {activeStateInfo.deliveryEstimate}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="checkout-state" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
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
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    >
                      {NIGERIAN_STATES.map((s) => (
                        <option key={s.state} value={s.state} className="bg-[#FAF7F2] text-[#111111]">
                          {s.state} — {currency === 'NGN' ? formatNGN(s.feeNgn) : formatUSD(s.feeUsdCents)} ({s.deliveryEstimate})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="checkout-city" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                        LGA / City *
                      </label>
                      <select
                        id="checkout-city"
                        value={formData.city || selectedLga}
                        onChange={(e) => {
                          setSelectedLga(e.target.value);
                          setFormData({ ...formData, city: e.target.value });
                        }}
                        className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                      >
                        {getLgasForState(formData.state || selectedState).map((city) => (
                          <option key={city} value={city} className="bg-[#FAF7F2] text-[#111111]">
                            {city}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="checkout-postal" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                        Postal Code
                      </label>
                      <input
                        id="checkout-postal"
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        placeholder="100001"
                        className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] tabular-nums placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="checkout-street" className="block text-[10px] uppercase tracking-[0.14em] text-[#5C574E] mb-1">
                      Street Address *
                    </label>
                    <input
                      id="checkout-street"
                      type="text"
                      required
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                      placeholder="e.g. Plot 14 Admiralty Way, Lekki Phase 1"
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                  </div>

                  <div className="bg-[#F7F3EC] p-3 border border-[#111111]/10 rounded-xs flex items-center justify-between text-[11px]">
                    <span className="text-[#5C574E]">Estimated Delivery:</span>
                    <span className="text-[#7A6230] font-medium">{activeStateInfo.deliveryEstimate}</span>
                  </div>

                  {cjQuoteData?.hasCjItems && (
                    <div className="bg-[#F7F3EC] p-3 border border-[#111111]/10 rounded-xs space-y-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-[#7A6230] font-semibold">
                          Global Carrier Freight
                        </span>
                        <select
                          aria-label="CJ freight destination country"
                          value={cjQuoteCountry}
                          onChange={(e) => setCjQuoteCountry(e.target.value)}
                          className="bg-[#FAF7F2] border border-[#111111]/15 px-2 py-0.5 text-[10px] text-[#111111] rounded-xs"
                        >
                          <option value="NG">Nigeria (NG)</option>
                          <option value="US">United States (US)</option>
                          <option value="GB">United Kingdom (GB)</option>
                          <option value="CA">Canada (CA)</option>
                          <option value="GH">Ghana (GH)</option>
                        </select>
                      </div>
                      {cjQuoteLoading ? (
                        <p className="text-[10px] text-[#5C574E]">Checking live carrier schedules...</p>
                      ) : cjQuoteData.error ? (
                        <p className="text-[10px] text-[#8E3A3A]">{cjQuoteData.error}</p>
                      ) : cjQuoteData.options.length > 0 ? (
                        <div className="space-y-1">
                          {cjQuoteData.options.slice(0, 3).map((opt) => (
                            <div key={opt.logisticName} className="flex items-center justify-between gap-2 text-[10px]">
                              <span className="text-[#111111] truncate">
                                {opt.logisticName} ({opt.logisticAging})
                              </span>
                              <span className="text-[#7A6230] shrink-0 tabular-nums font-medium">
                                {currency === 'NGN'
                                  ? formatNGN(opt.totalPostageFeeNgn)
                                  : formatUSD(opt.totalPostageFeeCents)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-[#5C574E]">
                          No international carrier methods returned for {cjQuoteCountry}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Selector: Wavy vs Bank Transfer */}
              <div className="bg-[#FAF7F2] p-5 border border-[#111111]/10 space-y-3 rounded-xs">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold block">
                  Payment Method
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card_online')}
                    className={`p-3 text-left border rounded-xs transition-colors cursor-pointer ${
                      paymentMethod === 'card_online'
                        ? 'border-[#B89B5E] bg-[#F7F3EC]'
                        : 'border-[#111111]/12 bg-[#FAF7F2] text-[#5C574E] hover:border-[#111111]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-editorial font-medium text-[#111111]">Card / Wavy</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#FAF7F2] text-[#7A6230] border border-[#B89B5E]/40 rounded-xs uppercase">
                        Live
                      </span>
                    </div>
                    <p className="text-[10px] text-[#5C574E] leading-tight">
                      Mastercard, Visa, Verve & Apple Pay via Wavy.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`p-3 text-left border rounded-xs transition-colors cursor-pointer ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-[#B89B5E] bg-[#F7F3EC]'
                        : 'border-[#111111]/12 bg-[#FAF7F2] text-[#5C574E] hover:border-[#111111]/25'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-editorial font-medium text-[#111111]">Bank Transfer</span>
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#FAF7F2] text-[#5C574E] border border-[#111111]/12 rounded-xs uppercase">
                        GTB / Wire
                      </span>
                    </div>
                    <p className="text-[10px] text-[#5C574E] leading-tight">
                      Direct settlement using order narration.
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
                  <div className="border border-[#B89B5E]/40 bg-[#F7F3EC] p-4 space-y-2 rounded-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-editorial text-sm font-medium text-[#111111]">
                        {currency === 'NGN' ? 'Nigerian Naira Bank Settlement' : 'USD Global Wire Transfer'}
                      </span>
                      <span className="text-[10px] bg-[#FAF7F2] text-[#7A6230] border border-[#B89B5E]/40 px-2 py-0.5 rounded-xs">
                        {currency}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5C574E] leading-relaxed">
                      Settling in <strong className="text-[#111111]">{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}</strong>. Bank transfer orders remain awaiting confirmation until verified by CEO Adnuel.
                    </p>
                  </div>
                )}
              </div>
            </form>
          )}

          {checkoutStep === 'confirming_payment' && confirmedOrder && (
            <div className="py-12 px-4 text-center space-y-6">
              <div className="w-12 h-12 rounded-full border border-[#B89B5E]/50 flex items-center justify-center mx-auto font-editorial text-xl text-[#7A6230]">
                V
              </div>

              <div className="w-36 h-0.5 bg-[#111111]/10 mx-auto overflow-hidden rounded-full">
                <div className="h-full w-1/2 bg-[#B89B5E] vantera-loader-bar" />
              </div>

              <div className="space-y-2.5">
                <span className="text-[10px] uppercase tracking-[0.24em] text-[#7A6230] font-semibold block">
                  Verifying With Payment Gateway
                </span>
                <h3 className="font-editorial text-2xl font-medium text-[#111111]">
                  Confirming your <em className="italic font-normal">payment...</em>
                </h3>
                <p className="text-xs text-[#5C574E] leading-relaxed max-w-xs mx-auto">
                  Waiting for Wavy to confirm payment for{' '}
                  <strong className="text-[#111111] tabular-nums">{confirmedOrder.orderReference}</strong> (
                  {confirmedOrder.currency === 'NGN'
                    ? formatNGN(
                        convertUsdCentsToNgn(confirmedOrder.totalCents, confirmedOrder.exchangeRateUsed || exchangeRate)
                      )
                    : formatUSD(confirmedOrder.totalCents)}
                  ). Updates automatically — no refresh needed.
                </p>
              </div>

              {pendingCheckoutUrl && (
                <a
                  href={pendingCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full gold-gradient-bg py-3 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs"
                >
                  Open Wavy Payment Window ↗
                </a>
              )}

              <button
                type="button"
                onClick={handleCancelOnlinePayment}
                className="w-full border border-[#111111]/15 text-[#5C574E] hover:text-[#8E3A3A] hover:border-[#8E3A3A]/40 py-2.5 text-[11px] uppercase tracking-[0.16em] rounded-xs cursor-pointer transition-colors"
              >
                Cancel Payment & Keep Bag Intact
              </button>
            </div>
          )}

          {checkoutStep === 'payment_failed' && (
            <div className="border border-[#8E3A3A]/30 bg-[#FAF7F2] p-6 text-center space-y-4 rounded-xs my-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#8E3A3A]/10 border border-[#8E3A3A]/30 text-[#8E3A3A] mx-auto">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-[0.22em] text-[#8E3A3A] font-semibold block">
                  Transaction Not Completed
                </span>
                <h3 className="font-editorial text-2xl font-medium text-[#111111]">Payment Failed</h3>
                <p className="text-xs text-[#5C574E] leading-relaxed">
                  {failureReason ||
                    'Your card authorization could not be completed. No charge was captured and your bag items remain intact.'}
                </p>
              </div>
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setCheckoutStep('shipping');
                  }}
                  className="w-full gold-gradient-bg py-3 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs cursor-pointer"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutStep('cart')}
                  className="w-full border border-[#111111]/15 text-[#111111] py-2.5 text-[11px] uppercase tracking-[0.18em] rounded-xs hover:border-[#B89B5E] cursor-pointer"
                >
                  Return to Shopping Bag
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 'confirmed' && confirmedOrder && (
            <div className="space-y-5">
              {/* Prominent Payment Status Banner with Animated Checkmark */}
              <div className="p-6 text-center rounded-xs border border-[#B89B5E]/40 bg-[#FAF7F2] space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-[#B89B5E]/50 bg-[#F7F3EC] text-[#7A6230] mx-auto">
                  {confirmedOrder.paymentStatus === 'paid' ? (
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path className="vantera-checkmark-path" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="font-editorial text-xl">V</span>
                  )}
                </div>

                <div>
                  <span className="inline-block px-3 py-1 text-[9px] font-semibold tracking-[0.2em] uppercase rounded-xs bg-[#F7F3EC] text-[#7A6230] border border-[#B89B5E]/40">
                    {confirmedOrder.paymentStatus === 'paid' ? 'Paid & Verified' : 'Awaiting Bank Transfer'}
                  </span>
                </div>

                <h3 className="font-editorial text-2xl font-medium text-[#111111]">
                  {confirmedOrder.paymentStatus === 'paid' ? 'Payment Successful' : 'Order Placed'}
                </h3>

                <p className="text-xs text-[#5C574E]">
                  Order Number:{' '}
                  <strong className="text-[#111111] tabular-nums">{confirmedOrder.orderReference}</strong>
                </p>

                {confirmedOrder.paymentReference && (
                  <p className="text-[11px] text-[#5C574E] tabular-nums">
                    Gateway Reference: {confirmedOrder.paymentReference}
                  </p>
                )}

                <div className="bg-[#F7F3EC] p-3 border border-[#111111]/10 inline-block rounded-xs">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-[#5C574E] block">
                    {confirmedOrder.paymentStatus === 'paid'
                      ? `Amount Paid (${confirmedOrder.currency})`
                      : `Amount Due (${confirmedOrder.currency})`}
                  </span>
                  <strong className="text-xl font-editorial font-medium text-[#111111] tabular-nums">
                    {confirmedOrder.currency === 'NGN'
                      ? formatNGN(
                          convertUsdCentsToNgn(
                            confirmedOrder.totalCents,
                            confirmedOrder.exchangeRateUsed || exchangeRate
                          )
                        )
                      : formatUSD(confirmedOrder.totalCents)}
                  </strong>
                </div>
              </div>

              {/* Order Items & Delivery Summary Receipt */}
              <div className="border border-[#111111]/10 bg-[#FAF7F2] p-4 rounded-xs space-y-3 text-xs">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#7A6230] block font-semibold">
                  Order Receipt & Delivery
                </span>
                <div className="divide-y divide-[#111111]/10">
                  {(confirmedOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[#111111] block truncate font-medium">{item.title}</span>
                        <span className="text-[10px] text-[#5C574E] tabular-nums">Qty: {item.quantity}</span>
                      </div>
                      <span className="text-[#111111] tabular-nums shrink-0 font-medium">
                        {confirmedOrder.currency === 'NGN'
                          ? formatNGN(
                              convertUsdCentsToNgn(
                                item.totalCents || 0,
                                confirmedOrder.exchangeRateUsed || exchangeRate
                              )
                            )
                          : formatUSD(item.totalCents || 0)}
                      </span>
                    </div>
                  ))}
                </div>
                {confirmedOrder.shippingAddress && (
                  <div className="pt-2 border-t border-[#111111]/10 text-[11px] text-[#5C574E] space-y-0.5">
                    <div className="text-[#111111] font-medium">{confirmedOrder.shippingAddress.fullName}</div>
                    <div>
                      {confirmedOrder.shippingAddress.streetAddress}, {confirmedOrder.shippingAddress.city},{' '}
                      {confirmedOrder.shippingAddress.state}
                    </div>
                    <div className="tabular-nums">{confirmedOrder.shippingAddress.phone}</div>
                    {confirmedOrder.estimatedTransitTime && (
                      <div className="text-[#7A6230]">Estimated Delivery: {confirmedOrder.estimatedTransitTime}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Bank Account Coordinates & Proof (only shown for unpaid Bank Transfer orders) */}
              {confirmedOrder.paymentStatus !== 'paid' && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="uppercase tracking-[0.18em] text-[10px] text-[#5C574E] font-semibold">
                        Bank Transfer Coordinates
                      </h4>
                      <div className="flex border border-[#111111]/15 text-[10px] rounded-xs overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setViewBankCurrency('NGN')}
                          className={`px-3 py-1 transition-colors cursor-pointer ${
                            viewBankCurrency === 'NGN'
                              ? 'bg-[#B89B5E] text-[#111111] font-semibold'
                              : 'bg-[#F7F3EC] text-[#5C574E] hover:text-[#111111]'
                          }`}
                        >
                          ₦ NGN Bank
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewBankCurrency('USD')}
                          className={`px-3 py-1 transition-colors cursor-pointer ${
                            viewBankCurrency === 'USD'
                              ? 'bg-[#B89B5E] text-[#111111] font-semibold'
                              : 'bg-[#F7F3EC] text-[#5C574E] hover:text-[#111111]'
                          }`}
                        >
                          $ USD Wire
                        </button>
                      </div>
                    </div>

                    {viewBankCurrency === 'NGN' ? (
                      <div className="border border-[#111111]/10 bg-[#FAF7F2] p-4 space-y-3 text-xs rounded-xs">
                        <div className="flex items-center justify-between border-b border-[#111111]/10 pb-2">
                          <span className="font-editorial text-sm font-medium text-[#111111]">
                            Nigerian Naira (₦) GTBank Account
                          </span>
                          <span className="text-[9px] bg-[#F7F3EC] text-[#7A6230] border border-[#B89B5E]/40 px-2 py-0.5 uppercase">
                            Instant Clearing
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-[#5C574E] block">Bank Entity</span>
                            <strong className="text-[#111111] font-medium">
                              {activeNgn?.bankName || bankSettings.bankName}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C574E] block">Account Number</span>
                            <div className="flex items-center gap-2">
                              <strong className="text-sm tabular-nums text-[#7A6230]">
                                {activeNgn?.accountNumber || bankSettings.accountNumber}
                              </strong>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(activeNgn?.accountNumber || bankSettings.accountNumber);
                                  setCopiedKey('ngn');
                                  setTimeout(() => setCopiedKey(null), 2000);
                                }}
                                aria-label="Copy account number"
                                className="text-[10px] text-[#7A6230] hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === 'ngn' ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-[#5C574E] block">Beneficiary Name</span>
                            <strong className="text-[#111111] font-medium">
                              {activeNgn?.accountName || bankSettings.accountName}
                            </strong>
                          </div>
                          <div className="col-span-2 bg-[#F7F3EC] p-2.5 border border-[#111111]/10 rounded-xs">
                            <span className="text-[9px] uppercase tracking-wider text-[#5C574E] block">
                              Mandatory Transfer Narration
                            </span>
                            <strong className="text-xs text-[#111111] tabular-nums">
                              {confirmedOrder.orderReference}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-[#111111]/10 bg-[#FAF7F2] p-4 space-y-3 text-xs rounded-xs">
                        <div className="flex items-center justify-between border-b border-[#111111]/10 pb-2">
                          <span className="font-editorial text-sm font-medium text-[#111111]">
                            USD Global Settlement Wire
                          </span>
                          <span className="text-[9px] bg-[#F7F3EC] text-[#7A6230] border border-[#B89B5E]/40 px-2 py-0.5 uppercase">
                            Wire
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-[#5C574E] block">Institution</span>
                            <strong className="text-[#111111] font-medium">
                              {activeUsd?.bankName || 'VANTÉRA Global Settlement'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C574E] block">Account Number</span>
                            <div className="flex items-center gap-2">
                              <strong className="text-sm tabular-nums text-[#7A6230]">
                                {activeUsd?.accountNumber || '984102938471'}
                              </strong>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(activeUsd?.accountNumber || '984102938471');
                                  setCopiedKey('usd');
                                  setTimeout(() => setCopiedKey(null), 2000);
                                }}
                                aria-label="Copy USD account number"
                                className="text-[10px] text-[#7A6230] hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedKey === 'usd' ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C574E] block">Routing Number</span>
                            <strong className="text-[#111111] tabular-nums">
                              {activeUsd?.sortCodeOrRouting || '021000021'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#5C574E] block">SWIFT / BIC</span>
                            <strong className="text-[#111111] tabular-nums">{activeUsd?.swiftBic || 'MERCUS33XXX'}</strong>
                          </div>
                          <div className="col-span-2">
                            <span className="text-[10px] text-[#5C574E] block">Beneficiary</span>
                            <strong className="text-[#111111] font-medium">
                              {activeUsd?.accountName || 'VANTÉRA ENTERPRISES - Adnuel'}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Proof Submission */}
                  <div className="border border-[#111111]/10 bg-[#FAF7F2] p-4 space-y-3 rounded-xs">
                    <h4 className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">
                      Notify CEO Adnuel of Settlement
                    </h4>
                    <p className="text-[11px] text-[#5C574E]">
                      Already transferred? Enter your transaction reference or sender name:
                    </p>
                    <input
                      type="text"
                      placeholder="e.g. Sent via GTWorld app, Narration Ref #984210"
                      value={formData.paymentReference}
                      onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                      className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-3 py-2.5 text-xs text-[#111111] placeholder-[#5C574E]/50 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                    />
                    {paymentNoteSent ? (
                      <div className="p-3 bg-[#F7F3EC] text-[#7A6230] border border-[#B89B5E] text-xs text-center rounded-xs">
                        Notification submitted. CEO Adnuel is confirming your transfer.
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isSubmitting || !formData.paymentReference}
                        onClick={handlePaymentProofSubmit}
                        className="w-full gold-gradient-bg py-3 text-[10px] font-semibold uppercase tracking-[0.2em] rounded-xs disabled:opacity-40 cursor-pointer"
                      >
                        {isSubmitting ? 'Sending...' : 'Confirm Transfer Sent'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Direct WhatsApp link to CEO */}
              <div className="text-center pt-1">
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello CEO Adnuel, regarding VANTÉRA order ${confirmedOrder.orderReference} (${
                      confirmedOrder.currency === 'NGN'
                        ? formatNGN(
                            convertUsdCentsToNgn(
                              confirmedOrder.totalCents,
                              confirmedOrder.exchangeRateUsed || exchangeRate
                            )
                          )
                        : formatUSD(confirmedOrder.totalCents)
                    }).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-[#7A6230] hover:underline"
                >
                  <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Direct WhatsApp with CEO Adnuel (+234 913 279 3670)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary & Action */}
        <div className="border-t border-[#111111]/10 bg-[#FAF7F2] px-6 py-5">
          {checkoutStep === 'cart' && items.length > 0 && (
            <div>
              <div className="space-y-2 text-xs mb-5">
                <div className="flex justify-between text-[#5C574E]">
                  <span>Subtotal</span>
                  <span className="font-medium text-[#111111] tabular-nums">
                    {currency === 'NGN' ? formatNGN(subtotalNgn) : formatUSD(subtotalCents)}
                  </span>
                </div>

                {discountCents > 0 && (
                  <div className="flex justify-between text-[#7A6230]">
                    <span>Discount ({appliedCoupon?.code})</span>
                    <span className="tabular-nums">
                      -{currency === 'NGN' ? formatNGN(discountNgn) : formatUSD(discountCents)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-[#5C574E]">
                  <span>Delivery</span>
                  <span className="text-[#111111] tabular-nums">
                    {shippingFeeCents === 0
                      ? 'Complimentary'
                      : currency === 'NGN'
                      ? formatNGN(shippingFeeNgn)
                      : formatUSD(shippingFeeCents)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline text-sm pt-3 border-t border-[#111111]/10">
                  <span className="font-editorial text-[#111111]">Total ({currency})</span>
                  <span className="text-lg font-editorial font-medium text-[#111111] tabular-nums">
                    {currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}
                  </span>
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
                className="w-full gold-gradient-bg py-3.5 text-[11px] font-semibold uppercase tracking-[0.22em] rounded-xs cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Proceed to Checkout</span>
              </button>
            </div>
          )}

          {checkoutStep === 'shipping' && (
            <div className="space-y-3">
              <div className="bg-[#F7F3EC] p-3 border border-[#111111]/10 text-xs space-y-1 rounded-xs">
                <div className="flex justify-between text-[#5C574E]">
                  <span>Settlement Currency</span>
                  <strong className="text-[#7A6230]">
                    {currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}
                  </strong>
                </div>
                <div className="flex justify-between text-[#111111] font-editorial pt-1 border-t border-[#111111]/10">
                  <span>Total Amount</span>
                  <span className="font-semibold tabular-nums">
                    {currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}
                  </span>
                </div>
              </div>

              {paymentMethod === 'bank_transfer' && (
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className="w-full gold-gradient-bg py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs disabled:opacity-40 cursor-pointer"
                >
                  {isSubmitting
                    ? 'Placing Order...'
                    : `Place Bank Transfer Order · ${currency === 'NGN' ? formatNGN(totalNgn) : formatUSD(totalCents)}`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCheckoutStep('cart')}
                className="w-full text-center text-xs text-[#5C574E] hover:text-[#111111] transition-colors cursor-pointer"
              >
                ← Return to Shopping Bag
              </button>
            </div>
          )}

          {checkoutStep === 'confirmed' && (
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onNavigate('/account');
                }}
                className="w-full gold-gradient-bg py-3 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs cursor-pointer"
              >
                View in Client Account
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full text-center text-xs text-[#5C574E] hover:text-[#111111] transition-colors cursor-pointer"
              >
                Continue Exploring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
