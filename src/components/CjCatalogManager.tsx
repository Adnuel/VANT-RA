import React, { useState, useMemo } from 'react';
import { CATEGORIES, type Product } from '../data/catalog.ts';
import { formatUSD, formatNGN, convertUsdCentsToNgn } from '../lib/commerceLogic.ts';
import {
  calculateSellingPriceCents,
  calculateProfitBreakdown,
  type CjPricingMode,
} from '../lib/cjPricing.ts';
import { CURATED_CATEGORIES } from '../lib/curatedCjCatalog.ts';

interface CjWarehouseInventoryItem {
  countryCode: string;
  areaEn: string;
  totalInventory: number;
  cjInventory: number;
  factoryInventory: number;
}

interface CjSearchProduct {
  pid: string;
  productNameEn: string;
  productSku: string;
  spu: string;
  categoryId: string | null;
  categoryName: string | null;
  productImage: string | null;
  sellPriceRaw: string | null;
  supplierPriceCents: number | null;
  supplierPriceMaxCents: number | null;
  supplierPriceNgn: number | null;
  supplierPriceMaxNgn: number | null;
  warehouseInventoryNum: number | null;
  listedNum: number | null;
  alreadyImported?: boolean;
  importedProductId?: string | null;
  importedProductSlug?: string | null;
}

interface CjVariantDetail {
  vid: string;
  pid: string;
  variantNameEn: string;
  variantSku: string;
  variantKey: string;
  label: string;
  color?: string;
  size?: string;
  variantImage: string | null;
  supplierPriceCents: number | null;
  supplierPriceNgn: number | null;
  variantSellPriceRaw: string | null;
  variantStandard: string | null;
  weightGrams: number | null;
  stockQuantity: number | null;
  warehouseStock: CjWarehouseInventoryItem[];
}

interface CjProductDetail {
  pid: string;
  productNameEn: string;
  productSku: string;
  spu: string;
  categoryId: string | null;
  categoryName: string | null;
  description: string;
  productImage: string | null;
  productImageSet: string[];
  sellPriceRaw: string | null;
  supplierPriceCents: number | null;
  supplierPriceMaxCents: number | null;
  supplierPriceNgn: number | null;
  supplierPriceMaxNgn: number | null;
  productWeightGrams: number | null;
  materialNameEn: string | null;
  packingNameEn: string | null;
  entryCode: string | null;
  specs: Array<{ label: string; value: string }>;
  variants: CjVariantDetail[];
  warehouseStock: CjWarehouseInventoryItem[];
  totalInventory: number | null;
  inventorySynced: boolean;
  inventoryNote?: string;
  retrievedAt: string;
}

interface CjFreightOption {
  logisticName: string;
  logisticAging: string;
  logisticPriceCents: number;
  logisticPriceNgn: number;
  taxesFeeCents: number;
  clearanceOperationFeeCents: number;
  totalPostageFeeCents: number;
  totalPostageFeeNgn: number;
  channelType: string | null;
}

interface FxMeta {
  usdToNgnRate: number;
  provider: string;
  lastUpdated: string;
}

interface CjCatalogManagerProps {
  adminToken: string | null;
  existingProducts: Product[];
  onCatalogUpdated: () => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const DESTINATION_COUNTRIES = [
  { code: 'NG', label: 'Nigeria (NG)' },
  { code: 'US', label: 'United States (US)' },
  { code: 'GB', label: 'United Kingdom (GB)' },
  { code: 'CA', label: 'Canada (CA)' },
  { code: 'DE', label: 'Germany (DE)' },
  { code: 'AE', label: 'United Arab Emirates (AE)' },
  { code: 'GH', label: 'Ghana (GH)' },
  { code: 'ZA', label: 'South Africa (ZA)' },
];

export const CjCatalogManager: React.FC<CjCatalogManagerProps> = ({
  adminToken,
  existingProducts,
  onCatalogUpdated,
  onShowToast,
}) => {
  // Search state
  const [keyword, setKeyword] = useState('');
  const [warehouseCountry, setWarehouseCountry] = useState('');
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [searchResults, setSearchResults] = useState<CjSearchProduct[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [fxMeta, setFxMeta] = useState<FxMeta>({
    usdToNgnRate: 1500,
    provider: 'ExchangeRate-API',
    lastUpdated: new Date().toISOString(),
  });

  // Inventory batch sync state
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncSummary, setSyncSummary] = useState<{
    syncedCount: number;
    failedCount: number;
    results: Array<{ productId: string; title: string; success: boolean; stockQuantity?: number; error?: string }>;
  } | null>(null);

  // One-Click Curated Bulk Import (Max 60% Profit, Strictly CEO's 5 Curated Categories) state
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkImportProgress, setBulkImportProgress] = useState<string | null>(null);
  const [bulkImportSummary, setBulkImportSummary] = useState<{
    importedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    maxProfitPercent: number;
    items: Array<{
      cjPid: string;
      productId: string;
      title: string;
      category?: string;
      curatedType?: string;
      created: boolean;
      appliedProfitPercent: number;
      supplierCostCents: number;
      retailPriceCents: number;
      retailNgn: number;
      stockQuantity: number;
      variantCount: number;
    }>;
    errors: Array<{ cjPid: string; reason: string }>;
  } | null>(null);

  // Preview / Detail / Import modal state
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<CjProductDetail | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);
  const [selectedVariantVids, setSelectedVariantVids] = useState<Record<string, boolean>>({});

  // Editable VANTÉRA listing & pricing state
  const [importTitle, setImportTitle] = useState('');
  const [importCategory, setImportCategory] = useState('premium-tech-accessories');
  const [importDescription, setImportDescription] = useState('');
  const [importTrending, setImportTrending] = useState(false);
  const [pricingMode, setPricingMode] = useState<CjPricingMode>('markup_percent');
  const [pricingValue, setPricingValue] = useState('80');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Live CJ freight calculator state inside preview
  const [freightCountry, setFreightCountry] = useState('NG');
  const [freightVid, setFreightVid] = useState('');
  const [freightQuantity, setFreightQuantity] = useState(1);
  const [freightZip, setFreightZip] = useState('');
  const [isCalculatingFreight, setIsCalculatingFreight] = useState(false);
  const [freightError, setFreightError] = useState<string | null>(null);
  const [freightOptions, setFreightOptions] = useState<CjFreightOption[] | null>(null);

  const importedCjProducts = useMemo(
    () => existingProducts.filter((p) => Boolean(p.cjPid)),
    [existingProducts]
  );

  const importedPidSet = useMemo(
    () => new Set(importedCjProducts.map((p) => p.cjPid!)),
    [importedCjProducts]
  );

  const runSearch = async (targetPage = 1) => {
    if (!adminToken) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const qs = new URLSearchParams({
        page: String(targetPage),
        size: '12',
      });
      if (keyword.trim()) qs.set('keyword', keyword.trim());
      if (warehouseCountry) qs.set('countryCode', warehouseCountry);

      const res = await fetch(`/api/admin/suppliers/cj/products/search?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `CJ catalogue search failed (HTTP ${res.status}).`);
      }

      setSearchResults(Array.isArray(data?.products) ? data.products : []);
      setTotalResults(typeof data?.total === 'number' ? data.total : 0);
      setPage(targetPage);
      if (data?.fx) setFxMeta(data.fx);
    } catch (err: any) {
      setSearchError(err?.message || 'Unable to query CJ product catalogue.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(1);
  };

  const openProductPreview = async (pid: string) => {
    if (!adminToken) return;
    setIsLoadingDetail(true);
    setDetailError(null);
    setImportError(null);
    setFreightOptions(null);
    setFreightError(null);
    setActiveDetail(null);

    try {
      const qs = new URLSearchParams({ pid });
      if (warehouseCountry) qs.set('countryCode', warehouseCountry);

      const res = await fetch(`/api/admin/suppliers/cj/products/detail?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.product) {
        throw new Error(data?.error || `Failed to load product details (HTTP ${res.status}).`);
      }

      const detail: CjProductDetail = data.product;
      const existing: Product | null = data.existingProduct || null;
      if (data.fx) setFxMeta(data.fx);

      setActiveDetail(detail);
      setActivePreviewImage(detail.productImage || detail.productImageSet?.[0] || null);

      setImportTitle(existing?.title || detail.productNameEn);
      setImportCategory(existing?.category || data.suggestedCategory || 'premium-tech-accessories');
      setImportDescription(existing?.description || detail.description);
      setImportTrending(Boolean(existing?.trending));

      if (existing?.pricingConfig) {
        setPricingMode(existing.pricingConfig.mode);
        setPricingValue(
          existing.pricingConfig.mode === 'fixed_cents'
            ? (existing.pricingConfig.value / 100).toFixed(2)
            : String(existing.pricingConfig.value)
        );
      } else {
        setPricingMode('markup_percent');
        setPricingValue('80');
      }

      const existingVids = new Set((existing?.variants || []).map((v) => v.cjVid).filter(Boolean));
      const initialSelections: Record<string, boolean> = {};
      for (const v of detail.variants) {
        if (existing && existingVids.size > 0) {
          initialSelections[v.vid] = existingVids.has(v.vid);
        } else {
          // Select variants in stock by default (or all if CJ didn't return per-variant inventory)
          initialSelections[v.vid] = v.stockQuantity === null ? true : v.stockQuantity > 0;
        }
      }
      // If all variants had 0 stock, allow CEO to still view them unchecked cleanly (or select first for inspection)
      setSelectedVariantVids(initialSelections);

      const defaultFreightVariant =
        detail.variants.find((v) => v.vid && (v.stockQuantity ?? 1) > 0) || detail.variants[0];
      setFreightVid(defaultFreightVariant?.vid || '');
    } catch (err: any) {
      setDetailError(err?.message || 'Unable to load CJ product details.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const closeModal = () => {
    setActiveDetail(null);
    setDetailError(null);
    setImportError(null);
    setFreightOptions(null);
    setFreightError(null);
  };

  const handleCalculateFreight = async () => {
    if (!adminToken || !freightVid) {
      setFreightError('Select a variant with a valid CJ Variant ID (VID) first.');
      return;
    }
    setIsCalculatingFreight(true);
    setFreightError(null);
    setFreightOptions(null);

    try {
      const res = await fetch('/api/admin/suppliers/cj/freight/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          startCountryCode: 'CN',
          endCountryCode: freightCountry,
          products: [{ vid: freightVid, quantity: Math.max(1, freightQuantity) }],
          zip: freightZip.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'CJ shipping calculation failed.');
      }
      if (data?.fx) setFxMeta(data.fx);
      setFreightOptions(Array.isArray(data?.options) ? data.options : []);
    } catch (err: any) {
      setFreightError(err?.message || 'Unable to retrieve CJ shipping rates.');
    } finally {
      setIsCalculatingFreight(false);
    }
  };

  const getPricingNumericValue = (): number => {
    const parsed = Number(pricingValue);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return pricingMode === 'fixed_cents' ? Math.round(parsed * 100) : parsed;
  };

  const sampleSupplierCostCents = useMemo(() => {
    if (!activeDetail) return null;
    const selectedCosts = activeDetail.variants
      .filter((v) => selectedVariantVids[v.vid] && typeof v.supplierPriceCents === 'number')
      .map((v) => v.supplierPriceCents as number);
    if (selectedCosts.length > 0) return Math.min(...selectedCosts);
    return activeDetail.supplierPriceCents;
  }, [activeDetail, selectedVariantVids]);

  const sampleSellingCents = useMemo(() => {
    const val = getPricingNumericValue();
    return calculateSellingPriceCents(sampleSupplierCostCents, pricingMode, val);
  }, [sampleSupplierCostCents, pricingMode, pricingValue]);

  const sampleProfit = useMemo(
    () => calculateProfitBreakdown(sampleSellingCents, sampleSupplierCostCents, fxMeta.usdToNgnRate),
    [sampleSellingCents, sampleSupplierCostCents, fxMeta.usdToNgnRate]
  );

  const selectedVariantsCount = useMemo(() => {
    if (!activeDetail) return 0;
    return activeDetail.variants.filter((v) => selectedVariantVids[v.vid]).length;
  }, [activeDetail, selectedVariantVids]);

  const handleImportProduct = async () => {
    if (!adminToken || !activeDetail) return;
    setImportError(null);

    if (!importTitle.trim()) {
      setImportError('Please provide a VANTÉRA storefront product title.');
      return;
    }

    if (activeDetail.variants.length > 0 && selectedVariantsCount === 0) {
      setImportError('Select at least one variant to import into the VANTÉRA catalogue.');
      return;
    }

    const numericPricingVal = getPricingNumericValue();
    if (pricingMode === 'fixed_cents' && numericPricingVal <= 0) {
      setImportError('Fixed USD retail price must be greater than $0.00.');
      return;
    }

    setIsImporting(true);
    try {
      const variantsPayload = activeDetail.variants.map((v) => ({
        vid: v.vid,
        sku: v.variantSku,
        name: v.label,
        color: v.color,
        size: v.size,
        variantKey: v.variantKey,
        image: v.variantImage,
        supplierCostCents: v.supplierPriceCents,
        stockQuantity: v.stockQuantity ?? 0,
        selected: Boolean(selectedVariantVids[v.vid]),
      }));

      const res = await fetch('/api/admin/suppliers/cj/products/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          cjPid: activeDetail.pid,
          cjProductSku: activeDetail.productSku,
          cjCategoryName: activeDetail.categoryName,
          title: importTitle.trim(),
          category: importCategory,
          description: importDescription.trim() || activeDetail.description,
          image: activePreviewImage || activeDetail.productImage,
          galleryImages: activeDetail.productImageSet,
          cjSpecs: activeDetail.specs,
          pricingMode,
          pricingValue: numericPricingVal,
          trending: importTrending,
          variants: variantsPayload,
          fallbackSupplierCostCents: activeDetail.supplierPriceCents,
          fallbackStockQuantity: activeDetail.totalInventory ?? 0,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.product) {
        throw new Error(data?.error || 'Failed to import CJ product.');
      }

      onShowToast(
        `${data.created ? 'Imported' : 'Updated'} "${data.product.title}" in VANTÉRA catalogue.`,
        'success'
      );
      window.dispatchEvent(new CustomEvent('vantera:catalog-updated'));
      onCatalogUpdated();
      closeModal();
    } catch (err: any) {
      setImportError(err?.message || 'Unable to import product.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBulkImportAll = async (onlyCategoryId?: string) => {
    if (!adminToken || isBulkImporting) return;
    setIsBulkImporting(true);
    setBulkImportSummary(null);
    setSearchError(null);

    const targetCategories = onlyCategoryId
      ? CURATED_CATEGORIES.filter((c) => c.id === onlyCategoryId)
      : CURATED_CATEGORIES;

    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const allItems: any[] = [];
    const allErrors: Array<{ cjPid: string; reason: string }> = [];

    try {
      for (let idx = 0; idx < targetCategories.length; idx++) {
        const cat = targetCategories[idx];
        setBulkImportProgress(
          `Importing (${idx + 1}/${targetCategories.length}): ${cat.label}...`
        );

        const res = await fetch('/api/admin/suppliers/cj/products/bulk-import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            curatedCategoryId: cat.id,
            maxProfitPercent: 60,
            countryCode: warehouseCountry || undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          allErrors.push({
            cjPid: cat.label,
            reason: data?.error || `HTTP ${res.status}`,
          });
          continue;
        }

        totalImported += data.importedCount ?? 0;
        totalUpdated += data.updatedCount ?? 0;
        totalSkipped += data.skippedCount ?? 0;
        totalFailed += data.failedCount ?? 0;
        if (Array.isArray(data.items)) allItems.push(...data.items);
        if (Array.isArray(data.errors)) allErrors.push(...data.errors);

        setBulkImportSummary({
          importedCount: totalImported,
          updatedCount: totalUpdated,
          skippedCount: totalSkipped,
          failedCount: totalFailed,
          maxProfitPercent: 60,
          items: allItems,
          errors: allErrors,
        });

        window.dispatchEvent(new CustomEvent('vantera:catalog-updated'));
        onCatalogUpdated();
      }

      const totalProcessed = totalImported + totalUpdated;
      onShowToast(
        `Curated Import complete: ${totalImported} new, ${totalUpdated} updated across ${targetCategories.length} categories (max 60% profit cap).`,
        totalProcessed > 0 ? 'success' : 'info'
      );

      if (searchResults.length > 0) {
        runSearch(page);
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Unable to bulk import curated CJ products.', 'error');
    } finally {
      setBulkImportProgress(null);
      setIsBulkImporting(false);
    }
  };

  const handleSyncAllInventory = async () => {
    if (!adminToken || importedCjProducts.length === 0) return;
    setIsSyncingAll(true);
    setSyncSummary(null);

    try {
      const res = await fetch('/api/admin/suppliers/cj/inventory/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'CJ inventory synchronization failed.');
      }
      setSyncSummary({
        syncedCount: data.syncedCount ?? 0,
        failedCount: data.failedCount ?? 0,
        results: Array.isArray(data.results) ? data.results : [],
      });
      onShowToast(
        `CJ inventory sync finished: ${data.syncedCount} updated, ${data.failedCount} failed.`,
        data.failedCount === 0 ? 'success' : 'info'
      );
      window.dispatchEvent(new CustomEvent('vantera:catalog-updated'));
      onCatalogUpdated();
    } catch (err: any) {
      onShowToast(err?.message || 'Inventory sync error.', 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  return (
    <div className="bg-white border border-[#e7e4de] p-6 space-y-6 shadow-xs">
      {/* Header & Inventory Sync Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e7e4de] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="font-serif text-lg font-bold text-[#121210]">
              CJdropshipping Live Product Catalogue
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-[#f8f7f4] border border-[#e7e4de] text-[#77746d]">
              FX: 1 USD = ₦{fxMeta.usdToNgnRate.toLocaleString()}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-[#eef8ee] text-[#1e7e34]">
              {importedCjProducts.length} Imported in Catalogue
            </span>
          </div>
          <p className="text-xs text-[#77746d]">
            Search CJ&apos;s live supplier database or run One-Click Curated Import to import only your 5 approved VANTÉRA categories &amp; product types (capped at max 60% profit).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleBulkImportAll()}
            disabled={isBulkImporting || isSearching}
            className="bg-[#121210] text-[#f8f7f4] px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isBulkImporting
              ? bulkImportProgress || 'Importing Curated Collection...'
              : 'One-Click Import Curated Collection · Max 60% Profit'}
          </button>

          <button
            type="button"
            onClick={handleSyncAllInventory}
            disabled={isSyncingAll || importedCjProducts.length === 0}
            className="border border-[#121210] text-[#121210] px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider hover:bg-[#121210] hover:text-[#f8f7f4] transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isSyncingAll
              ? `Syncing ${importedCjProducts.length} CJ Items...`
              : `Sync CJ Inventory (${importedCjProducts.length})`}
          </button>
        </div>
      </div>

      {/* Per-Category Quick Curated Import Bar */}
      <div className="bg-[#f8f7f4] border border-[#e7e4de] p-3.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase text-[#77746d]">
          <span>Curated 5-Category Collection Import (Imports only approved VANTÉRA product types):</span>
          {bulkImportProgress && <span className="text-[#121210] font-semibold">{bulkImportProgress}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {CURATED_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              disabled={isBulkImporting || isSearching}
              onClick={() => handleBulkImportAll(cat.id)}
              className="border border-[#e7e4de] bg-white hover:border-[#121210] text-[#121210] px-3 py-1.5 text-[11px] font-mono transition-colors disabled:opacity-50 cursor-pointer"
            >
              + Import {cat.label} ({cat.items.length} types)
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Import Summary Banner */}
      {bulkImportSummary && (
        <div className="bg-[#fbfaf7] border border-[#c4a66b]/50 p-4 text-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
            <strong className="text-[#121210]">
              Curated One-Click Import Summary (Max {bulkImportSummary.maxProfitPercent}% Profit Cap):{' '}
              {bulkImportSummary.importedCount} imported · {bulkImportSummary.updatedCount} updated
              {bulkImportSummary.skippedCount > 0 ? ` · ${bulkImportSummary.skippedCount} skipped` : ''}
            </strong>
            <button
              type="button"
              onClick={() => setBulkImportSummary(null)}
              className="text-[#77746d] hover:text-[#121210] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          {bulkImportSummary.items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {bulkImportSummary.items.map((item) => (
                <div key={item.cjPid} className="bg-white border border-[#e7e4de] p-2.5 space-y-1">
                  <div className="font-semibold text-[#121210] truncate" title={item.title}>
                    {item.title}
                  </div>
                  {item.curatedType && (
                    <div className="text-[10px] font-mono text-[#856404] truncate">
                      {item.curatedType} · {item.category}
                    </div>
                  )}
                  <div className="flex items-center justify-between font-mono text-[10px] text-[#77746d]">
                    <span>
                      Cost {formatUSD(item.supplierCostCents)} → Retail {formatUSD(item.retailPriceCents)}
                    </span>
                    <span className="text-[#1e7e34] font-bold">+{item.appliedProfitPercent}% Profit</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {bulkImportSummary.errors.length > 0 && (
            <div className="text-[11px] text-[#856404] font-mono">
              Notes: {bulkImportSummary.errors.slice(0, 6).map((e) => `${e.cjPid}: ${e.reason}`).join(' | ')}
              {bulkImportSummary.errors.length > 6 ? ` (+${bulkImportSummary.errors.length - 6} more)` : ''}
            </div>
          )}
        </div>
      )}

      {/* Sync Result Banner */}
      {syncSummary && (
        <div className="bg-[#f8f7f4] border border-[#e7e4de] p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between font-mono">
            <strong>
              Inventory Sync Summary: {syncSummary.syncedCount} synced, {syncSummary.failedCount} failed
            </strong>
            <button
              type="button"
              onClick={() => setSyncSummary(null)}
              className="text-[#77746d] hover:text-[#121210] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {syncSummary.results.map((r) => (
              <div key={r.productId} className="bg-white border border-[#e7e4de] p-2 flex items-center justify-between gap-2">
                <span className="truncate font-medium text-[#121210]">{r.title}</span>
                {r.success ? (
                  <span className="font-mono text-[10px] text-[#1e7e34] shrink-0">
                    {r.stockQuantity} units
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-[#9b1c1c] shrink-0" title={r.error}>
                    Error
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs">
        <div className="md:col-span-6">
          <label htmlFor="cj-keyword-search" className="block text-[10px] font-mono uppercase text-[#77746d] mb-1">
            Keyword Search (Real CJ API 2.0 Catalogue)
          </label>
          <input
            id="cj-keyword-search"
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="e.g. magsafe charger, wireless earbuds, usb-c hub, laptop stand..."
            className="w-full border border-[#e7e4de] px-3 py-2 bg-[#fbfbfa] text-[#121210] focus:border-[#121210] focus:outline-hidden"
          />
        </div>

        <div className="md:col-span-3">
          <label htmlFor="cj-warehouse-filter" className="block text-[10px] font-mono uppercase text-[#77746d] mb-1">
            Warehouse Filter
          </label>
          <select
            id="cj-warehouse-filter"
            value={warehouseCountry}
            onChange={(e) => setWarehouseCountry(e.target.value)}
            className="w-full border border-[#e7e4de] px-3 py-2 bg-white text-[#121210] focus:border-[#121210] focus:outline-hidden"
          >
            <option value="">All Global Warehouses</option>
            <option value="CN">China Warehouse (CN)</option>
            <option value="US">United States Warehouse (US)</option>
            <option value="GB">United Kingdom Warehouse (GB)</option>
            <option value="DE">Germany Warehouse (DE)</option>
          </select>
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            disabled={isSearching}
            className="w-full bg-[#121210] text-[#f8f7f4] py-2 px-4 text-xs font-mono font-semibold uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? 'Searching CJ...' : 'Search CJ Catalogue'}
          </button>
        </div>
      </form>

      {/* Search Error */}
      {searchError && (
        <div className="bg-[#fdf2f2] border border-[#9b1c1c]/25 p-4 text-xs text-[#9b1c1c]">
          <strong className="font-mono uppercase text-[10px] block mb-0.5">CJ Catalogue Notice</strong>
          <span>{searchError}</span>
        </div>
      )}

      {/* Search Results */}
      {isSearching ? (
        <div className="py-12 text-center text-xs font-mono text-[#77746d]">
          Querying live CJdropshipping product catalogue...
        </div>
      ) : hasSearched && searchResults.length === 0 && !searchError ? (
        <div className="py-10 text-center border border-dashed border-[#e7e4de] text-xs text-[#77746d]">
          No CJ products matched &ldquo;{keyword}&rdquo;. Try a broader search term or remove the warehouse filter.
        </div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#77746d]">
            <span>
              Showing {searchResults.length} real CJ products (Page {page} · {totalResults.toLocaleString()} matches)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isSearching}
                onClick={() => runSearch(page - 1)}
                className="px-3 py-1 border border-[#e7e4de] bg-white hover:bg-[#f8f7f4] disabled:opacity-40 cursor-pointer"
              >
                ← Prev
              </button>
              <button
                type="button"
                disabled={searchResults.length < 12 || page * 12 >= totalResults || isSearching}
                onClick={() => runSearch(page + 1)}
                className="px-3 py-1 border border-[#e7e4de] bg-white hover:bg-[#f8f7f4] disabled:opacity-40 cursor-pointer"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((item) => {
              const isImported = item.alreadyImported || importedPidSet.has(item.pid);
              const hasRange =
                item.supplierPriceCents !== null &&
                item.supplierPriceMaxCents !== null &&
                item.supplierPriceMaxCents > item.supplierPriceCents;

              return (
                <div
                  key={item.pid}
                  className="border border-[#e7e4de] bg-[#fbfaf7] flex flex-col justify-between p-4 gap-3"
                >
                  <div className="space-y-3">
                    <div className="relative h-44 bg-white border border-[#e7e4de] flex items-center justify-center overflow-hidden p-2">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productNameEn}
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="font-serif text-2xl text-[#a9a69f]">CJ</span>
                      )}
                      {isImported && (
                        <span className="absolute top-2 right-2 bg-[#eef8ee] border border-[#1e7e34]/30 text-[#1e7e34] px-2 py-0.5 text-[9px] font-mono font-bold uppercase">
                          Imported
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#77746d]">
                        <span className="truncate">{item.categoryName || 'CJ Global'}</span>
                        <span className="shrink-0">SKU: {item.productSku || '—'}</span>
                      </div>
                      <h4 className="font-serif text-sm font-bold text-[#121210] line-clamp-2 min-h-[2.5rem]">
                        {item.productNameEn}
                      </h4>
                      <div className="text-[10px] font-mono text-[#a9a69f] truncate">PID: {item.pid}</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#e7e4de] space-y-2.5">
                    <div className="flex items-end justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[9px] font-mono uppercase text-[#77746d] block">
                          CJ Supplier Cost
                        </span>
                        <strong className="font-mono text-[#121210]">
                          {item.supplierPriceCents !== null
                            ? hasRange
                              ? `${formatUSD(item.supplierPriceCents)} – ${formatUSD(item.supplierPriceMaxCents!)}`
                              : formatUSD(item.supplierPriceCents)
                            : item.sellPriceRaw || 'See Variants'}
                        </strong>
                        {item.supplierPriceNgn !== null && (
                          <span className="block text-[10px] font-mono text-[#77746d]">
                            {formatNGN(item.supplierPriceNgn)}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-mono uppercase text-[#77746d] block">
                          Stock
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#121210]">
                          {typeof item.warehouseInventoryNum === 'number'
                            ? `${item.warehouseInventoryNum.toLocaleString()} units`
                            : 'Check Detail'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openProductPreview(item.pid)}
                      className="w-full bg-[#121210] text-[#f8f7f4] py-2 text-[11px] font-mono font-semibold uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors cursor-pointer"
                    >
                      {isImported ? 'Preview / Update Product' : 'Preview & Import'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-[#e7e4de] text-xs text-[#77746d] space-y-1">
          <p className="font-medium text-[#121210]">Enter a keyword above to browse real CJdropshipping products.</p>
          <p>
            You will be able to inspect specifications, real warehouse stock, variant SKUs, and live destination freight quotes before importing.
          </p>
        </div>
      )}

      {/* Detail / Preview Loading or Error Overlay */}
      {(isLoadingDetail || detailError) && !activeDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Loading CJ product preview"
          className="fixed inset-0 z-50 bg-[#121210]/70 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#e7e4de] max-w-md w-full p-6 space-y-4 text-center shadow-2xl">
            {isLoadingDetail ? (
              <>
                <p className="font-serif text-lg text-[#121210]">Fetching Real CJ Product Details...</p>
                <p className="text-xs text-[#77746d] font-mono">
                  Retrieving specifications, variant SKUs, warehouse inventory &amp; supplier prices.
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-lg text-[#9b1c1c]">Unable to Load Product Details</p>
                <p className="text-xs text-[#77746d]">{detailError}</p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-[#121210] text-white px-5 py-2 text-xs font-mono uppercase tracking-wider cursor-pointer"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Full Product Details, Freight Quote & Pricing Preview Modal */}
      {activeDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${activeDetail.productNameEn}`}
          className="fixed inset-0 z-50 bg-[#121210]/75 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <div className="bg-white border border-[#121210] w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-[#121210] text-[#f8f7f4] px-6 py-4 flex items-center justify-between gap-4 border-b border-[#252521]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#c4a66b] uppercase">
                  <span>CJ Product Preview &amp; Import</span>
                  <span>·</span>
                  <span>PID: {activeDetail.pid}</span>
                  <span>·</span>
                  <span>SKU: {activeDetail.productSku || '—'}</span>
                </div>
                <h3 className="font-serif text-lg font-bold truncate text-white">
                  {activeDetail.productNameEn}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close CJ product preview modal"
                className="text-[#a9a69f] hover:text-white text-lg px-2 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 text-xs">
              {/* Row 1: Images + Listing & Pricing Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Gallery & Specs */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="h-64 bg-[#f8f7f4] border border-[#e7e4de] flex items-center justify-center p-4">
                    {activePreviewImage ? (
                      <img
                        src={activePreviewImage}
                        alt={activeDetail.productNameEn}
                        className="max-h-full max-w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-serif text-3xl text-[#a9a69f]">CJ</span>
                    )}
                  </div>

                  {activeDetail.productImageSet.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {activeDetail.productImageSet.slice(0, 10).map((imgUrl) => (
                        <button
                          key={imgUrl}
                          type="button"
                          onClick={() => setActivePreviewImage(imgUrl)}
                          className={`w-14 h-14 shrink-0 border p-1 bg-white cursor-pointer ${
                            activePreviewImage === imgUrl ? 'border-[#121210] ring-1 ring-[#121210]' : 'border-[#e7e4de]'
                          }`}
                        >
                          <img src={imgUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Real Specifications Table */}
                  <div className="border border-[#e7e4de] bg-[#fbfaf7]">
                    <div className="px-3 py-2 border-b border-[#e7e4de] font-mono text-[10px] uppercase font-bold text-[#121210]">
                      Verified CJ Specifications
                    </div>
                    <div className="divide-y divide-[#e7e4de]">
                      {activeDetail.specs.map((spec) => (
                        <div key={spec.label} className="px-3 py-1.5 flex justify-between gap-3">
                          <span className="text-[#77746d]">{spec.label}</span>
                          <span className="font-mono text-[#121210] text-right">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warehouse Stock Breakdown */}
                  <div className="border border-[#e7e4de] bg-[#fbfaf7]">
                    <div className="px-3 py-2 border-b border-[#e7e4de] flex items-center justify-between font-mono text-[10px] uppercase font-bold text-[#121210]">
                      <span>Real Warehouse Stock</span>
                      <span>
                        {typeof activeDetail.totalInventory === 'number'
                          ? `${activeDetail.totalInventory.toLocaleString()} total`
                          : 'Unavailable'}
                      </span>
                    </div>
                    {activeDetail.warehouseStock.length > 0 ? (
                      <div className="divide-y divide-[#e7e4de]">
                        {activeDetail.warehouseStock.map((wh, idx) => (
                          <div key={`${wh.countryCode}-${idx}`} className="px-3 py-1.5 flex items-center justify-between">
                            <span>
                              {wh.areaEn} ({wh.countryCode})
                            </span>
                            <span className="font-mono font-bold text-[#121210]">
                              {wh.totalInventory.toLocaleString()} units
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="p-3 text-[11px] text-[#77746d]">
                        {activeDetail.inventoryNote || 'No warehouse breakdown returned for this SKU; verify per-variant stock below.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Storefront Listing & Pricing Config */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="border border-[#e7e4de] p-4 space-y-3 bg-white">
                    <h4 className="font-mono text-[11px] uppercase font-bold text-[#121210] border-b border-[#e7e4de] pb-2">
                      1. VANTÉRA Storefront Presentation
                    </h4>

                    <div>
                      <label htmlFor="cj-import-title" className="block text-[11px] font-medium text-[#77746d] mb-1">
                        Storefront Product Title *
                      </label>
                      <input
                        id="cj-import-title"
                        type="text"
                        value={importTitle}
                        onChange={(e) => setImportTitle(e.target.value)}
                        className="w-full border border-[#e7e4de] p-2 text-xs text-[#121210] focus:border-[#121210] focus:outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="cj-import-category" className="block text-[11px] font-medium text-[#77746d] mb-1">
                          VANTÉRA Category *
                        </label>
                        <select
                          id="cj-import-category"
                          value={importCategory}
                          onChange={(e) => setImportCategory(e.target.value)}
                          className="w-full border border-[#e7e4de] p-2 bg-white text-xs text-[#121210]"
                        >
                          {CATEGORIES.filter((c) => c.id !== 'festive-season').map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-[#121210]">
                          <input
                            type="checkbox"
                            checked={importTrending}
                            onChange={(e) => setImportTrending(e.target.checked)}
                          />
                          <span>Feature in Trending Finds</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cj-import-description" className="block text-[11px] font-medium text-[#77746d] mb-1">
                        Storefront Description
                      </label>
                      <textarea
                        id="cj-import-description"
                        rows={4}
                        value={importDescription}
                        onChange={(e) => setImportDescription(e.target.value)}
                        className="w-full border border-[#e7e4de] p-2 text-xs text-[#121210] focus:border-[#121210] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Pricing & Margin Engine */}
                  <div className="border border-[#e7e4de] p-4 space-y-3 bg-[#fbfaf7]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7e4de] pb-2">
                      <h4 className="font-mono text-[11px] uppercase font-bold text-[#121210]">
                        2. Selling Price &amp; Margin Strategy (USD &amp; NGN)
                      </h4>
                      <span className="text-[10px] font-mono text-[#77746d]">
                        FX: {fxMeta.provider} (₦{fxMeta.usdToNgnRate.toLocaleString()}/$)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="cj-pricing-mode" className="block text-[11px] font-medium text-[#77746d] mb-1">
                          Pricing Mode
                        </label>
                        <select
                          id="cj-pricing-mode"
                          value={pricingMode}
                          onChange={(e) => {
                            const nextMode = e.target.value as CjPricingMode;
                            setPricingMode(nextMode);
                            if (nextMode === 'fixed_cents') {
                              const fallbackUsd = ((sampleSellingCents || 2500) / 100).toFixed(2);
                              setPricingValue(fallbackUsd);
                            } else if (nextMode === 'margin_percent') {
                              setPricingValue('45');
                            } else {
                              setPricingValue('80');
                            }
                          }}
                          className="w-full border border-[#e7e4de] p-2 bg-white text-xs text-[#121210]"
                        >
                          <option value="markup_percent">Markup % over Supplier Cost</option>
                          <option value="margin_percent">Target Gross Margin %</option>
                          <option value="fixed_cents">Fixed Selling Price ($ USD)</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="cj-pricing-value" className="block text-[11px] font-medium text-[#77746d] mb-1">
                          {pricingMode === 'fixed_cents'
                            ? 'Selling Price ($ USD)'
                            : pricingMode === 'margin_percent'
                            ? 'Target Gross Margin (%)'
                            : 'Markup Percentage (%)'}
                        </label>
                        <input
                          id="cj-pricing-value"
                          type="number"
                          min="0"
                          step={pricingMode === 'fixed_cents' ? '0.01' : '1'}
                          value={pricingValue}
                          onChange={(e) => setPricingValue(e.target.value)}
                          className="w-full border border-[#e7e4de] p-2 bg-white font-mono text-xs text-[#121210]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div className="bg-white border border-[#e7e4de] p-2.5">
                        <span className="text-[9px] font-mono uppercase text-[#77746d] block">Supplier Cost</span>
                        <strong className="font-mono text-sm text-[#121210]">
                          {sampleProfit.supplierCostCents !== null ? formatUSD(sampleProfit.supplierCostCents) : '—'}
                        </strong>
                        <span className="block text-[10px] font-mono text-[#77746d]">
                          {sampleProfit.supplierCostNgn !== null ? formatNGN(sampleProfit.supplierCostNgn) : '—'}
                        </span>
                      </div>

                      <div className="bg-white border border-[#e7e4de] p-2.5">
                        <span className="text-[9px] font-mono uppercase text-[#77746d] block">Customer Retail</span>
                        <strong className="font-mono text-sm text-[#121210]">
                          {sampleProfit.retailPriceCents > 0 ? formatUSD(sampleProfit.retailPriceCents) : '—'}
                        </strong>
                        <span className="block text-[10px] font-mono text-[#77746d]">
                          {sampleProfit.retailPriceCents > 0 ? formatNGN(sampleProfit.retailNgn) : '—'}
                        </span>
                      </div>

                      <div className="bg-white border border-[#e7e4de] p-2.5">
                        <span className="text-[9px] font-mono uppercase text-[#1e7e34] block">Estimated Margin</span>
                        <strong
                          className={`font-mono text-sm ${
                            (sampleProfit.profitCents ?? 0) > 0 ? 'text-[#1e7e34]' : 'text-[#9b1c1c]'
                          }`}
                        >
                          {sampleProfit.profitCents !== null ? formatUSD(sampleProfit.profitCents) : '—'}
                        </strong>
                        <span className="block text-[10px] font-mono text-[#77746d]">
                          {sampleProfit.marginPercent !== null ? `${sampleProfit.marginPercent}% margin` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Live CJ Freight Calculator */}
              <div className="border border-[#e7e4de] p-4 space-y-3 bg-[#fbfaf7]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e7e4de] pb-2">
                  <h4 className="font-mono text-[11px] uppercase font-bold text-[#121210]">
                    3. Live CJ Shipping &amp; Freight Quote (Actual Carrier Data)
                  </h4>
                  <span className="text-[10px] text-[#77746d]">
                    Calculated live via CJ Logistic API for destination country.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label htmlFor="cj-freight-variant" className="block text-[10px] font-mono uppercase text-[#77746d] mb-1">
                      Variant (VID)
                    </label>
                    <select
                      id="cj-freight-variant"
                      value={freightVid}
                      onChange={(e) => setFreightVid(e.target.value)}
                      className="w-full border border-[#e7e4de] p-2 bg-white text-xs"
                    >
                      {activeDetail.variants.length === 0 ? (
                        <option value="">No variants returned</option>
                      ) : (
                        activeDetail.variants.map((v) => (
                          <option key={v.vid} value={v.vid}>
                            {v.label} ({v.variantSku || v.vid})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label htmlFor="cj-freight-country" className="block text-[10px] font-mono uppercase text-[#77746d] mb-1">
                      Destination
                    </label>
                    <select
                      id="cj-freight-country"
                      value={freightCountry}
                      onChange={(e) => setFreightCountry(e.target.value)}
                      className="w-full border border-[#e7e4de] p-2 bg-white text-xs"
                    >
                      {DESTINATION_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <label htmlFor="cj-freight-qty" className="block text-[10px] font-mono uppercase text-[#77746d] mb-1">
                      Qty
                    </label>
                    <input
                      id="cj-freight-qty"
                      type="number"
                      min="1"
                      max="99"
                      value={freightQuantity}
                      onChange={(e) => setFreightQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full border border-[#e7e4de] p-2 bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="cj-freight-zip" className="block text-[10px] font-mono uppercase text-[#77746d] mb-1">
                      Zip (Optional)
                    </label>
                    <input
                      id="cj-freight-zip"
                      type="text"
                      value={freightZip}
                      onChange={(e) => setFreightZip(e.target.value)}
                      placeholder="100001"
                      className="w-full border border-[#e7e4de] p-2 bg-white font-mono text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleCalculateFreight}
                      disabled={isCalculatingFreight || !freightVid}
                      className="w-full bg-[#121210] text-white py-2 px-3 text-[11px] font-mono uppercase font-semibold hover:bg-[#c4a66b] hover:text-[#121210] disabled:opacity-40 cursor-pointer"
                    >
                      {isCalculatingFreight ? 'Calculating...' : 'Quote Shipping'}
                    </button>
                  </div>
                </div>

                {freightError && (
                  <div className="bg-[#fdf2f2] border border-[#9b1c1c]/25 p-2.5 text-xs text-[#9b1c1c]">
                    {freightError}
                  </div>
                )}

                {freightOptions !== null && (
                  freightOptions.length === 0 ? (
                    <div className="bg-white border border-[#e7e4de] p-3 text-xs text-[#77746d]">
                      CJ returned no active shipping channels to <strong>{freightCountry}</strong> for this variant.
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-white border border-[#e7e4de]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#f8f7f4] border-b border-[#e7e4de] text-[10px] font-mono uppercase text-[#77746d]">
                          <tr>
                            <th className="p-2.5">CJ Logistics Method</th>
                            <th className="p-2.5">CJ Transit Window</th>
                            <th className="p-2.5">Total Postage (USD)</th>
                            <th className="p-2.5">Total Postage (NGN)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7e4de]">
                          {freightOptions.map((opt, i) => (
                            <tr key={`${opt.logisticName}-${i}`}>
                              <td className="p-2.5 font-medium text-[#121210]">{opt.logisticName}</td>
                              <td className="p-2.5 font-mono text-[#77746d]">{opt.logisticAging} days</td>
                              <td className="p-2.5 font-mono font-bold text-[#121210]">
                                {formatUSD(opt.totalPostageFeeCents)}
                              </td>
                              <td className="p-2.5 font-mono text-[#77746d]">
                                {formatNGN(opt.totalPostageFeeNgn)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>

              {/* Row 3: Variants Selection Table */}
              <div className="border border-[#e7e4de] bg-white">
                <div className="px-4 py-3 border-b border-[#e7e4de] bg-[#f8f7f4] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-mono text-[11px] uppercase font-bold text-[#121210]">
                      4. Select Variants to Import ({selectedVariantsCount} of {activeDetail.variants.length} selected)
                    </h4>
                  </div>
                  {activeDetail.variants.length > 0 && (
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          const all: Record<string, boolean> = {};
                          activeDetail.variants.forEach((v) => {
                            all[v.vid] = true;
                          });
                          setSelectedVariantVids(all);
                        }}
                        className="underline text-[#121210] cursor-pointer"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const inStock: Record<string, boolean> = {};
                          activeDetail.variants.forEach((v) => {
                            inStock[v.vid] = (v.stockQuantity ?? 0) > 0;
                          });
                          setSelectedVariantVids(inStock);
                        }}
                        className="underline text-[#77746d] cursor-pointer"
                      >
                        In-Stock Only
                      </button>
                    </div>
                  )}
                </div>

                {activeDetail.variants.length === 0 ? (
                  <p className="p-4 text-xs text-[#77746d]">
                    CJ returned no sub-variants for this product. Base product stock and pricing will be imported.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#fbfaf7] border-b border-[#e7e4de] text-[10px] font-mono uppercase text-[#77746d]">
                        <tr>
                          <th className="p-2.5">Import</th>
                          <th className="p-2.5">Variant (Color / Size)</th>
                          <th className="p-2.5">CJ SKU / VID</th>
                          <th className="p-2.5">Live Stock</th>
                          <th className="p-2.5">Supplier Cost</th>
                          <th className="p-2.5">VANTÉRA Retail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e7e4de]">
                        {activeDetail.variants.map((v) => {
                          const isChecked = Boolean(selectedVariantVids[v.vid]);
                          const numericVal = getPricingNumericValue();
                          const vRetail = calculateSellingPriceCents(v.supplierPriceCents, pricingMode, numericVal);
                          const vRetailNgn = convertUsdCentsToNgn(vRetail, fxMeta.usdToNgnRate);
                          const stockQty = v.stockQuantity;

                          return (
                            <tr
                              key={v.vid}
                              className={isChecked ? 'bg-[#fbfaf7]' : 'opacity-65'}
                            >
                              <td className="p-2.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Select variant ${v.label}`}
                                  checked={isChecked}
                                  onChange={(e) =>
                                    setSelectedVariantVids((prev) => ({ ...prev, [v.vid]: e.target.checked }))
                                  }
                                />
                              </td>
                              <td className="p-2.5">
                                <div className="flex items-center gap-2.5">
                                  {v.variantImage && (
                                    <button
                                      type="button"
                                      onClick={() => setActivePreviewImage(v.variantImage)}
                                      className="w-8 h-8 border border-[#e7e4de] bg-white p-0.5 shrink-0 cursor-pointer"
                                    >
                                      <img src={v.variantImage} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                    </button>
                                  )}
                                  <div>
                                    <span className="font-semibold text-[#121210] block">{v.label}</span>
                                    {v.variantStandard && (
                                      <span className="text-[10px] text-[#77746d]">{v.variantStandard}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-2.5 font-mono text-[10px] text-[#77746d]">
                                <div>{v.variantSku || '—'}</div>
                                <div className="text-[#a9a69f]">VID: {v.vid}</div>
                              </td>
                              <td className="p-2.5 font-mono">
                                {stockQty === null ? (
                                  <span className="text-[#856404]">Unreported</span>
                                ) : stockQty > 0 ? (
                                  <span className="text-[#1e7e34] font-bold">{stockQty} units</span>
                                ) : (
                                  <span className="text-[#9b1c1c] font-bold">0 (Out)</span>
                                )}
                              </td>
                              <td className="p-2.5 font-mono">
                                <div>{v.supplierPriceCents !== null ? formatUSD(v.supplierPriceCents) : '—'}</div>
                                {v.supplierPriceNgn !== null && (
                                  <div className="text-[10px] text-[#77746d]">{formatNGN(v.supplierPriceNgn)}</div>
                                )}
                              </td>
                              <td className="p-2.5 font-mono">
                                <div className="font-bold text-[#121210]">{vRetail > 0 ? formatUSD(vRetail) : '—'}</div>
                                {vRetail > 0 && (
                                  <div className="text-[10px] text-[#77746d]">{formatNGN(vRetailNgn)}</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {importError && (
                <div className="bg-[#fdf2f2] border border-[#9b1c1c]/30 p-3 text-xs text-[#9b1c1c]">
                  {importError}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-[#f8f7f4] border-t border-[#e7e4de] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] font-mono text-[#77746d]">
                Supplier costs remain hidden from the public storefront and checkout.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-[#e7e4de] bg-white text-xs text-[#121210] hover:bg-[#f4f2ee] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportProduct}
                  disabled={isImporting}
                  className="bg-[#121210] text-[#f8f7f4] px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isImporting
                    ? 'Importing into VANTÉRA...'
                    : importedPidSet.has(activeDetail.pid)
                    ? 'Update Imported Product'
                    : 'Import to VANTÉRA Catalogue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
