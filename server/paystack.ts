/**
 * VANTÉRA Payment Gateway Connector
 * Defaults to Wavy Gateway (wavy.ng) while maintaining backward-compatible interface.
 */

import crypto from 'crypto';
import { wavy, WavyCheckoutParams } from './wavy.ts';

export interface PaystackInitParams {
  email: string;
  amountKobo: number;
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
    id: number | string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    currency: string;
    paid_at: string;
    channel: string;
  };
}

export class PaystackService {
  public getSecretKey(): string {
    return wavy.getSecretKey();
  }

  public getPublicKey(): string {
    return wavy.getPublicKey();
  }

  public isTestMode(): boolean {
    return wavy.isTestMode();
  }

  async initializeTransaction(params: PaystackInitParams): Promise<PaystackInitResponse> {
    const amount = (params.amountKobo || 0) / 100;
    const wavyRes = await wavy.initializeCheckout({
      email: params.email,
      amount: amount > 0 ? amount : 100,
      currency: params.currency || 'NGN',
      description: `VANTÉRA Order #${params.reference}`,
      merchantReference: params.reference,
      callbackUrl: params.callbackUrl,
    });

    return {
      status: wavyRes.status,
      message: wavyRes.message || 'Payment initialized via Wavy',
      data: {
        authorization_url: wavyRes.authorization_url || wavyRes.data?.authorization_url || '',
        access_code: params.reference,
        reference: params.reference,
      },
    };
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    const wavyRes = await wavy.verifyTransaction(reference);
    return {
      status: wavyRes.status,
      message: wavyRes.message || 'Transaction verified',
      data: {
        id: wavyRes.data?.id || reference,
        status: wavyRes.status ? 'success' : 'failed',
        reference: wavyRes.data?.reference || reference,
        amount: (wavyRes.data?.amount || 0) * 100,
        currency: wavyRes.data?.currency || 'NGN',
        paid_at: wavyRes.data?.paid_at || new Date().toISOString(),
        channel: wavyRes.data?.channel || 'wavy_card',
      },
    };
  }

  validateWebhookSignature(payloadRaw: string, signature: string): boolean {
    if (!signature || !payloadRaw) return false;
    try {
      const secret = this.getSecretKey();
      const sha512 = crypto.createHmac('sha512', secret).update(payloadRaw).digest('hex');
      const sha256 = crypto.createHmac('sha256', secret).update(payloadRaw).digest('hex');
      const cleanSig = signature.trim().toLowerCase();
      if (cleanSig.length === sha512.length && crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(sha512))) {
        return true;
      }
      if (cleanSig.length === sha256.length && crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(sha256))) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const paystack = new PaystackService();
