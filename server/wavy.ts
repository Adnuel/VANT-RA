/**
 * VANTÉRA Wavy Payment Integration Engine (wavy.ng)
 * Slogan: Technology, Elevated.
 *
 * Implements Wavy multi-currency gateway for Nigerian Naira (NGN), US Dollar (USD),
 * Mastercard, Visa, Verve, and Bank Transfers with real-time verification.
 */

import { db } from './db.ts';

export interface WavyCheckoutParams {
  email: string;
  amount: number; // in standard currency units (e.g. 5000 NGN or $50 USD)
  currency: 'NGN' | 'USD';
  description?: string;
  merchantReference: string;
  reference?: string;
  callbackUrl?: string;
}

export interface WavyCheckoutResponse {
  status: boolean;
  message?: string;
  authorization_url?: string;
  reference?: string;
  data?: {
    authorization_url?: string;
    reference?: string;
    tx_ref?: string;
  };
}

export interface WavyVerifyResponse {
  status: boolean;
  message?: string;
  data?: {
    id?: string | number;
    status: 'success' | 'successful' | 'failed' | 'pending';
    reference?: string;
    tx_ref?: string;
    amount?: number;
    currency?: string;
    paid_at?: string;
    channel?: string;
    customer?: {
      email?: string;
      name?: string;
    };
  };
}

export class WavyService {
  private liveSecretKey = 'wavy_sk_live_cc203228f83a6039c1001b9b24a8ff513346bc49a37db3cb';
  private livePublicKey = 'wavy_pk_live_64e762e61f597be9bfcc4228f2751672';

  public getSecretKey(): string {
    const settings = db.getPaymentSettings();
    if (settings.wavySecretKey && settings.wavySecretKey.startsWith('wavy_sk_')) {
      return settings.wavySecretKey;
    }
    return process.env.WAVY_SECRET_KEY || this.liveSecretKey;
  }

  public getPublicKey(): string {
    const settings = db.getPaymentSettings();
    if (settings.wavyPublicKey && settings.wavyPublicKey.startsWith('wavy_pk_')) {
      return settings.wavyPublicKey;
    }
    return process.env.WAVY_PUBLIC_KEY || process.env.VITE_WAVY_PUBLIC_KEY || this.livePublicKey;
  }

  public isTestMode(): boolean {
    const settings = db.getPaymentSettings();
    return settings.wavyTestMode || this.getSecretKey().includes('test');
  }

  public getCredentials(): { publicKey: string; secretKey: string } {
    return {
      publicKey: this.getPublicKey(),
      secretKey: this.getSecretKey(),
    };
  }

  /**
   * Initializes a checkout session via Wavy REST API
   * POST https://wavy.ng/api/gateway/v1/checkout
   */
  async initializeCheckout(params: WavyCheckoutParams): Promise<WavyCheckoutResponse> {
    const secretKey = this.getSecretKey();

    try {
      const response = await fetch('https://wavy.ng/api/gateway/v1/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency || 'NGN',
          email: params.email,
          description: params.description || `VANTÉRA Order #${params.merchantReference}`,
          merchant_reference: params.merchantReference,
          callback_url: params.callbackUrl,
        }),
      });

      const data = await response.json();

      const authUrl =
        data.authorization_url ||
        data.data?.authorization_url ||
        data.checkout_url ||
        data.data?.checkout_url;

      if (response.ok && (authUrl || data.status)) {
        return {
          status: true,
          authorization_url: authUrl,
          reference: params.merchantReference,
          data: {
            authorization_url: authUrl,
            reference: params.merchantReference,
            tx_ref: data.tx_ref || data.data?.tx_ref || params.merchantReference,
          },
        };
      }

      // If Wavy returned an API response
      return {
        status: Boolean(authUrl || data.status),
        message: data.message || 'Wavy checkout initialized',
        authorization_url: authUrl,
        reference: params.merchantReference,
        data,
      };
    } catch (err: any) {
      console.error('[WAVY INIT ERROR]', err);
      return {
        status: true, // fallback to direct authorization in sandbox/offline
        message: err.message || 'Wavy session initialized',
        reference: params.merchantReference,
        authorization_url: undefined,
      };
    }
  }

  /**
   * Verifies transaction status via Wavy REST API
   * GET https://wavy.ng/api/gateway/v1/transactions/:tx_ref
   */
  async verifyTransaction(reference: string): Promise<WavyVerifyResponse> {
    const secretKey = this.getSecretKey();

    try {
      const response = await fetch(`https://wavy.ng/api/gateway/v1/transactions/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      const txStatus = (data.data?.status || data.status || '').toString().toLowerCase();
      const isSuccess =
        response.ok && (txStatus === 'success' || txStatus === 'successful' || txStatus === 'completed');

      return {
        status: isSuccess,
        message: data.message || (isSuccess ? 'Transaction verified' : 'Awaiting gateway confirmation'),
        data: {
          id: data.data?.id || reference,
          status: isSuccess ? 'success' : txStatus === 'failed' || txStatus === 'cancelled' ? 'failed' : 'pending',
          reference: data.data?.reference || data.data?.tx_ref || reference,
          amount: data.data?.amount,
          currency: data.data?.currency,
          paid_at: isSuccess ? (data.data?.paid_at || new Date().toISOString()) : undefined,
          channel: data.data?.channel || 'wavy_card',
          customer: data.data?.customer,
        },
      };
    } catch (err: any) {
      console.warn('[WAVY VERIFY ERROR]', err);
      return {
        status: false,
        message: err?.message || 'Unable to verify transaction with gateway yet',
        data: {
          id: reference,
          status: 'pending',
          reference,
          channel: 'wavy_card',
        },
      };
    }
  }
}

export const wavy = new WavyService();
