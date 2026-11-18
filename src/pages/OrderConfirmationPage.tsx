import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Check, Copy, MessageCircle, X } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';

interface OrderConfirmationPageProps {
  onNavigate: (url: string) => void;
}

export const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({ onNavigate }) => {
  const { currency, exchangeRate } = useCurrency();
  const { setIsCartOpen, clearCart } = useCart();
  const { token } = useAuth();

  const [orderReference, setOrderReference] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<any | null>(null);
  const [bankDetails, setBankDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pollCount, setPollCount] = useState<number>(0);
  const [isExplicitlyFailed, setIsExplicitlyFailed] = useState<boolean>(false);
  const [failureReason, setFailureReason] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const hasClearedCartRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref =
        params.get('orderReference') ||
        params.get('reference') ||
        params.get('tx_ref') ||
        params.get('ref') ||
        '';
      if (ref) {
        setOrderReference(ref);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }

    safeFetchJson<any>('/api/bank-details').then((res) => {
      if (res.ok && res.data) {
        setBankDetails(res.data);
      }
    });
  }, []);

  const fetchOrderStatus = async (ref: string) => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await safeFetchJson<any>(`/api/orders/status/${encodeURIComponent(ref)}`, { headers });
      if (res.ok && res.data) {
        const orderObj = res.data.order || res.data;
        setOrderStatus(orderObj);
        return orderObj;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!orderReference) return;

    let isMounted = true;
    let pollTimer: any = null;
    let attempts = 0;

    const performVerification = async () => {
      attempts += 1;
      if (isMounted) setPollCount(attempts);

      try {
        const verifyRes = await safeFetchJson<any>('/api/payments/wavy/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: orderReference,
            orderReference,
          }),
        });

        if (isMounted && verifyRes.data?.failed) {
          setIsExplicitlyFailed(true);
          setFailureReason(verifyRes.data.error || 'Transaction was declined or cancelled at the gateway.');
        }
      } catch {}

      const data = await fetchOrderStatus(orderReference);
      if (!isMounted) return;

      if (data && data.paymentStatus === 'paid') {
        if (!hasClearedCartRef.current) {
          hasClearedCartRef.current = true;
          clearCart();
        }
        setIsExplicitlyFailed(false);
        setLoading(false);
        return;
      }

      if (data && data.paymentStatus === 'failed') {
        setIsExplicitlyFailed(true);
        setFailureReason(data.paymentProofNotes || 'Payment was declined or cancelled at the gateway.');
        setLoading(false);
        return;
      }

      if (data && data.paymentMethod === 'bank_transfer') {
        setLoading(false);
        return;
      }

      // Keep polling patiently every 2.5 seconds for webhook / gateway settlement (up to 48 attempts = 2 minutes)
      if (attempts < 48) {
        pollTimer = setTimeout(performVerification, 2500);
      }
    };

    performVerification();

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [orderReference, token]);

  const handleManualRecheck = async () => {
    if (!orderReference) return;
    try {
      const verifyRes = await safeFetchJson<any>('/api/payments/wavy/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: orderReference, orderReference }),
      });
      if (verifyRes.data?.failed) {
        setIsExplicitlyFailed(true);
        setFailureReason(verifyRes.data.error || 'Transaction was declined or cancelled.');
      }
    } catch {}

    const data = await fetchOrderStatus(orderReference);
    if (data?.paymentStatus === 'paid') {
      if (!hasClearedCartRef.current) {
        hasClearedCartRef.current = true;
        clearCart();
      }
      setIsExplicitlyFailed(false);
      setLoading(false);
    } else if (data?.paymentStatus === 'failed') {
      setIsExplicitlyFailed(true);
      setLoading(false);
    }
  };

  const handleCopyReference = () => {
    const ref = orderStatus?.orderReference || orderReference;
    if (!ref) return;
    navigator.clipboard.writeText(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTryAgain = async () => {
    const targetRef = orderStatus?.orderReference || orderReference;
    if (targetRef && orderStatus?.paymentStatus !== 'paid' && orderStatus?.paymentStatus !== 'failed') {
      setIsCancelling(true);
      try {
        await safeFetchJson('/api/payments/wavy/fail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderReference: targetRef,
            reason: 'Cancelled by customer to retry checkout',
          }),
        });
      } catch {}
      setIsCancelling(false);
    }
    setIsCartOpen(true);
    onNavigate('/');
  };

  const isPaid = orderStatus?.paymentStatus === 'paid';
  const isAwaitingTransfer =
    orderStatus?.paymentMethod === 'bank_transfer' &&
    (orderStatus?.paymentStatus === 'pending' || orderStatus?.paymentStatus === 'awaiting_verification');
  const isFailed = isExplicitlyFailed || orderStatus?.paymentStatus === 'failed';
  const isConfirming = !isPaid && !isAwaitingTransfer && !isFailed && Boolean(orderReference);

  const displayMoney = (cents: number, order?: any) => {
    const targetCurr = order?.currency || currency;
    const rateToUse = order?.exchangeRateUsed || exchangeRate || 1500;
    if (targetCurr === 'NGN') {
      return formatNGN(convertUsdCentsToNgn(cents, rateToUse));
    }
    return formatUSD(cents);
  };

  const activeBank =
    bankDetails?.activeNgn ||
    bankDetails?.bankSettings || {
      bankName: 'Guaranty Trust Bank (GTBank)',
      accountNumber: '1033269410',
      accountName: 'ADARIKWU EMMANUEL UGBADA',
    };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-24 space-y-8 font-meta text-[#111111]">
      {/* 1. Patient Confirming Loader State */}
      {(loading || isConfirming) && !isPaid && !isFailed && !isAwaitingTransfer && (
        <div className="border border-[#111111]/12 bg-[#FAF7F2] p-8 sm:p-14 text-center space-y-6 rounded-xs">
          <div className="w-12 h-12 rounded-full border border-[#B89B5E]/50 flex items-center justify-center mx-auto text-[#7A6230] font-editorial text-xl">
            V
          </div>

          <div className="w-40 h-0.5 bg-[#111111]/10 mx-auto overflow-hidden rounded-full">
            <div className="h-full w-1/2 bg-[#B89B5E] vantera-loader-bar" />
          </div>

          <div className="space-y-3">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#7A6230] font-semibold block">
              Verifying Payment
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl font-medium text-[#111111]">
              Confirming your <em className="italic font-normal">payment...</em>
            </h1>
            <p className="text-xs sm:text-sm text-[#5C574E] max-w-md mx-auto leading-relaxed">
              We are awaiting final confirmation from our payment gateway for order{' '}
              <strong className="text-[#111111] font-semibold tabular-nums">{orderReference}</strong>. This screen updates automatically the moment your settlement completes.
            </p>
          </div>

          {pollCount >= 4 && (
            <div className="pt-2 space-y-3 max-w-xs mx-auto">
              <p className="text-[11px] text-[#5C574E]">
                Bank settlement can sometimes take a moment. Your bag items stay saved until confirmation completes.
              </p>
              <button
                type="button"
                onClick={handleManualRecheck}
                className="w-full gold-gradient-bg py-3 text-[10px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
              >
                Check Confirmation Status Now
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleTryAgain}
                className="w-full border border-[#111111]/15 text-[#5C574E] hover:text-[#111111] hover:border-[#111111]/35 py-2.5 text-[10px] uppercase tracking-[0.18em] rounded-xs transition-colors cursor-pointer"
              >
                {isCancelling ? 'Releasing Reservation...' : 'Cancel & Return to Bag'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* No reference fallback */}
      {!loading && !orderReference && (
        <div className="border border-[#111111]/12 bg-[#FAF7F2] p-10 text-center space-y-5 rounded-xs">
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#111111]">No Order Reference Found</h1>
          <p className="text-xs sm:text-sm text-[#5C574E] max-w-md mx-auto leading-relaxed">
            Visit your client account or enter your order reference on the tracking page to view your receipt.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/account')}
              className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
            >
              Open Client Account
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/track')}
              className="border border-[#111111]/20 text-[#111111] px-6 py-3 text-[11px] uppercase tracking-[0.2em] rounded-xs cursor-pointer hover:border-[#B89B5E]"
            >
              Track Order
            </button>
          </div>
        </div>
      )}

      {/* 2. Verified Payment Successful State */}
      {isPaid && orderStatus && (
        <div className="space-y-6">
          <div className="border border-[#111111]/12 bg-[#FAF7F2] p-8 sm:p-12 text-center space-y-5 rounded-xs">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-[#B89B5E]/50 bg-[#F7F3EC] text-[#7A6230] mx-auto">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path className="vantera-checkmark-path" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-2.5">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#7A6230] font-semibold block">
                Payment Successful
              </span>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium text-[#111111]">
                Thank you. Order <em className="italic font-normal">confirmed.</em>
              </h1>
              <p className="text-xs sm:text-sm text-[#5C574E] max-w-md mx-auto leading-relaxed">
                Your payment has been verified server-side. Your receipt has been emailed and your order is now preparing for dispatch.
              </p>
            </div>

            {/* Order Reference Box */}
            <div className="bg-[#F7F3EC] border border-[#111111]/12 p-4 rounded-xs max-w-md mx-auto flex items-center justify-between gap-3">
              <div className="text-left min-w-0">
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#5C574E] block">Order Number</span>
                <span className="text-sm font-semibold text-[#111111] tabular-nums truncate block">
                  {orderStatus.orderReference}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReference}
                className="border border-[#111111]/15 bg-[#FAF7F2] text-[#111111] px-3.5 py-2 text-[10px] uppercase tracking-[0.18em] hover:border-[#B89B5E] hover:text-[#7A6230] transition-colors rounded-xs cursor-pointer shrink-0 inline-flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3 h-3" strokeWidth={2} /> : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Purchased Items & Financial Summary */}
          <div className="border border-[#111111]/12 bg-[#FAF7F2] p-6 sm:p-8 rounded-xs space-y-5">
            <h2 className="font-editorial text-xl font-medium text-[#111111] border-b border-[#111111]/10 pb-3">
              Order Receipt & Items ({orderStatus.currency || currency})
            </h2>

            {orderStatus.items && orderStatus.items.length > 0 && (
              <div className="divide-y divide-[#111111]/10">
                {orderStatus.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-12 h-12 object-cover bg-[#EFEAE0] border border-[#111111]/10 rounded-xs shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-[#EFEAE0] flex items-center justify-center font-editorial text-[#7A6230] text-sm border border-[#111111]/10 rounded-xs shrink-0">
                          V
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-sm font-editorial text-[#111111] block truncate">{item.title}</span>
                        <span className="text-[11px] text-[#5C574E] tabular-nums">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-medium text-[#111111] tabular-nums">
                        {displayMoney(item.totalCents || item.unitPriceCents * item.quantity, orderStatus)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-[#111111]/10 space-y-2 text-xs">
              <div className="flex justify-between text-[#5C574E]">
                <span>Subtotal</span>
                <span className="tabular-nums text-[#111111]">
                  {displayMoney(orderStatus.subtotalCents || orderStatus.totalCents, orderStatus)}
                </span>
              </div>
              {orderStatus.discountCents > 0 && (
                <div className="flex justify-between text-[#7A6230]">
                  <span>Discount {orderStatus.couponCode ? `(${orderStatus.couponCode})` : ''}</span>
                  <span className="tabular-nums">-{displayMoney(orderStatus.discountCents, orderStatus)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#5C574E]">
                <span>Delivery Fee ({orderStatus.estimatedTransitTime || '1–4 business days'})</span>
                <span className="tabular-nums text-[#111111]">
                  {orderStatus.shippingFeeCents > 0 ? displayMoney(orderStatus.shippingFeeCents, orderStatus) : 'Complimentary'}
                </span>
              </div>
              <div className="pt-3 border-t border-[#111111]/10 flex items-center justify-between">
                <span className="text-[#111111] font-medium">Amount Paid ({orderStatus.currency || currency})</span>
                <span className="text-xl font-editorial font-medium text-[#111111] tabular-nums">
                  {displayMoney(orderStatus.totalCents, orderStatus)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Details Card */}
          <div className="border border-[#111111]/12 bg-[#FAF7F2] p-6 sm:p-8 rounded-xs space-y-3">
            <h3 className="font-editorial text-lg font-medium text-[#111111]">
              Delivery Details
            </h3>
            <div className="text-xs text-[#5C574E] space-y-1 leading-relaxed">
              {orderStatus.shippingAddress?.fullName && (
                <p className="text-[#111111] font-medium">{orderStatus.shippingAddress.fullName}</p>
              )}
              {orderStatus.shippingAddress?.streetAddress && (
                <p>{orderStatus.shippingAddress.streetAddress}</p>
              )}
              <p>
                {[
                  orderStatus.shippingAddress?.city,
                  orderStatus.shippingAddress?.state,
                  orderStatus.shippingAddress?.country,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {orderStatus.shippingAddress?.phone && (
                <p className="tabular-nums text-[#5C574E]">{orderStatus.shippingAddress.phone}</p>
              )}
              <p className="pt-2 text-[#7A6230] text-[11px] uppercase tracking-[0.14em]">
                Estimated Delivery: {orderStatus.estimatedTransitTime || '1–4 business days'} · Fulfilment:{' '}
                <span>{orderStatus.fulfilmentStatus}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate(`/track/${encodeURIComponent(orderStatus.orderReference)}`)}
              className="w-full sm:w-1/2 gold-gradient-bg py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span>Track Order Dispatch</span>
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/account')}
              className="w-full sm:w-1/2 border border-[#111111]/20 bg-[#FAF7F2] text-[#111111] py-3.5 text-[11px] uppercase tracking-[0.2em] rounded-xs hover:border-[#B89B5E] transition-colors cursor-pointer"
            >
              View Order in Account
            </button>
          </div>
        </div>
      )}

      {/* 3. Awaiting Bank Transfer State */}
      {!loading && isAwaitingTransfer && orderStatus && (
        <div className="space-y-6">
          <div className="border border-[#B89B5E]/40 bg-[#FAF7F2] p-8 sm:p-10 text-center space-y-5 rounded-xs">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F7F3EC] border border-[#B89B5E]/50 text-[#7A6230] text-2xl font-editorial">
              V
            </div>
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.24em] text-[#7A6230] font-semibold block">
                Order Registered · Awaiting Payment
              </span>
              <h1 className="font-editorial text-3xl font-medium text-[#111111]">
                Complete Bank Transfer
              </h1>
              <p className="text-xs sm:text-sm text-[#5C574E] max-w-md mx-auto leading-relaxed">
                Transfer <strong className="text-[#111111] tabular-nums">{displayMoney(orderStatus.totalCents, orderStatus)}</strong> using your order reference as transfer narration. Orders remain pending until confirmed.
              </p>
            </div>

            <div className="bg-[#F7F3EC] border border-[#111111]/12 p-5 rounded-xs max-w-md mx-auto text-left space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-[#5C574E]">Order Reference:</span>
                <span className="font-semibold text-[#111111] tabular-nums">{orderStatus.orderReference}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5C574E]">Bank Name:</span>
                <span className="text-[#111111] font-medium text-right">{activeBank.bankName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5C574E]">Account Number:</span>
                <span className="text-[#7A6230] font-semibold tabular-nums">{activeBank.accountNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5C574E]">Account Name:</span>
                <span className="text-[#111111] font-medium text-right">{activeBank.accountName}</span>
              </div>
              <div className="flex justify-between gap-3 pt-2.5 border-t border-[#111111]/10">
                <span className="text-[#5C574E]">Amount Due:</span>
                <span className="font-editorial text-base font-medium text-[#111111] tabular-nums">
                  {displayMoney(orderStatus.totalCents, orderStatus)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`https://wa.me/2347015285932?text=${encodeURIComponent(
                  `Hello CEO Adnuel, I have initiated bank transfer for VANTÉRA order ${orderStatus.orderReference}. Amount: ${displayMoney(orderStatus.totalCents, orderStatus)}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Notify CEO Adnuel on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => onNavigate(`/track/${encodeURIComponent(orderStatus.orderReference)}`)}
                className="border border-[#111111]/20 bg-[#F7F3EC] text-[#111111] px-6 py-3 text-[11px] uppercase tracking-[0.18em] rounded-xs hover:border-[#B89B5E] cursor-pointer"
              >
                Track Order →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Verified Payment Failed State */}
      {isFailed && (
        <div className="border border-[#8E3A3A]/30 bg-[#FAF7F2] p-8 sm:p-10 text-center space-y-5 rounded-xs">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#8E3A3A]/10 border border-[#8E3A3A]/30 text-[#8E3A3A] mx-auto">
            <X className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#8E3A3A] font-semibold block">
              Payment Failed
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#111111]">
              Transaction Not Completed
            </h1>
            <p className="text-xs sm:text-sm text-[#5C574E] max-w-md mx-auto leading-relaxed">
              {failureReason ||
                'Your payment could not be completed or was cancelled before authorization. Your bag items have been kept intact.'}
            </p>
          </div>

          <div className="space-y-3 pt-2 max-w-sm mx-auto">
            <button
              type="button"
              onClick={handleTryAgain}
              className="w-full gold-gradient-bg py-3.5 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs cursor-pointer"
            >
              Try Again (Cart Intact)
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              className="w-full border border-[#111111]/20 bg-[#F7F3EC] text-[#111111] py-3 text-[11px] uppercase tracking-[0.18em] rounded-xs hover:border-[#B89B5E] transition-colors cursor-pointer"
            >
              Contact Support Concierge
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
