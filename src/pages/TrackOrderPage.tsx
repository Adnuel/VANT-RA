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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="text-center space-y-3">
        <span className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b]">
          TRANSPARENT FULFILMENT
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#121210]">Track Your VANTÉRA Order</h1>
        <p className="text-xs sm:text-sm text-[#77746d] max-w-lg mx-auto leading-relaxed">
          Enter your unique order reference (e.g. <strong className="font-mono">VAN-2026-XXXX</strong>) to check payment verification and real-time shipping dispatch.
        </p>
      </div>

      {/* Tracking Search Bar */}
      <div className="border border-[#e7e4de] bg-white p-6 shadow-sm">
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. VAN-2026-8492"
            className="flex-1 border border-[#e7e4de] px-4 py-3 text-xs font-mono uppercase focus:border-[#121210] focus:outline-hidden"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-[#121210] text-[#f8f7f4] px-8 py-3 text-xs uppercase tracking-widest font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Searching...' : 'Track Milestone'}
          </button>
        </form>

        {errorMessage && (
          <div className="mt-4 p-3 bg-[#fdf2f2] border border-[#f8b4b4] text-[#9b1c1c] text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Order Results */}
      {orderData && (
        <div className="border border-[#e7e4de] bg-white p-8 space-y-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e7e4de] pb-6">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#a9a69f] block">
                AUTHENTICATED ORDER
              </span>
              <h2 className="font-mono text-xl font-bold text-[#121210]">{orderData.orderReference}</h2>
              <span className="text-xs text-[#77746d]">
                Created on {new Date(orderData.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#77746d] block">{orderData.itemCount} items</span>
              <span className="text-lg font-bold text-[#121210]">
                {orderData.currency === 'NGN'
                  ? formatNGN(convertUsdCentsToNgn(orderData.totalCents, orderData.exchangeRateUsed || 1500))
                  : formatUSD(orderData.totalCents)}
              </span>
              <span className="text-[10px] text-[#77746d] font-mono block">
                ~{orderData.currency === 'NGN'
                  ? formatUSD(orderData.totalCents)
                  : formatNGN(convertUsdCentsToNgn(orderData.totalCents, orderData.exchangeRateUsed || 1500))}
              </span>
            </div>
          </div>

          {/* Timeline Milestones */}
          <div className="space-y-6">
            <h3 className="font-serif text-base text-[#121210]">Fulfilment Milestones</h3>
            <div className="relative pl-6 space-y-8 border-l-2 border-[#e7e4de]">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-[#121210] border-2 border-white"></div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">1. Order Created</h4>
                <p className="text-xs text-[#77746d] mt-0.5">Order record generated in database.</p>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div
                  className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                    isPaid ? 'bg-[#1e7e34]' : 'bg-[#e2cfaa]'
                  }`}
                ></div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">
                  2. Direct Bank Transfer Verification
                </h4>
                <p className="text-xs text-[#77746d] mt-0.5">
                  Status:{' '}
                  <strong className="uppercase">
                    {orderData.paymentStatus.replace('_', ' ')}
                  </strong>
                  {orderData.paymentVerifiedAt && (
                    <span className="text-[11px] text-[#1e7e34] block">
                      ✓ Verified by CEO Adnuel on {new Date(orderData.paymentVerifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div
                  className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                    isShipped ? 'bg-[#553c9a]' : 'bg-[#e7e4de]'
                  }`}
                ></div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">
                  3. Carrier Dispatch & Shipping
                </h4>
                {orderData.trackingNumber ? (
                  <div className="mt-1 text-xs text-[#252521] space-y-1">
                    <p>
                      Dispatched via <strong>{orderData.carrier}</strong>
                    </p>
                    <p className="font-mono">Tracking Number: {orderData.trackingNumber}</p>
                    {orderData.trackingUrl && (
                      <a
                        href={orderData.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#553c9a] underline font-medium hover:text-[#121210]"
                      >
                        Open Live Carrier Tracking →
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#77746d] mt-0.5">
                    Awaiting dispatch upon payment confirmation.
                  </p>
                )}
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div
                  className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                    isDelivered ? 'bg-[#1e7e34]' : 'bg-[#e7e4de]'
                  }`}
                ></div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">4. Delivery</h4>
                <p className="text-xs text-[#77746d] mt-0.5">
                  {isDelivered ? 'Package delivered to recipient.' : 'Pending delivery completion.'}
                </p>
              </div>
            </div>
          </div>

          {/* Help box */}
          <div className="bg-[#fbfaf7] border border-[#e7e4de] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-[#77746d]">
              Have a question about your order or need to submit your payment receipt?
            </div>
            <a
              href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                `Hello CEO Adnuel, I am inquiring about order ${orderData.orderReference}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#1e7e34] text-white px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#186429] transition-colors whitespace-nowrap"
            >
              WhatsApp CEO Adnuel
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
