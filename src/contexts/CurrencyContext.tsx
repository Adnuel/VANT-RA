import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatPrice, convertUsdCentsToNgn, formatNGN, formatUSD } from '../lib/commerceLogic.ts';

export type Currency = 'USD' | 'NGN';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  exchangeRate: number;
  formatAmount: (centsInUSD: number | null | undefined) => string;
  toActiveAmount: (centsInUSD: number) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const CURRENCY_STORAGE_KEY = 'vantera_selected_currency';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (saved === 'NGN' || saved === 'USD') return saved;
    } catch {}
    return 'USD';
  });

  const [exchangeRate, setExchangeRate] = useState<number>(1500);

  // Fetch verified exchange rate from backend
  useEffect(() => {
    fetch('/api/currency-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings?.ngnExchangeRate) {
          setExchangeRate(data.settings.ngnExchangeRate);
        }
      })
      .catch(() => {
        // Fallback default 1500
      });
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
        formatAmount,
        toActiveAmount,
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
      exchangeRate: 1500,
      formatAmount: (cents) => formatUSD(cents),
      toActiveAmount: (cents) => (cents || 0) / 100,
    };
  }
  return ctx;
}
