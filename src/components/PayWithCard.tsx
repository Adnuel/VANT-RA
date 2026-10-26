/**
 * VANTÉRA PayWithCard Component
 * Slogan: Technology, Elevated.
 *
 * Provides a luxury card and instant bank transfer checkout integration
 * utilizing Paystack Inline for Debit/Credit Cards (Mastercard, Visa, Verve),
 * USSD, and Apple Pay.
 */

import React, { useState, useEffect } from 'react';
import { formatPrice } from '../lib/commerceLogic.ts';

declare global {
  interface Window {
    PaystackPop?: any;
  }
}

interface PayWithCardProps {
  email: string;
  customerName: string;
  customerPhone?: string;
  amountKobo: number; // in Kobo for NGN or Cents for USD
  centsUSD: number;
  currency: 'NGN' | 'USD';
  exchangeRate: number;
  orderReference: string;
  onPaymentSuccess: (reference: string, channel?: string) => void;
  onPaymentCancel?: () => void;
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
  onPaymentSuccess,
  onPaymentCancel,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [isTestMode, setIsTestMode] = useState(true);

  // Fetch verified payment settings from server
  useEffect(() => {
    fetch('/api/payment-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setPublicKey(data.paystackPublicKey || 'pk_test_sample_vantera_key');
          setIsTestMode(data.isTestMode ?? true);
        }
      })
      .catch(() => {});
  }, []);

  // Dynamically load Paystack script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.PaystackPop) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handlePay = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !customerName) {
      setErrorMessage('Please fill in your name and email address above.');
      return;
    }

    setIsLoading(true);

    // If live Paystack script is loaded, launch popup
    if (window.PaystackPop && publicKey && !publicKey.includes('sample')) {
      try {
        const handler = window.PaystackPop.setup({
          key: publicKey,
          email: email.trim(),
          amount: amountKobo,
          currency: currency,
          ref: `${orderReference}_${Date.now()}`,
          metadata: {
            custom_fields: [
              {
                display_name: 'Customer Name',
                variable_name: 'customer_name',
                value: customerName,
              },
              {
                display_name: 'Order Reference',
                variable_name: 'order_reference',
                value: orderReference,
              },
            ],
          },
          callback: async (response: { reference: string }) => {
            setIsLoading(false);
            // Verify on server
            try {
              const verifyRes = await fetch('/api/payments/paystack/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  reference: response.reference,
                  orderReference,
                }),
              });
              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
                onPaymentSuccess(response.reference, verifyData.verifyData?.channel || 'card');
              } else {
                setErrorMessage(verifyData.error || 'Payment verification failed');
              }
            } catch (err: any) {
              setErrorMessage('Verification network error: ' + err.message);
            }
          },
          onClose: () => {
            setIsLoading(false);
            if (onPaymentCancel) onPaymentCancel();
          },
        });

        handler.openIframe();
        return;
      } catch (err: any) {
        console.error('Paystack popup error:', err);
      }
    }

    // Direct server-side initialization or development mode fallback
    try {
      const initRes = await fetch('/api/payments/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          amountKobo,
          reference: `${orderReference}_${Date.now()}`,
          currency,
        }),
      });

      const initData = await initRes.json();

      if (initData.status && initData.data?.reference) {
        // Automatically verify transaction
        const verifyRes = await fetch('/api/payments/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: initData.data.reference,
            orderReference,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          onPaymentSuccess(initData.data.reference, 'paystack_card');
        } else {
          setErrorMessage(verifyData.error || 'Payment could not be verified.');
        }
      } else {
        setErrorMessage(initData.message || 'Payment service is temporarily unavailable.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment connection failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formattedAmount = formatPrice(centsUSD, currency, exchangeRate);

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="border border-[#f8b4b4] bg-[#fdf2f2] p-2.5 text-xs text-[#9b1c1c]">
          {errorMessage}
        </div>
      )}

      <div className="border border-[#e7e4de] bg-[#fdfdfc] p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm font-semibold text-[#121210]">Pay with Card / Paystack</span>
            {isTestMode && (
              <span className="bg-[#eae7e0] text-[#77746d] text-[9px] px-1.5 py-0.5 font-mono uppercase">
                Test Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span title="Visa" className="px-1.5 py-0.5 bg-white border border-[#e7e4de] font-mono text-[9px] font-bold text-[#1a1f71]">
              VISA
            </span>
            <span title="Mastercard" className="px-1.5 py-0.5 bg-white border border-[#e7e4de] font-mono text-[9px] font-bold text-[#eb001b]">
              MC
            </span>
            <span title="Verve" className="px-1.5 py-0.5 bg-white border border-[#e7e4de] font-mono text-[9px] font-bold text-[#00425f]">
              VERVE
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#77746d] leading-relaxed">
          Pay securely in <strong>{currency === 'NGN' ? 'Nigerian Naira (₦)' : 'US Dollar ($)'}</strong> via Paystack. Supports Debit/Credit Cards, USSD, and Bank Transfer with instant verification.
        </p>

        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={handlePay}
          className="w-full bg-[#1e7e34] hover:bg-[#155724] !text-white py-3 text-xs uppercase tracking-widest font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processing Payment...</span>
            </span>
          ) : (
            <span>🔒 Pay {formattedAmount} with Card</span>
          )}
        </button>
      </div>
    </div>
  );
};
