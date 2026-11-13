/**
 * VANTÉRA PayWithCard Component
 * Slogan: Technology, Elevated.
 *
 * Implements luxury card and instant bank transfer checkout integration
 * utilizing Wavy (wavy.ng) for Debit/Credit Cards (Mastercard, Visa, Verve),
 * Bank Transfers, and Apple Pay with strict server-side verification.
 */

import React, { useState, useEffect } from 'react';
import { formatPrice } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';

interface PayWithCardProps {
  email: string;
  customerName: string;
  customerPhone?: string;
  amountKobo: number;
  centsUSD: number;
  currency: 'NGN' | 'USD';
  exchangeRate: number;
  orderReference: string;
  onInitiateOrderCheckout?: () => Promise<{
    order: any;
    paymentReference: string;
  } | null>;
  onGatewaySessionReady?: (order: any, paymentReference: string, checkoutUrl?: string) => void;
  onPaymentSuccess: (reference: string, channel?: string) => void;
  onPaymentFailed?: (reason: string) => void;
  disabled?: boolean;
}

export const PayWithCard: React.FC<PayWithCardProps> = ({
  email,
  customerName,
  customerPhone,
  amountKobo,
  centsUSD,
  currency,
  exchangeRate,
  orderReference,
  onInitiateOrderCheckout,
  onGatewaySessionReady,
  onPaymentSuccess,
  onPaymentFailed,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);

  useEffect(() => {
    safeFetchJson<any>('/api/payment-settings').then((res) => {
      if (res.ok && res.data) {
        setIsTestMode(res.data.isTestMode ?? false);
      }
    });
  }, []);

  const handlePay = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !customerName) {
      setErrorMessage('Please fill in your name and email address above.');
      return;
    }

    setIsLoading(true);

    try {
      let targetOrder: any = null;
      let ref = `${orderReference}_${Date.now()}`;
      let targetOrderRef = orderReference;
      let targetAmountUnits = currency === 'NGN' ? amountKobo / 100 : centsUSD / 100;
      let targetAmountKobo = amountKobo;

      if (onInitiateOrderCheckout) {
        const initiated = await onInitiateOrderCheckout();
        if (!initiated) {
          setIsLoading(false);
          return;
        }
        targetOrder = initiated.order;
        ref = initiated.paymentReference;
        targetOrderRef = targetOrder.orderReference;
        const rate = targetOrder.exchangeRateUsed || exchangeRate;
        const authoritativeCents = targetOrder.totalCents || centsUSD;
        targetAmountUnits =
          currency === 'NGN'
            ? Math.round((authoritativeCents / 100) * rate)
            : authoritativeCents / 100;
        targetAmountKobo = Math.round(targetAmountUnits * 100);
      }

      // 1. Initialize checkout session with Wavy API
      const initRes = await safeFetchJson<{
        status?: boolean;
        authorization_url?: string;
        data?: { authorization_url?: string; reference?: string };
        message?: string;
        error?: string;
      }>('/api/payments/wavy/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          amount: targetAmountUnits,
          amountKobo: targetAmountKobo,
          reference: ref,
          orderReference: targetOrderRef,
          currency,
          customerName,
          customerPhone,
        }),
      });

      if (!initRes.ok) {
        const msg = initRes.data?.error || initRes.error || 'Could not initialize payment gateway session.';
        setErrorMessage(msg);
        onPaymentFailed?.(msg);
        return;
      }

      const authUrl = initRes.data?.authorization_url || initRes.data?.data?.authorization_url;

      if (authUrl && authUrl.startsWith('http')) {
        window.open(authUrl, '_blank', 'noopener,noreferrer');
      }

      if (targetOrder && onGatewaySessionReady) {
        onGatewaySessionReady(targetOrder, ref, authUrl);
        return;
      }

      // Fallback standalone verification check (strictly requires server confirmation)
      const verifyRes = await safeFetchJson<{
        success?: boolean;
        failed?: boolean;
        pending?: boolean;
        verifyData?: any;
        error?: string;
      }>('/api/payments/wavy/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: ref,
          orderReference: targetOrderRef,
        }),
      });

      if (verifyRes.ok && verifyRes.data?.success) {
        onPaymentSuccess(ref, verifyRes.data.verifyData?.channel || 'wavy_card');
      } else {
        const reason =
          verifyRes.data?.error || 'Payment not confirmed yet. Complete payment in the Wavy window to confirm your order.';
        setErrorMessage(reason);
        onPaymentFailed?.(reason);
      }
    } catch {
      const msg = 'Unable to connect to the payment gateway. Please try again.';
      setErrorMessage(msg);
      onPaymentFailed?.(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formattedAmount = formatPrice(centsUSD, currency, exchangeRate);

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="border border-red-500/30 bg-red-950/40 p-2.5 text-xs text-red-300 rounded-xs">
          {errorMessage}
        </div>
      )}

      <div className="border border-white/10 bg-[#0E0E0E] p-3.5 space-y-2.5 rounded-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-editorial text-sm font-semibold text-[#F5F5F0]">Pay with Card / Wavy</span>
            {isTestMode ? (
              <span className="bg-[#181818] text-[#A0A09A] text-[9px] px-1.5 py-0.5 font-mono uppercase rounded-xs border border-white/10">
                Test Mode
              </span>
            ) : (
              <span className="bg-[#0F2E22] text-[#48BB78] text-[9px] px-1.5 py-0.5 font-mono uppercase font-bold rounded-xs border border-[#34A853]/30">
                WAVY LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span title="Visa" className="px-1.5 py-0.5 bg-[#181818] border border-white/10 font-mono text-[9px] font-bold text-[#EDEDED]">
              VISA
            </span>
            <span title="Mastercard" className="px-1.5 py-0.5 bg-[#181818] border border-white/10 font-mono text-[9px] font-bold text-[#D4AF37]">
              MC
            </span>
            <span title="Verve" className="px-1.5 py-0.5 bg-[#181818] border border-white/10 font-mono text-[9px] font-bold text-[#48BB78]">
              VERVE
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#8E8B82] leading-relaxed">
          Pay securely in <strong className="text-[#EDEDED]">{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}</strong> via Wavy. Orders are automatically marked paid upon live gateway confirmation.
        </p>

        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={handlePay}
          className="w-full bg-[#1e7e34] hover:bg-[#155724] text-white py-3 text-xs uppercase tracking-widest font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer rounded-xs"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Connecting to Wavy Gateway...</span>
            </span>
          ) : (
            <span>🔒 Pay {formattedAmount} via Wavy</span>
          )}
        </button>
      </div>
    </div>
  );
};
