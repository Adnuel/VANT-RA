/**
 * VANTÉRA Paystack Payment Integration Engine
 * Slogan: Technology, Elevated.
 *
 * Implements Paystack checkout for Nigerian Naira (NGN) and US Dollar (USD) cards,
 * bank transfers, USSD, and Apple Pay with real-time verification and webhook audit.
 */

import crypto from 'crypto';
import { db } from './db.ts';

export interface PaystackInitParams {
  email: string;
  amountKobo: number; // in Kobo for NGN or Cents for USD
  reference: string;
  currency?: 'NGN' | 'USD';
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    id: number;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    currency: string;
    paid_at: string;
    channel: string;
    card?: {
      last4: string;
      exp_month: string;
      exp_year: string;
      card_type: string;
      bank: string;
    };
    customer: {
      email: string;
      name?: string;
    };
  };
}

export class PaystackService {
  private getSecretKey(): string {
    const settings = db.getPaymentSettings();
    if (settings.paystackSecretKey && !settings.paystackSecretKey.includes('sample')) {
      return settings.paystackSecretKey;
    }
    return process.env.PAYSTACK_SECRET_KEY || 'sk_test_sample_vantera_key';
  }

  public getPublicKey(): string {
    const settings = db.getPaymentSettings();
    if (settings.paystackPublicKey && !settings.paystackPublicKey.includes('sample')) {
      return settings.paystackPublicKey;
    }
    return process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_sample_vantera_key';
  }

  public isTestMode(): boolean {
    const settings = db.getPaymentSettings();
    return settings.paystackTestMode || this.getSecretKey().startsWith('sk_test_');
  }

  /**
   * Initializes a transaction with Paystack API
   */
  async initializeTransaction(params: PaystackInitParams): Promise<PaystackInitResponse> {
    const secretKey = this.getSecretKey();
    const isMock = secretKey.includes('sample') || !secretKey.startsWith('sk_');

    if (isMock) {
      // Offline/Test-mode mock generator for verified local development
      const accessCode = `acc_${crypto.randomBytes(8).toString('hex')}`;
      return {
        status: true,
        message: 'Authorization URL created (development mode)',
        data: {
          authorization_url: `https://checkout.paystack.com/${accessCode}`,
          access_code: accessCode,
          reference: params.reference,
        },
      };
    }

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          amount: params.amountKobo,
          reference: params.reference,
          currency: params.currency || 'NGN',
          callback_url: params.callbackUrl,
          metadata: params.metadata,
        }),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('[PAYSTACK INIT ERROR]', err);
      return { status: false, message: err.message || 'Payment initialization failed' };
    }
  }

  /**
   * Verifies a transaction with Paystack API
   */
  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    const secretKey = this.getSecretKey();
    const isMock = secretKey.includes('sample') || !secretKey.startsWith('sk_');

    if (isMock) {
      // Simulated verified payment for test development
      return {
        status: true,
        message: 'Verification successful (development mode)',
        data: {
          id: Math.floor(Math.random() * 900000) + 100000,
          status: 'success',
          reference,
          amount: 100000,
          currency: 'NGN',
          paid_at: new Date().toISOString(),
          channel: 'card',
          card: {
            last4: '4081',
            exp_month: '12',
            exp_year: '28',
            card_type: 'visa',
            bank: 'Guaranty Trust Bank',
          },
          customer: {
            email: 'customer@vantera.luxury',
          },
        },
      };
    }

    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('[PAYSTACK VERIFY ERROR]', err);
      return { status: false, message: err.message || 'Verification failed' };
    }
  }

  /**
   * Validates Paystack webhook HMAC-SHA512 signature
   */
  validateWebhookSignature(payloadRaw: string, signature: string): boolean {
    const secretKey = this.getSecretKey();
    if (!signature || !secretKey) return false;
    const hash = crypto.createHmac('sha512', secretKey).update(payloadRaw).digest('hex');
    return hash === signature;
  }
}

export const paystack = new PaystackService();
