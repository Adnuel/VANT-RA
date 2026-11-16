import { convertUsdCentsToNgn } from './commerceLogic.ts';

export type CjPricingMode = 'markup_percent' | 'margin_percent' | 'fixed_cents';

export interface ProfitBreakdown {
  retailPriceCents: number;
  supplierCostCents: number | null;
  profitCents: number | null;
  marginPercent: number | null;
  markupPercent: number | null;
  retailNgn: number;
  supplierCostNgn: number | null;
  profitNgn: number | null;
  exchangeRate: number;
}

/**
 * Parses a CJ USD price field (e.g. "12.50", 12.5, "$8.99", "8.50 -- 14.20")
 * into integer USD cents without inventing default values.
 */
export function parseUsdPriceRangeCents(raw: string | number | null | undefined): {
  minCents: number | null;
  maxCents: number | null;
} {
  if (raw === null || raw === undefined) {
    return { minCents: null, maxCents: null };
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return { minCents: null, maxCents: null };
    const cents = Math.round(raw * 100);
    return { minCents: cents, maxCents: cents };
  }

  const text = String(raw).trim();
  if (!text) return { minCents: null, maxCents: null };

  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) {
    return { minCents: null, maxCents: null };
  }

  const parsed = matches
    .map((m) => Number(m))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .map((n) => Math.round(n * 100));

  if (parsed.length === 0) {
    return { minCents: null, maxCents: null };
  }

  const minCents = Math.min(...parsed);
  const maxCents = Math.max(...parsed);
  return { minCents, maxCents };
}

export function parseUsdPriceToCents(raw: string | number | null | undefined): number | null {
  return parseUsdPriceRangeCents(raw).minCents;
}

/**
 * Computes customer selling price in USD cents strictly from verified supplier cost
 * and CEO-configured pricing strategy. Never conflates supplier cost with retail price.
 */
export function calculateSellingPriceCents(
  supplierCostCents: number | null | undefined,
  mode: CjPricingMode,
  value: number
): number {
  if (mode === 'fixed_cents') {
    return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
  }

  const cost = typeof supplierCostCents === 'number' && Number.isFinite(supplierCostCents) && supplierCostCents > 0
    ? supplierCostCents
    : 0;

  if (cost <= 0) {
    return 0;
  }

  if (mode === 'markup_percent') {
    const safeMarkup = Math.max(0, Number.isFinite(value) ? value : 0);
    return Math.max(1, Math.round(cost * (1 + safeMarkup / 100)));
  }

  // margin_percent: Gross margin = (retail - cost) / retail
  const safeMargin = Math.min(95, Math.max(0, Number.isFinite(value) ? value : 0));
  return Math.max(1, Math.round(cost / (1 - safeMargin / 100)));
}

/**
 * Computes product-dependent retail pricing with a strict profit cap (default max 60% over supplier cost).
 * Smaller-ticket products receive up to the full 60% cap to absorb handling fees, while higher-ticket
 * hardware scales smoothly down so customer prices stay competitive and never exceed the cap.
 */
export function calculateProductDependentPricingCents(
  supplierCostCents: number | null | undefined,
  options: { category?: string | null; maxProfitPercent?: number } = {}
): {
  markupPercent: number;
  retailPriceCents: number;
  profitCents: number;
} {
  const cost =
    typeof supplierCostCents === 'number' && Number.isFinite(supplierCostCents) && supplierCostCents > 0
      ? Math.round(supplierCostCents)
      : 0;

  if (cost <= 0) {
    return { markupPercent: 0, retailPriceCents: 0, profitCents: 0 };
  }

  const maxCap = Math.min(60, Math.max(0, Number.isFinite(options.maxProfitPercent) ? Number(options.maxProfitPercent) : 60));

  let tierPercent = 20;
  if (cost <= 300) {
    // <= $3.00: up to 60% max profit
    tierPercent = 60;
  } else if (cost <= 1000) {
    // $3.01 - $10.00
    tierPercent = 50;
  } else if (cost <= 2500) {
    // $10.01 - $25.00
    tierPercent = 40;
  } else if (cost <= 6000) {
    // $25.01 - $60.00
    tierPercent = 30;
  } else {
    // > $60.00
    tierPercent = 20;
  }

  const normalizedCategory = String(options.category || '').toLowerCase();
  if (normalizedCategory === 'phones' || normalizedCategory === 'computer') {
    tierPercent = Math.max(15, tierPercent - 5);
  }

  const appliedPercent = Math.min(maxCap, tierPercent);
  // Strict floor on ceiling ensures profitCents / cost never rounds above maxCap even on odd cent values
  const maxAllowedRetail = cost + Math.floor((cost * maxCap) / 100);
  const targetRetail = Math.round(cost * (1 + appliedPercent / 100));
  const retailPriceCents = Math.min(maxAllowedRetail, Math.max(cost, targetRetail));
  const profitCents = Math.max(0, retailPriceCents - cost);
  const actualMarkupPercent = Number(((profitCents / cost) * 100).toFixed(1));

  return {
    markupPercent: Math.min(maxCap, actualMarkupPercent),
    retailPriceCents,
    profitCents,
  };
}

/**
 * Computes separate supplier cost, customer selling price, and net profit metrics
 * in both USD and NGN using a verified exchange rate.
 */
export function calculateProfitBreakdown(
  retailPriceCents: number,
  supplierCostCents: number | null | undefined,
  exchangeRate: number
): ProfitBreakdown {
  const safeRate = typeof exchangeRate === 'number' && Number.isFinite(exchangeRate) && exchangeRate > 0
    ? exchangeRate
    : 1500;
  const safeRetail = Math.max(0, Math.round(retailPriceCents || 0));
  const retailNgn = convertUsdCentsToNgn(safeRetail, safeRate);

  if (typeof supplierCostCents !== 'number' || !Number.isFinite(supplierCostCents) || supplierCostCents < 0) {
    return {
      retailPriceCents: safeRetail,
      supplierCostCents: null,
      profitCents: null,
      marginPercent: null,
      markupPercent: null,
      retailNgn,
      supplierCostNgn: null,
      profitNgn: null,
      exchangeRate: safeRate,
    };
  }

  const safeCost = Math.round(supplierCostCents);
  const profitCents = safeRetail - safeCost;
  const marginPercent = safeRetail > 0 ? Number(((profitCents / safeRetail) * 100).toFixed(1)) : 0;
  const markupPercent = safeCost > 0 ? Number(((profitCents / safeCost) * 100).toFixed(1)) : null;

  const supplierCostNgn = convertUsdCentsToNgn(safeCost, safeRate);
  const profitNgn = retailNgn - supplierCostNgn;

  return {
    retailPriceCents: safeRetail,
    supplierCostCents: safeCost,
    profitCents,
    marginPercent,
    markupPercent,
    retailNgn,
    supplierCostNgn,
    profitNgn,
    exchangeRate: safeRate,
  };
}

/**
 * Strips HTML markup from CJ rich product descriptions into readable plain text.
 */
export function stripHtmlDescription(rawHtml: string | null | undefined): string {
  if (!rawHtml) return '';
  return String(rawHtml)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/?(p|div|br|li|tr|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Suggests the closest existing VANTÉRA storefront category based on CJ metadata.
 */
export function suggestVanteraCategory(cjCategoryName?: string | null, title?: string | null): string {
  const haystack = `${cjCategoryName || ''} ${title || ''}`.toLowerCase();
  if (/case|screen protector|tempered glass|bumper|cover|shield/.test(haystack)) {
    return 'phone-cases';
  }
  if (/charg|magsafe|power bank|cable|adapter|wireless charger|dock|usb-c|gan/.test(haystack)) {
    return 'charging';
  }
  if (/earbud|headphone|speaker|audio|mic|sound|anc|earphone/.test(haystack)) {
    return 'audio';
  }
  if (/tripod|gimbal|camera|lens|selfie|ring light|vlog|stabilizer|shutter/.test(haystack)) {
    return 'photography';
  }
  if (/laptop|mouse|keyboard|hub|usb hub|ssd|monitor|computer|webcam/.test(haystack)) {
    return 'computer';
  }
  if (/smartphone|mobile phone|iphone|android phone/.test(haystack) && !/case|holder|stand|mount|charger/.test(haystack)) {
    return 'phones';
  }
  return 'room-desk';
}

/**
 * Extracts color & size labels from CJ variantKey / variantProperty metadata cleanly.
 */
export function parseVariantAttributes(
  variantKey?: string | null,
  variantNameEn?: string | null,
  variantStandard?: string | null
): { label: string; color?: string; size?: string } {
  const raw = String(variantKey || variantNameEn || variantStandard || '').trim();
  if (!raw) {
    return { label: 'Standard Edition' };
  }
  const parts = raw
    .split(/[-/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    const token = parts[0];
    if (/^(xs|s|m|l|xl|xxl|xxxl|\d+(cm|mm|m|w|mah|gb|tb|inch|in))$/i.test(token)) {
      return { label: token, size: token };
    }
    return { label: token, color: token };
  }

  return {
    label: parts.join(' · '),
    color: parts[0],
    size: parts.slice(1).join(' / '),
  };
}
