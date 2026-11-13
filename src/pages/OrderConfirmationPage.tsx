import React, { useState, useEffect, useRef } from 'react';
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
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-14 sm:py-20 space-y-8 font-meta">
      {/* 1. Patient Confirming Loader State — never falsely shows success or premature error */}
      {(loading || isConfirming) && !isPaid && !isFailed && !isAwaitingTransfer && (
        <div className="border border-white/10 bg-[#141416] p-8 sm:p-12 text-center space-y-6 rounded-xs">
          <div className="w-12 h-12 rounded-full border border-[#C8A96A]/40 flex items-center justify-center mx-auto text-[#C8A96A] font-editorial text-xl">
            V
          </div>

          <div className="w-40 h-0.5 bg-white/10 mx-auto overflow-hidden rounded-full">
            <div className="h-full w-1/2 bg-[#C8A96A] vantera-loader-bar" />
          </div>

          <div className="space-y-2.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-[#C8A96A] block">
              Verifying With Payment Gateway
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#F5F1E8]">
              Confirming your payment...
            </h1>
            <p className="text-xs sm:text-sm text-[#A8A297] max-w-md mx-auto leading-relaxed">
              We are awaiting final confirmation from our payment processor for order{' '}
              <strong className="font-mono text-[#C8A96A]">{orderReference}</strong>. This updates automatically the moment your bank settles.
            </p>
          </div>

          {pollCount >= 4 && (
            <div className="pt-2 space-y-3 max-w-xs mx-auto">
              <p className="text-[11px] text-[#A8A297]">
                Bank settlement can sometimes take a moment. Your cart items remain safe until confirmation completes.
              </p>
              <button
                type="button"
                onClick={handleManualRecheck}
                className="w-full bg-[#0B0B0C] border border-[#C8A96A]/40 text-[#C8A96A] py-2.5 text-[10px] uppercase tracking-[0.18em] rounded-xs hover:bg-[#C8A96A] hover:text-[#0B0B0C] transition-colors cursor-pointer"
              >
                Check Confirmation Status Now
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleTryAgain}
                className="w-full bg-[#0B0B0C] border border-white/10 text-[#A8A297] py-2 text-[10px] uppercase tracking-[0.18em] rounded-xs hover:text-[#F5F1E8] transition-colors cursor-pointer"
              >
                {isCancelling ? 'Releasing Reservation...' : 'Cancel & Return to Bag'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* No reference fallback */}
      {!loading && !orderReference && (
        <div className="border border-white/10 bg-[#141416] p-10 text-center space-y-5 rounded-xs">
          <h1 className="font-editorial text-2xl font-medium text-[#F5F1E8]">No Order Reference Found</h1>
          <p className="text-xs sm:text-sm text-[#A8A297]">
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
              className="border border-white/15 text-[#F5F1E8] px-6 py-3 text-[11px] uppercase tracking-[0.2em] rounded-xs cursor-pointer hover:border-[#C8A96A]"
            >
              Track Order
            </button>
          </div>
        </div>
      )}

      {/* 2. Verified Payment Successful State */}
      {isPaid && orderStatus && (
        <div className="space-y-6">
          <div className="border border-white/10 bg-[#141416] p-8 sm:p-10 text-center space-y-5 rounded-xs">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#0F2E22] border border-[#2E9B6B]/40 text-[#2E9B6B] text-xl">
              ✓
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#C8A96A] block">
                Payment Successful
              </span>
              <h1 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F5F1E8]">
                Thank You. Order Confirmed.
              </h1>
              <p className="text-xs sm:text-sm text-[#A8A297] max-w-md mx-auto leading-relaxed">
                Your payment has been verified server-side. Your receipt has been emailed and your order is now processing for dispatch.
              </p>
            </div>

            {/* Order Reference Box */}
            <div className="bg-[#0B0B0C] border border-white/10 p-4 rounded-xs max-w-md mx-auto flex items-center justify-between gap-3">
              <div className="text-left min-w-0">
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#A8A297] block">Order Number</span>
                <span className="font-mono text-sm font-semibold text-[#C8A96A] truncate block">
                  {orderStatus.orderReference}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReference}
                className="bg-[#141416] border border-white/10 text-[#F5F1E8] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] hover:border-[#C8A96A] hover:text-[#C8A96A] transition-colors rounded-xs cursor-pointer shrink-0"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Purchased Items & Financial Summary */}
          <div className="border border-white/10 bg-[#141416] p-6 sm:p-8 rounded-xs space-y-4">
            <h2 className="font-editorial text-lg font-medium text-[#F5F1E8] border-b border-white/8 pb-3">
              Order Receipt & Items ({orderStatus.currency || currency})
            </h2>

            {orderStatus.items && orderStatus.items.length > 0 && (
              <div className="space-y-3">
                {orderStatus.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-12 h-12 object-contain bg-[#0a0a0a] p-1 border border-white/5 rounded-xs shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-[#0a0a0a] flex items-center justify-center font-editorial text-[#D4AF37] text-sm border border-white/5 shrink-0">
                          V
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-editorial text-[#EDEDED] block truncate">{item.title}</span>
                        <span className="text-[10px] font-meta text-[#73736E]">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-editorial text-[#D4AF37]">
                        {displayMoney(item.totalCents || item.unitPriceCents * item.quantity, orderStatus)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-white/10 space-y-1.5 text-xs font-meta">
              <div className="flex justify-between text-[#8E8B82]">
                <span>Subtotal</span>
                <span>{displayMoney(orderStatus.subtotalCents || orderStatus.totalCents, orderStatus)}</span>
              </div>
              {orderStatus.discountCents > 0 && (
                <div className="flex justify-between text-[#10b981]">
                  <span>Discount {orderStatus.couponCode ? `(${orderStatus.couponCode})` : ''}</span>
                  <span>-{displayMoney(orderStatus.discountCents, orderStatus)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#8E8B82]">
                <span>Delivery Fee ({orderStatus.estimatedTransitTime || '1–4 business days'})</span>
                <span>
                  {orderStatus.shippingFeeCents > 0 ? displayMoney(orderStatus.shippingFeeCents, orderStatus) : 'Complimentary'}
                </span>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[#F8F7F4] font-semibold">Amount Paid ({orderStatus.currency || currency})</span>
                <span className="text-base font-bold text-[#D4AF37] font-editorial">
                  {displayMoney(orderStatus.totalCents, orderStatus)}
                </span>
              </div>
            </div>
          </div>

          {/* Delivery Details Card */}
          <div className="border border-white/10 bg-[#121212] p-6 rounded-xs space-y-3">
            <h3 className="font-editorial text-sm font-semibold text-[#F8F7F4]">
              Delivery Details
            </h3>
            <div className="text-xs text-[#A9A69F] space-y-1">
              {orderStatus.shippingAddress?.fullName && (
                <p className="text-[#F8F7F4] font-semibold">{orderStatus.shippingAddress.fullName}</p>
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
                <p className="font-mono text-[#8E8B82]">{orderStatus.shippingAddress.phone}</p>
              )}
              <p className="pt-2 text-[#D4AF37] font-meta text-[11px]">
                Estimated Delivery: {orderStatus.estimatedTransitTime || '1–4 business days'} · Fulfilment Status:{' '}
                <span className="uppercase">{orderStatus.fulfilmentStatus}</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate(`/track/${encodeURIComponent(orderStatus.orderReference)}`)}
              className="w-full sm:w-1/2 gold-gradient-bg text-[#0B0B0B] py-3 text-xs font-meta font-bold uppercase tracking-wider rounded-xs hover:brightness-110 cursor-pointer"
            >
              Track Order Dispatch →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/account')}
              className="w-full sm:w-1/2 bg-[#181818] border border-white/10 text-[#EDEDED] py-3 text-xs font-meta uppercase tracking-wider rounded-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              View Order in Account
            </button>
          </div>
        </div>
      )}

      {/* 3. Awaiting Bank Transfer State */}
      {!loading && isAwaitingTransfer && orderStatus && (
        <div className="space-y-6">
          <div className="border border-[#D4AF37]/30 bg-[#14120a] p-7 text-center space-y-4 rounded-xs">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-2xl font-editorial">
              V
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.22em] font-meta text-[#D4AF37] block">
                ORDER REGISTERED · AWAITING PAYMENT
              </span>
              <h1 className="font-editorial text-2xl font-bold text-[#F8F7F4]">
                Complete Bank Transfer
              </h1>
              <p className="text-xs text-[#A9A69F] max-w-md mx-auto leading-relaxed">
                Transfer <strong className="text-[#D4AF37]">{displayMoney(orderStatus.totalCents, orderStatus)}</strong> using your order reference as transfer narration. Orders remain pending until confirmed.
              </p>
            </div>

            <div className="bg-[#0B0B0B] border border-white/10 p-4 rounded-xs max-w-md mx-auto text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#73736E]">Order Reference:</span>
                <span className="font-mono font-bold text-[#D4AF37]">{orderStatus.orderReference}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#73736E]">Bank Name:</span>
                <span className="text-[#EDEDED]">{activeBank.bankName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#73736E]">Account Number:</span>
                <span className="font-mono text-[#D4AF37] font-bold">{activeBank.accountNumber}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#73736E]">Account Name:</span>
                <span className="text-[#EDEDED]">{activeBank.accountName}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-white/5">
                <span className="text-[#73736E]">Amount Due:</span>
                <span className="font-editorial font-bold text-[#D4AF37]">
                  {displayMoney(orderStatus.totalCents, orderStatus)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                  `Hello CEO Adnuel, I have initiated bank transfer for VANTÉRA order ${orderStatus.orderReference}. Amount: ${displayMoney(orderStatus.totalCents, orderStatus)}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#0F2E22] border border-[#34A853]/40 text-[#48BB78] px-5 py-2.5 text-xs font-meta uppercase tracking-wider rounded-xs hover:bg-[#153e2f] transition-colors"
              >
                <span>Notify CEO Adnuel on WhatsApp ↗</span>
              </a>
              <button
                type="button"
                onClick={() => onNavigate(`/track/${encodeURIComponent(orderStatus.orderReference)}`)}
                className="bg-[#181818] border border-white/15 text-[#EDEDED] px-5 py-2.5 text-xs font-meta uppercase tracking-wider rounded-xs hover:border-[#D4AF37] cursor-pointer"
              >
                Track Order →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Verified Payment Failed State */}
      {isFailed && (
        <div className="border border-red-500/30 bg-red-950/20 p-8 text-center space-y-5 rounded-xs shadow-xl">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-950/40 border border-red-500/40 text-red-400 text-2xl font-bold">
            ✕
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-[0.25em] font-meta text-red-400 block">
              PAYMENT FAILED
            </span>
            <h1 className="font-editorial text-2xl font-bold text-[#F8F7F4]">
              Transaction Not Completed
            </h1>
            <p className="text-xs text-[#A9A69F] max-w-md mx-auto leading-relaxed">
              {failureReason ||
                'Your payment could not be completed or was cancelled before authorization. Your bag items have been kept intact.'}
            </p>
          </div>

          <div className="space-y-3 pt-2 max-w-sm mx-auto">
            <button
              type="button"
              onClick={handleTryAgain}
              className="w-full gold-gradient-bg text-[#0B0B0B] py-3 text-xs font-meta font-bold uppercase tracking-wider rounded-xs hover:brightness-110 cursor-pointer shadow-lg"
            >
              Try Again (Cart Intact)
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              className="w-full bg-[#181818] border border-white/10 text-[#EDEDED] py-2.5 text-xs font-meta uppercase tracking-wider rounded-xs hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              Contact Support Concierge
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
