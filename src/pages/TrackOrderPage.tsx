import React, { useState, useEffect, useRef } from 'react';
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
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-12 lg:py-16 space-y-8 font-meta">
      <div className="text-center space-y-2.5">
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#C8A96A] block">
          Transparent Fulfillment
        </span>
        <h1 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F5F1E8] leading-snug">
          Track Your Order
        </h1>
        <p className="text-xs sm:text-sm text-[#A8A297] leading-relaxed">
          Enter your order reference (e.g. <strong className="font-mono text-[#C8A96A]">VAN-2026-XXXX</strong>) to view live payment confirmation and dispatch status.
        </p>
      </div>

      {/* Tracking Search Bar */}
      <div className="border border-white/10 bg-[#141416] p-5 sm:p-6 rounded-xs space-y-3">
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            aria-label="Order reference number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. VAN-2026-8492"
            className="flex-1 bg-[#0B0B0C] border border-white/12 px-4 py-3 text-xs font-mono uppercase text-[#F5F1E8] placeholder-[#A8A297]/50 focus:border-[#C8A96A] focus:outline-hidden rounded-xs"
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
          <div className="p-3 bg-[#221212] border border-red-500/30 text-red-300 text-xs rounded-xs">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Live Payment State Banner when confirming or failed */}
      {isConfirmingGateway && (
        <div className="border border-[#C8A96A]/40 bg-[#141416] p-6 rounded-xs space-y-3">
          <div className="w-full h-0.5 bg-white/10 overflow-hidden rounded-full">
            <div className="h-full w-1/2 bg-[#C8A96A] vantera-loader-bar" />
          </div>
          <div className="space-y-1">
            <h2 className="font-editorial text-lg font-medium text-[#F5F1E8]">
              Confirming your payment...
            </h2>
            <p className="text-xs text-[#A8A297]">
              Checking gateway webhook status automatically. This updates as soon as payment settles.
            </p>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="border border-red-500/30 bg-red-950/20 p-5 rounded-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400">
              Payment Failed / Cancelled
            </span>
          </div>
          <p className="text-xs text-[#A9A69F]">
            The payment was declined or cancelled before settlement. Your saved items in your shopping bag remain intact.
          </p>
          <button
            type="button"
            onClick={() => {
              setIsCartOpen(true);
              onNavigate('/');
            }}
            className="gold-gradient-bg text-[#0B0B0B] px-4 py-2 text-[11px] font-meta font-bold uppercase tracking-wider rounded-xs cursor-pointer"
          >
            Return to Bag & Try Again
          </button>
        </div>
      )}

      {/* Order Results */}
      {orderData && (
        <div className="border border-white/10 bg-[#121212] p-6 space-y-6 rounded-xs shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-meta text-[#D4AF37] block">
                {isPaid ? '✦ PAYMENT SUCCESSFUL' : 'ORDER STATUS'}
              </span>
              <h2 className="font-mono text-lg font-bold text-[#F8F7F4] break-all">{orderData.orderReference}</h2>
              <span className="text-[11px] text-[#8E8B82] block">
                Placed {new Date(orderData.createdAt).toLocaleDateString()} · Payment:{' '}
                <span className="uppercase">{orderData.paymentMethod?.replace('_', ' ')}</span>
              </span>
            </div>
            <div className="sm:text-right">
              <span className="text-lg font-editorial font-bold text-[#D4AF37] block">
                {formatMoney(orderData.totalCents)}
              </span>
              <span className="text-[10px] text-[#8E8B82] block">
                {orderData.itemCount} item{orderData.itemCount === 1 ? '' : 's'} · {orderData.currency || 'USD'}
              </span>
            </div>
          </div>

          {/* Fulfillment Timeline */}
          <div className="space-y-4">
            <h3 className="font-editorial text-sm font-semibold text-[#F8F7F4]">Fulfillment Milestones</h3>
            <div className="relative pl-5 space-y-5 border-l border-white/10 ml-2">
              <div className="relative">
                <div className="absolute -left-[25px] top-0.5 w-3 h-3 rounded-full bg-[#D4AF37]" />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">1. Order Created</h4>
                <p className="text-[10px] text-[#8E8B82] mt-0.5">Order reference generated in the VANTÉRA ledger.</p>
              </div>

              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full ${
                    isPaid ? 'bg-[#34A853]' : isFailed ? 'bg-red-500' : 'bg-[#D4AF37]/40'
                  }`}
                />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">
                  2. Payment Settlement
                </h4>
                <p className="text-[10px] text-[#8E8B82] mt-0.5">
                  Status:{' '}
                  <strong className={`uppercase ${isPaid ? 'text-[#34A853]' : isFailed ? 'text-red-400' : 'text-[#D4AF37]'}`}>
                    {orderData.paymentStatus === 'pending' && orderData.paymentMethod === 'bank_transfer'
                      ? 'Awaiting Bank Transfer Confirmation'
                      : orderData.paymentStatus.replace('_', ' ')}
                  </strong>
                  {orderData.paymentVerifiedAt && (
                    <span className="text-[10px] text-[#34A853] block">
                      ✓ Confirmed on {new Date(orderData.paymentVerifiedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full ${
                    isCancelled ? 'bg-red-500' : isProcessing || isShipped ? 'bg-[#34A853]' : 'bg-white/20'
                  }`}
                />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">
                  3. Processing & Courier Dispatch
                </h4>
                {isCancelled ? (
                  <p className="text-[10px] text-red-400 mt-0.5 uppercase">Order Cancelled</p>
                ) : orderData.trackingNumber ? (
                  <div className="mt-0.5 text-[10px] text-[#A9A69F] space-y-0.5">
                    <p>Carrier: <strong>{orderData.carrier}</strong></p>
                    <p className="font-mono">Tracking: {orderData.trackingNumber}</p>
                    {orderData.trackingUrl && (
                      <a
                        href={orderData.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF37] underline block mt-1"
                      >
                        Live Tracking Link →
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#8E8B82] mt-0.5">
                    Status: <span className="uppercase text-[#EDEDED]">{orderData.fulfilmentStatus}</span> · Est.{' '}
                    {orderData.estimatedTransitTime || '1–4 business days'}
                  </p>
                )}
              </div>

              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full ${
                    isDelivered ? 'bg-[#34A853]' : 'bg-white/20'
                  }`}
                />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">4. Delivery</h4>
                <p className="text-[10px] text-[#8E8B82] mt-0.5">
                  {isDelivered
                    ? 'Delivered to recipient.'
                    : `Destination: ${[orderData.shippingAddress?.city, orderData.shippingAddress?.state, orderData.shippingAddress?.country].filter(Boolean).join(', ')}`}
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Summary & Fee Breakdown */}
          {orderData.items && orderData.items.length > 0 && (
            <div className="pt-4 border-t border-white/5 space-y-3">
              <h3 className="font-editorial text-sm font-semibold text-[#F8F7F4]">Order Items</h3>
              <div className="space-y-2">
                {orderData.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-[#EDEDED]">
                      {item.quantity}x {item.title}
                    </span>
                    <span className="font-editorial text-[#D4AF37]">{formatMoney(item.totalCents)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-[#8E8B82]">
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span>
                    {orderData.shippingFeeCents > 0 ? formatMoney(orderData.shippingFeeCents) : 'Complimentary'}
                  </span>
                </div>
                {orderData.discountCents > 0 && (
                  <div className="flex justify-between text-[#34A853]">
                    <span>Discount</span>
                    <span>-{formatMoney(orderData.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#F8F7F4] pt-1">
                  <span>Total ({orderData.currency || 'USD'})</span>
                  <span className="text-[#D4AF37]">{formatMoney(orderData.totalCents)}</span>
                </div>
              </div>
            </div>
          )}

          {orderData.returnRequested && (
            <div className="bg-[#181818] border border-amber-500/30 p-3 rounded-xs text-xs text-amber-300">
              Return Request Status:{' '}
              <strong className="uppercase">{orderData.returnStatus || 'pending'}</strong>
            </div>
          )}

          {/* Help box */}
          <div className="bg-[#161616] border border-white/5 p-3.5 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-[11px] text-[#8E8B82]">
              Need receipt assistance or immediate status confirmation?
            </div>
            <a
              href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                `Hello CEO Adnuel, I am inquiring about order ${orderData.orderReference}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0F2E22] text-[#48BB78] border border-[#34A853]/30 px-3.5 py-2 text-[10px] uppercase font-bold tracking-wider rounded-xs text-center hover:bg-[#153e2f] transition-colors shrink-0"
            >
              WhatsApp Concierge ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
