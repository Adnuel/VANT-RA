import React, { useState } from 'react';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';

interface TrackOrderPageProps {
  onNavigate: (url: string) => void;
}

export const TrackOrderPage: React.FC<TrackOrderPageProps> = ({ onNavigate }) => {
  const [reference, setReference] = useState('');
  const [orderData, setOrderData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) return;
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(reference.trim().toUpperCase())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Order reference not found');
      }
      setOrderData(data.order);
    } catch (err: any) {
      setErrorMessage(err.message);
      setOrderData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const isPaid = orderData?.paymentStatus === 'paid';
  const isShipped = orderData?.fulfilmentStatus === 'shipped' || orderData?.fulfilmentStatus === 'delivered';
  const isDelivered = orderData?.fulfilmentStatus === 'delivered';

  return (
    <div className="w-full px-3.5 py-6 space-y-6 font-sans">
      <div className="text-center space-y-2">
        <span className="text-[9px] uppercase tracking-[0.18em] font-meta text-[#D4AF37] block">
          TRANSPARENT FULFILLMENT
        </span>
        <h1 className="font-editorial text-2xl min-[360px]:text-3xl font-bold text-[#F8F7F4] leading-snug break-words">
          Track Your Order
        </h1>
        <p className="text-xs text-[#8E8B82] leading-relaxed break-words font-light">
          Enter your order reference (e.g. <strong className="font-mono text-[#D4AF37]">VAN-2026-XXXX</strong>) to check verification and dispatch.
        </p>
      </div>

      {/* Tracking Search Bar */}
      <div className="border border-white/5 bg-[#121212] p-4 rounded-xs shadow-sm space-y-3">
        <form onSubmit={handleTrack} className="flex flex-col gap-2.5">
          <input
            type="text"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. VAN-2026-8492"
            className="w-full bg-[#181818] border border-white/10 px-3.5 py-2.5 text-xs font-mono uppercase text-[#F8F7F4] placeholder-[#5C5A55] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full gold-gradient-bg text-[#0B0B0B] py-2.5 text-xs uppercase tracking-wider font-meta font-bold rounded-xs hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? 'Searching...' : 'Track Milestone'}
          </button>
        </form>

        {errorMessage && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xs">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Order Results */}
      {orderData && (
        <div className="border border-white/5 bg-[#121212] p-4 space-y-6 rounded-xs shadow-sm">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
            <div>
              <span className="text-[9px] uppercase tracking-wider font-meta text-[#D4AF37] block">
                AUTHENTICATED ORDER
              </span>
              <h2 className="font-mono text-lg font-bold text-[#F8F7F4] break-all">{orderData.orderReference}</h2>
              <span className="text-[11px] text-[#8E8B82]">
                Placed {new Date(orderData.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="pt-1">
              <span className="text-lg font-editorial font-bold text-[#D4AF37] block">
                {orderData.currency === 'NGN'
                  ? formatNGN(convertUsdCentsToNgn(orderData.totalCents, orderData.exchangeRateUsed || 1500))
                  : formatUSD(orderData.totalCents)}
              </span>
              <span className="text-[10px] text-[#6C6A64]">
                {orderData.itemCount} items
              </span>
            </div>
          </div>

          {/* Timeline Milestones */}
          <div className="space-y-4">
            <h3 className="font-editorial text-sm font-semibold text-[#F8F7F4]">Fulfillment Milestones</h3>
            <div className="relative pl-5 space-y-5 border-l border-white/10 ml-2">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-[25px] top-0.5 w-3 h-3 rounded-full bg-[#D4AF37]"></div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">1. Order Created</h4>
                <p className="text-[10px] text-[#8E8B82] mt-0.5">Order record cataloged in atelier vault.</p>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full ${
                    isPaid ? 'bg-[#34A853]' : 'bg-[#D4AF37]/40'
                  }`}
                ></div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">
                  2. Payment Settlement
                </h4>
                <p className="text-[10px] text-[#8E8B82] mt-0.5">
                  Status: <strong className="uppercase text-[#D4AF37]">{orderData.paymentStatus.replace('_', ' ')}</strong>
                  {orderData.paymentVerifiedAt && (
                    <span className="text-[10px] text-[#34A853] block">
                      ✓ Verified on {new Date(orderData.paymentVerifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full ${
                    isShipped ? 'bg-[#34A853]' : 'bg-white/20'
                  }`}
                ></div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">
                  3. Carrier Dispatch
                </h4>
                {orderData.trackingNumber ? (
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
                    Pending dispatch after settlement confirmation.
                  </p>
                )}
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div
                  className={`absolute -left-[25px] top-0.5 w-3 h-3 rounded-full ${
                    isDelivered ? 'bg-[#34A853]' : 'bg-white/20'
                  }`}
                ></div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#F8F7F4]">4. Delivery</h4>
                <p className="text-[10px] text-[#8E8B82] mt-0.5">
                  {isDelivered ? 'Delivered to client recipient.' : 'Pending delivery completion.'}
                </p>
              </div>
            </div>
          </div>

          {/* Help box */}
          <div className="bg-[#161616] border border-white/5 p-3 rounded-xs flex flex-col gap-2.5">
            <div className="text-[11px] text-[#8E8B82]">
              Need payment receipt assistance or immediate status confirmation?
            </div>
            <a
              href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                `Hello CEO Adnuel, I am inquiring about order ${orderData.orderReference}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#0F2E22] text-[#48BB78] border border-[#34A853]/30 px-3.5 py-2 text-[10px] uppercase font-bold tracking-wider rounded-xs text-center hover:bg-[#153e2f] transition-colors"
            >
              WhatsApp Concierge ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
