import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCart } from '../contexts/CartContext.tsx';

interface TrackOrderPageProps {
  onNavigate: (url: string) => void;
  initialReference?: string;
}

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({ onNavigate, initialReference }) => {
  const { token } = useAuth();
  const { clearCart, setIsCartOpen } = useCart();

  const [reference, setReference] = useState(initialReference || '');
  const [orderData, setOrderData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const clearedCartRef = useRef<boolean>(false);

  const performLookup = async (rawRef: string, silent = false) => {
    const cleanRef = rawRef.trim().toUpperCase();
    if (!cleanRef) return null;
    if (!silent) {
      setErrorMessage('');
      setIsLoading(true);
    }

    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const result = await safeFetchJson<{ order?: any }>(`/api/orders/track/${encodeURIComponent(cleanRef)}`, {
        headers,
      });

      if (result.ok && result.data) {
        const ord = result.data.order || result.data;
        setOrderData(ord);
        if (ord.paymentStatus === 'paid' && !clearedCartRef.current) {
          clearedCartRef.current = true;
          clearCart();
        }
        return ord;
      }

      if (!silent) {
        setErrorMessage(result.error || 'Order reference not found. Please check your reference code.');
        setOrderData(null);
      }
      return null;
    } catch {
      if (!silent) {
        setErrorMessage('Unable to look up order reference. Please check your reference code.');
        setOrderData(null);
      }
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialReference) {
      setReference(initialReference);
      performLookup(initialReference);
    }
  }, [initialReference, token]);

  // Live poll when customer views a pending online card order on the tracking screen
  useEffect(() => {
    if (
      !orderData ||
      orderData.paymentMethod !== 'card_online' ||
      orderData.paymentStatus !== 'pending'
    ) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        await safeFetchJson('/api/payments/wavy/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: orderData.paymentReference || orderData.orderReference,
            orderReference: orderData.orderReference,
          }),
        });
      } catch {}
      if (isMounted) {
        await performLookup(orderData.orderReference, true);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [orderData?.orderReference, orderData?.paymentStatus, orderData?.paymentMethod]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    await performLookup(reference);
  };

  const formatMoney = (cents: number) => {
    if (!orderData) return formatUSD(cents);
    if (orderData.currency === 'NGN') {
      return formatNGN(convertUsdCentsToNgn(cents, orderData.exchangeRateUsed || 1500));
    }
    return formatUSD(cents);
  };

  const isPaid = orderData?.paymentStatus === 'paid';
  const isFailed = orderData?.paymentStatus === 'failed';
  const isConfirmingGateway =
    orderData?.paymentMethod === 'card_online' && orderData?.paymentStatus === 'pending';
  const isProcessing = orderData?.fulfilmentStatus === 'processing';
  const isShipped = orderData?.fulfilmentStatus === 'shipped' || orderData?.fulfilmentStatus === 'delivered';
  const isDelivered = orderData?.fulfilmentStatus === 'delivered';
  const isCancelled = orderData?.fulfilmentStatus === 'cancelled';

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 lg:py-20 space-y-8 font-meta text-[#111111]">
      <div className="text-center space-y-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#7A6230] font-semibold block">
          Transparent Fulfillment
        </span>
        <h1 className="font-editorial text-3xl sm:text-5xl font-medium text-[#111111] leading-tight">
          Track Your <em className="italic font-normal">Order</em>
        </h1>
        <p className="text-xs sm:text-sm text-[#5C574E] leading-relaxed max-w-lg mx-auto">
          Enter your order reference (e.g. <strong className="font-semibold text-[#111111] tabular-nums">VAN-2026-XXXX</strong>) to view live payment confirmation and dispatch status.
        </p>
      </div>

      {/* Tracking Search Bar */}
      <div className="border border-[#111111]/12 bg-[#FAF7F2] p-5 sm:p-7 rounded-xs space-y-3">
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            aria-label="Order reference number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. VAN-2026-8492"
            className="flex-1 bg-[#F7F3EC] border border-[#111111]/15 px-4 py-3 text-xs uppercase tracking-[0.12em] tabular-nums text-[#111111] placeholder-[#5C574E]/60 focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="sm:w-44 gold-gradient-bg py-3 px-5 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? 'Searching...' : 'Track Order'}
          </button>
        </form>

        {errorMessage && (
          <div className="p-3 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Live Payment State Banner when confirming or failed */}
      {isConfirmingGateway && (
        <div className="border border-[#B89B5E]/40 bg-[#FAF7F2] p-6 sm:p-8 rounded-xs space-y-4">
          <div className="w-full h-0.5 bg-[#111111]/10 overflow-hidden rounded-full">
            <div className="h-full w-1/2 bg-[#B89B5E] vantera-loader-bar" />
          </div>
          <div className="space-y-1">
            <h2 className="font-editorial text-xl font-medium text-[#111111]">
              Confirming your payment...
            </h2>
            <p className="text-xs text-[#5C574E] leading-relaxed">
              Checking gateway confirmation automatically. This updates the moment settlement completes.
            </p>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="border border-[#8E3A3A]/30 bg-[#FAF7F2] p-6 rounded-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E3A3A]">
              Payment Failed / Cancelled
            </span>
          </div>
          <p className="text-xs text-[#5C574E] leading-relaxed">
            The payment was declined or cancelled before settlement. Your saved items in your shopping bag remain intact.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsCartOpen(true);
              onNavigate('/');
            }}
            className="gold-gradient-bg px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] rounded-xs cursor-pointer"
          >
            Return to Bag & Try Again
          </button>
        </div>
      )}

      {/* Order Results */}
      {orderData && (
        <div className="border border-[#111111]/12 bg-[#FAF7F2] p-6 sm:p-8 space-y-7 rounded-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#111111]/10 pb-5">
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#7A6230] font-semibold block">
                {isPaid ? 'Payment Verified' : 'Order Status'}
              </span>
              <h2 className="text-xl font-editorial font-medium text-[#111111] tabular-nums break-all">
                {orderData.orderReference}
              </h2>
              <span className="text-xs text-[#5C574E] block">
                Placed {new Date(orderData.createdAt).toLocaleDateString()} · Payment:{' '}
                <span className="uppercase">{orderData.paymentMethod?.replace('_', ' ')}</span>
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-xl font-editorial font-medium text-[#111111] tabular-nums block">
                {formatMoney(orderData.totalCents)}
              </span>
              <span className="text-[11px] text-[#5C574E] tabular-nums block">
                {orderData.itemCount} item{orderData.itemCount === 1 ? '' : 's'} · {orderData.currency || 'USD'}
              </span>
            </div>
          </div>

          {/* Fulfillment Timeline */}
          <div className="space-y-4">
            <h3 className="font-editorial text-lg font-medium text-[#111111]">Fulfillment Milestones</h3>
            <div className="relative pl-5 space-y-6 border-l border-[#111111]/15 ml-2">
              <div className="relative">
                <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full bg-[#B89B5E]" />
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111111]">1. Order Created</h4>
                <p className="text-xs text-[#5C574E] mt-0.5">Order reference registered in the VANTÉRA ledger.</p>
              </div>

              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full ${
                    isPaid ? 'bg-[#111111]' : isFailed ? 'bg-[#8E3A3A]' : 'bg-[#B89B5E]/40'
                  }`}
                />
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111111]">
                  2. Payment Settlement
                </h4>
                <p className="text-xs text-[#5C574E] mt-0.5">
                  Status:{' '}
                  <strong className={`uppercase ${isPaid ? 'text-[#111111]' : isFailed ? 'text-[#8E3A3A]' : 'text-[#7A6230]'}`}>
                    {orderData.paymentStatus === 'pending' && orderData.paymentMethod === 'bank_transfer'
                      ? 'Awaiting Bank Transfer Confirmation'
                      : orderData.paymentStatus.replace('_', ' ')}
                  </strong>
                  {orderData.paymentVerifiedAt && (
                    <span className="text-[11px] text-[#7A6230] block mt-0.5">
                      Confirmed on {new Date(orderData.paymentVerifiedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full ${
                    isCancelled ? 'bg-[#8E3A3A]' : isProcessing || isShipped ? 'bg-[#B89B5E]' : 'bg-[#111111]/20'
                  }`}
                />
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111111]">
                  3. Processing & Courier Dispatch
                </h4>
                {isCancelled ? (
                  <p className="text-xs text-[#8E3A3A] mt-0.5 uppercase">Order Cancelled</p>
                ) : orderData.trackingNumber ? (
                  <div className="mt-1 text-xs text-[#5C574E] space-y-1">
                    <p>Carrier: <strong className="text-[#111111]">{orderData.carrier}</strong></p>
                    <p className="tabular-nums">Tracking: {orderData.trackingNumber}</p>
                    {orderData.trackingUrl && (
                      <a
                        href={orderData.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7A6230] border-b border-[#B89B5E] inline-block mt-1 hover:text-[#111111]"
                      >
                        Live Tracking Link →
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#5C574E] mt-0.5">
                    Status: <span className="uppercase text-[#111111] font-medium">{orderData.fulfilmentStatus}</span> · Est.{' '}
                    {orderData.estimatedTransitTime || '1–4 business days'}
                  </p>
                )}
              </div>

              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-full ${
                    isDelivered ? 'bg-[#111111]' : 'bg-[#111111]/20'
                  }`}
                />
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111111]">4. Delivery</h4>
                <p className="text-xs text-[#5C574E] mt-0.5">
                  {isDelivered
                    ? 'Delivered to recipient.'
                    : `Destination: ${[orderData.shippingAddress?.city, orderData.shippingAddress?.state, orderData.shippingAddress?.country].filter(Boolean).join(', ')}`}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Summary & Fee Breakdown */}
          {orderData.items && orderData.items.length > 0 && (
            <div className="pt-5 border-t border-[#111111]/10 space-y-3">
              <h3 className="font-editorial text-lg font-medium text-[#111111]">Order Items</h3>
              <div className="space-y-2">
                {orderData.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-[#111111]">
                      {item.quantity}x {item.title}
                    </span>
                    <span className="font-medium text-[#111111] tabular-nums">{formatMoney(item.totalCents)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-[#111111]/10 space-y-1.5 text-xs text-[#5C574E]">
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="tabular-nums text-[#111111]">
                    {orderData.shippingFeeCents > 0 ? formatMoney(orderData.shippingFeeCents) : 'Complimentary'}
                  </span>
                </div>
                {orderData.discountCents > 0 && (
                  <div className="flex justify-between text-[#7A6230]">
                    <span>Discount</span>
                    <span className="tabular-nums">-{formatMoney(orderData.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-[#111111] pt-2 border-t border-[#111111]/10">
                  <span>Total ({orderData.currency || 'USD'})</span>
                  <span className="font-editorial text-base tabular-nums">{formatMoney(orderData.totalCents)}</span>
                </div>
              </div>
            </div>
          )}

          {orderData.returnRequested && (
            <div className="bg-[#F7F3EC] border border-[#B89B5E]/40 p-3.5 rounded-xs text-xs text-[#7A6230]">
              Return Request Status:{' '}
              <strong className="uppercase">{orderData.returnStatus || 'pending'}</strong>
            </div>
          )}

          {/* Help box */}
          <div className="bg-[#F7F3EC] border border-[#111111]/10 p-4 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#5C574E]">
              Need receipt assistance or immediate status confirmation?
            </div>
            <a
              href={`https://wa.me/2347015285932?text=${encodeURIComponent(
                `Hello CEO Adnuel, I am inquiring about order ${orderData.orderReference}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gold-gradient-bg px-4 py-2.5 text-[10px] uppercase font-semibold tracking-[0.18em] rounded-xs text-center inline-flex items-center justify-center gap-2 shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>WhatsApp Concierge</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
