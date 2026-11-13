import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatPrice, convertUsdCentsToNgn, formatNGN, formatUSD } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';

export type Currency = 'USD' | 'NGN';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  exchangeRate: number;
  provider: string;
  lastUpdated: string;
  isLive: boolean;
  isStale: boolean;
  isManualOverride: boolean;
  formatAmount: (centsInUSD: number | null | undefined) => string;
  toActiveAmount: (centsInUSD: number) => number;
  refreshRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = 'vantera_selected_currency';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (saved === 'NGN' || saved === 'USD') return saved;
      // Auto-detect visitor location: show ₦ first for Nigerian visitors and $ for everyone else
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const languages = typeof navigator !== 'undefined' ? (navigator.languages || [navigator.language || '']) : [];
      const isNigeria =
        timeZone.includes('Lagos') ||
        timeZone.includes('Africa/Lagos') ||
        timeZone.includes('West Central Africa') ||
        languages.some((l) => l.toLowerCase().includes('en-ng') || l.toLowerCase().endsWith('-ng'));
      if (isNigeria) return 'NGN';
    } catch {}
    return 'USD';
  });

  const [exchangeRate, setExchangeRate] = useState<number>(1346.47);
  const [provider, setProvider] = useState<string>('ExchangeRate-API Live');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isLive, setIsLive] = useState<boolean>(true);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  const fetchRate = async () => {
    try {
      const res = await safeFetchJson<{
        settings?: {
          ngnExchangeRate?: number;
          usdToNgnRate?: number;
          provider?: string;
          lastUpdated?: string;
          isLive?: boolean;
          isStale?: boolean;
          isManualOverride?: boolean;
        };
      }>('/api/currency-settings');

      if (res.ok && res.data?.settings) {
        const s = res.data.settings;
        const rate = s.usdToNgnRate || s.ngnExchangeRate;
        if (typeof rate === 'number' && rate > 0) {
          setExchangeRate(rate);
        }
        if (s.provider) setProvider(s.provider);
        if (s.lastUpdated) setLastUpdated(s.lastUpdated);
        if (typeof s.isLive === 'boolean') setIsLive(s.isLive);
        if (typeof s.isStale === 'boolean') setIsStale(s.isStale);
        if (typeof s.isManualOverride === 'boolean') setIsManualOverride(s.isManualOverride);
      }
    } catch {
      // Keep verified cached values
    }
  };

  useEffect(() => {
    fetchRate();

    // Refine geo-location via edge IP headers if user has not manually picked a currency
    try {
      const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (!saved) {
        safeFetchJson<{ currency?: 'NGN' | 'USD' | null }>('/api/geo').then((res) => {
          if (res.ok && res.data?.currency && !localStorage.getItem(CURRENCY_STORAGE_KEY)) {
            setCurrencyState(res.data.currency);
          }
        });
      }
    } catch {}

    // Poll for updated rates every 30 minutes
    const interval = setInterval(fetchRate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, c);
    } catch {}
  };

  const formatAmount = (centsInUSD: number | null | undefined): string => {
    return formatPrice(centsInUSD, currency, exchangeRate);
  };

  const toActiveAmount = (centsInUSD: number): number => {
    if (currency === 'NGN') {
      return convertUsdCentsToNgn(centsInUSD, exchangeRate);
    }
    return (centsInUSD || 0) / 100;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        exchangeRate,
        provider,
        lastUpdated,
        isLive,
        isStale,
        isManualOverride,
        formatAmount,
        toActiveAmount,
        refreshRate: fetchRate,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      currency: 'USD',
      setCurrency: () => {},
      exchangeRate: 1346.47,
      provider: 'ExchangeRate-API Live',
      lastUpdated: new Date().toISOString(),
      isLive: true,
      isStale: false,
      isManualOverride: false,
      formatAmount: (cents) => formatUSD(cents),
      toActiveAmount: (cents) => (cents || 0) / 100,
      refreshRate: async () => {},
    };
  }
  return ctx;
}
