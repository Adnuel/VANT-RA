/**
 * VANTÉRA PayWithCard Component
 * Slogan: Technology, Elevated.
 *
 * Implements luxury card and instant bank transfer checkout integration
 * utilizing Wavy (wavy.ng) for Debit/Credit Cards (Mastercard, Visa, Verve),
 * Bank Transfers, and Apple Pay with strict server-side verification.
 */

import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
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
        <div className="border border-[#8E3A3A]/30 bg-[#8E3A3A]/8 p-3 text-xs text-[#8E3A3A] rounded-xs">
          {errorMessage}
        </div>
      )}

      <div className="border border-[#111111]/12 bg-[#F7F3EC] p-4 space-y-3 rounded-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-editorial text-sm font-medium text-[#111111]">Pay with Card / Wavy</span>
            {isTestMode ? (
              <span className="bg-[#EFEAE0] text-[#5C574E] text-[9px] px-2 py-0.5 uppercase tracking-[0.14em] rounded-xs border border-[#111111]/10">
                Test Mode
              </span>
            ) : (
              <span className="bg-[#FAF7F2] text-[#7A6230] text-[9px] px-2 py-0.5 uppercase tracking-[0.14em] font-semibold rounded-xs border border-[#B89B5E]/40">
                Wavy Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em]">
            <span title="Visa" className="px-1.5 py-0.5 bg-[#FAF7F2] border border-[#111111]/12 text-[#111111] rounded-xs">
              VISA
            </span>
            <span title="Mastercard" className="px-1.5 py-0.5 bg-[#FAF7F2] border border-[#111111]/12 text-[#7A6230] rounded-xs">
              MC
            </span>
            <span title="Verve" className="px-1.5 py-0.5 bg-[#FAF7F2] border border-[#111111]/12 text-[#111111] rounded-xs">
              VERVE
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#5C574E] leading-relaxed">
          Pay securely in <strong className="text-[#111111] font-medium">{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}</strong> via Wavy. Orders confirm automatically upon gateway settlement.
        </p>

        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={handlePay}
          className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer rounded-xs"
        >
          {isLoading ? (
            <span className="flex flex-col items-center gap-1.5 w-full">
              <span className="text-[11px]">Connecting to Wavy Gateway...</span>
              <span className="w-28 h-0.5 bg-[#111111]/15 overflow-hidden rounded-full block">
                <span className="block h-full w-1/2 bg-[#111111] vantera-loader-bar" />
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 tabular-nums">
              <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Pay {formattedAmount} via Wavy</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
