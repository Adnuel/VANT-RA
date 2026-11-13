/**
 * VANTÉRA Real-Time Foreign Exchange Engine
 * Slogan: Technology, Elevated.
 *
 * Connects to live foreign exchange rate APIs for verified USD/NGN rates.
 * Supports automated caching, stale rate detection, and CEO audit logging.
 */

import { db } from './db.ts';

export interface ExchangeRateData {
  rate: number;
  usdToNgnRate: number;
  ngnToUsdRate: number;
  provider: string;
  lastUpdated: string;
  isLive: boolean;
  isStale: boolean;
  isManualOverride: boolean;
  manualOverrideBy?: string | null;
  manualOverrideReason?: string | null;
  overrideReason?: string | null;
  freshnessLimitHours: number;
}

const PRIMARY_API_URL = 'https://open.er-api.com/v6/latest/USD';
const FALLBACK_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour memory cache
const FRESHNESS_LIMIT_HOURS = 24;

let memoryCache: ExchangeRateData | null = null;
let lastFetchTime = 0;

export async function fetchLiveExchangeRate(): Promise<ExchangeRateData> {
  // Check if manual override exists in database
  const stored = db.getCurrencySettings();
  if (stored && (stored as any).isManualOverride) {
    const rate = stored.ngnExchangeRate || 1350;
    return {
      rate,
      usdToNgnRate: rate,
      ngnToUsdRate: Number((1 / rate).toFixed(8)),
      provider: 'CEO Manual Override',
      lastUpdated: stored.lastUpdated || new Date().toISOString(),
      isLive: false,
      isStale: false,
      isManualOverride: true,
      manualOverrideBy: (stored as any).manualOverrideBy || 'CEO Adnuel',
      manualOverrideReason: (stored as any).manualOverrideReason || 'Verified executive rate',
      overrideReason: (stored as any).manualOverrideReason || (stored as any).overrideReason || 'Verified executive rate',
      freshnessLimitHours: FRESHNESS_LIMIT_HOURS,
    };
  }

  // Return fresh memory cache if available
  const now = Date.now();
  if (memoryCache && now - lastFetchTime < CACHE_TTL_MS && memoryCache.usdToNgnRate > 0) {
    return memoryCache;
  }

  // Try Primary API
  try {
    const res = await fetch(PRIMARY_API_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const ngn = data.rates?.NGN;
      if (typeof ngn === 'number' && ngn > 100) {
        const result: ExchangeRateData = {
          rate: Number(ngn.toFixed(2)),
          usdToNgnRate: Number(ngn.toFixed(2)),
          ngnToUsdRate: Number((1 / ngn).toFixed(8)),
          provider: data.provider || 'ExchangeRate-API',
          lastUpdated: new Date().toISOString(),
          isLive: true,
          isStale: false,
          isManualOverride: false,
          freshnessLimitHours: FRESHNESS_LIMIT_HOURS,
        };

        memoryCache = result;
        lastFetchTime = now;
        db.updateCurrencySettings(
          {
            ngnExchangeRate: result.usdToNgnRate,
            lastUpdated: result.lastUpdated,
            defaultCurrency: stored.defaultCurrency || 'NGN',
            enableNgn: true,
            enableUsd: true,
          },
          'SYSTEM_FX_CRON'
        );
        return result;
      }
    }
  } catch (err: any) {
    console.warn('[FX Engine] Primary exchange rate API unreachable:', err.message);
  }

  // Try Fallback API
  try {
    const res = await fetch(FALLBACK_API_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const ngn = data.rates?.NGN;
      if (typeof ngn === 'number' && ngn > 100) {
        const result: ExchangeRateData = {
          rate: Number(ngn.toFixed(2)),
          usdToNgnRate: Number(ngn.toFixed(2)),
          ngnToUsdRate: Number((1 / ngn).toFixed(8)),
          provider: 'ExchangeRate-API',
          lastUpdated: new Date().toISOString(),
          isLive: true,
          isStale: false,
          isManualOverride: false,
          freshnessLimitHours: FRESHNESS_LIMIT_HOURS,
        };

        memoryCache = result;
        lastFetchTime = now;
        db.updateCurrencySettings(
          {
            ngnExchangeRate: result.usdToNgnRate,
            lastUpdated: result.lastUpdated,
            defaultCurrency: stored.defaultCurrency || 'NGN',
            enableNgn: true,
            enableUsd: true,
          },
          'SYSTEM_FX_CRON'
        );
        return result;
      }
    }
  } catch (err: any) {
    console.warn('[FX Engine] Fallback exchange rate API unreachable:', err.message);
  }

  // Return last verified stored rate
  const fallbackRate = stored.ngnExchangeRate || 1350;
  const lastUpdateMs = stored.lastUpdated ? new Date(stored.lastUpdated).getTime() : 0;
  const ageHours = (now - lastUpdateMs) / (1000 * 60 * 60);
  const isStale = ageHours > FRESHNESS_LIMIT_HOURS;

  return {
    rate: fallbackRate,
    usdToNgnRate: fallbackRate,
    ngnToUsdRate: Number((1 / fallbackRate).toFixed(8)),
    provider: (stored as any).provider || 'ExchangeRate-API',
    lastUpdated: stored.lastUpdated || new Date().toISOString(),
    isLive: false,
    isStale,
    isManualOverride: Boolean((stored as any).isManualOverride),
    freshnessLimitHours: FRESHNESS_LIMIT_HOURS,
  };
}

export function setManualRateOverride(
  rate: number,
  actor: string = 'CEO Adnuel',
  reason: string = 'Verified executive rate'
): ExchangeRateData {
  if (rate <= 0 || isNaN(rate)) {
    throw new Error('Exchange rate must be a positive number');
  }

  const updatedSettings = {
    ngnExchangeRate: rate,
    lastUpdated: new Date().toISOString(),
    isManualOverride: true,
    manualOverrideBy: actor,
    manualOverrideReason: reason,
    provider: 'CEO Manual Override',
  };

  db.updateCurrencySettings(updatedSettings as any, actor);

  const result: ExchangeRateData = {
    rate,
    usdToNgnRate: rate,
    ngnToUsdRate: Number((1 / rate).toFixed(8)),
    provider: 'CEO Manual Override',
    lastUpdated: updatedSettings.lastUpdated,
    isLive: false,
    isStale: false,
    isManualOverride: true,
    manualOverrideBy: actor,
    manualOverrideReason: reason,
    overrideReason: reason,
    freshnessLimitHours: FRESHNESS_LIMIT_HOURS,
  };

  memoryCache = result;
  lastFetchTime = Date.now();
  return result;
}

export function clearManualRateOverride(actor: string = 'CEO Adnuel'): any {
  const current = db.getCurrencySettings();
  db.updateCurrencySettings(
    {
      ...current,
      isManualOverride: false,
      manualOverrideBy: null,
      manualOverrideReason: null,
      provider: 'ExchangeRate-API',
      lastUpdated: new Date().toISOString(),
    } as any,
    actor
  );

  memoryCache = null;
  lastFetchTime = 0;
  const syncResult: ExchangeRateData = {
    rate: current.ngnExchangeRate || 1350,
    usdToNgnRate: current.ngnExchangeRate || 1350,
    ngnToUsdRate: Number((1 / (current.ngnExchangeRate || 1350)).toFixed(8)),
    provider: 'ExchangeRate-API',
    lastUpdated: new Date().toISOString(),
    isLive: true,
    isStale: false,
    isManualOverride: false,
    freshnessLimitHours: FRESHNESS_LIMIT_HOURS,
  };

  const promise = Promise.resolve(syncResult);
  Object.assign(promise, syncResult);
  return promise;
}
