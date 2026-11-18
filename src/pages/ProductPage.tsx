import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Heart, Maximize2, X, Plus, Minus, Check } from 'lucide-react';
import { Product, CATEGORIES } from '../data/catalog.ts';
import { mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { wrapGalleryIndex } from '../lib/storefrontHelpers.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useWishlist } from '../contexts/WishlistContext.tsx';
import { ProductCard } from '../components/ProductCard.tsx';
import { LuxuryImage } from '../components/LuxuryImage.tsx';
import { trackEvent } from '../lib/tracker.ts';

interface ProductPageProps {
  productSlug: string;
  products: Product[];
  isLoading?: boolean;
  onNavigate: (url: string) => void;
}

export const ProductPage: React.FC<ProductPageProps> = ({
  productSlug,
  products,
  isLoading = false,
  onNavigate,
}) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState('Obsidian Noir');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [addedNotice, setAddedNotice] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<'materials' | 'delivery' | 'returns' | 'specs' | null>(
    'materials'
  );
  const touchStartXRef = useRef<number | null>(null);

  const product = products.find((p) => p.slug === productSlug || p.id === productSlug);

  // Build deduplicated full gallery array (lead image + galleryImages + variant image if unique)
  const galleryList = useMemo(() => {
    if (!product) return [];
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (Array.isArray(product.galleryImages)) {
      for (const g of product.galleryImages) {
        if (g && !list.includes(g)) list.push(g);
      }
    }
    if (Array.isArray(product.variants)) {
      for (const v of product.variants) {
        if (v.image && !list.includes(v.image)) list.push(v.image);
      }
    }
    if (list.length === 0) {
      list.push('/products/charging-phone-stand.jpg');
    }
    return list;
  }, [product]);

  useEffect(() => {
    setQuantity(1);
    setAddedNotice(false);
    setIsZoomOpen(false);
    setGalleryIndex(0);
    if (product) {
      const firstAvail =
        product.variants && product.variants.length > 0
          ? product.variants.find((v) => v.isAvailable && v.stockQuantity > 0) || product.variants[0]
          : null;
      setSelectedVariantId(firstAvail?.id || null);
      trackEvent('product_viewed', {
        productId: product.id,
        productTitle: product.title,
        category: product.category,
        retailPriceCents: firstAvail?.retailPriceCents ?? product.retailPriceCents,
      });
    } else {
      setSelectedVariantId(null);
    }
  }, [product?.id]);

  if (isLoading && !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-7 aspect-square vantera-shimmer rounded-xs" />
          <div className="lg:col-span-5 space-y-6">
            <div className="h-4 w-32 vantera-shimmer rounded-xs" />
            <div className="h-10 w-3/4 vantera-shimmer rounded-xs" />
            <div className="h-8 w-36 vantera-shimmer rounded-xs" />
            <div className="h-24 w-full vantera-shimmer rounded-xs" />
            <div className="h-14 w-full vantera-shimmer rounded-xs" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-28 text-center space-y-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">Unavailable</p>
        <h1 className="text-3xl font-editorial font-medium text-[#111111]">Product Not Found</h1>
        <p className="text-sm text-[#5C574E]">
          The piece you requested is unavailable or has been archived.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/shop')}
          className="gold-gradient-bg px-7 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
        >
          Browse Collection
        </button>
      </div>
    );
  }

  const productVariants = Array.isArray(product.variants) && product.variants.length > 0 ? product.variants : null;
  const activeVariant = productVariants
    ? productVariants.find((v) => v.id === selectedVariantId) || productVariants[0]
    : null;

  const effectiveStock = activeVariant ? activeVariant.stockQuantity : product.stockQuantity;
  const effectivePriceCents = activeVariant ? activeVariant.retailPriceCents : product.retailPriceCents;
  const displayImage = galleryList[galleryIndex] || activeVariant?.image || product.image || '/products/charging-phone-stand.jpg';

  const isOutOfStock =
    !product.isAvailable ||
    effectiveStock <= 0 ||
    product.availability === 'out_of_stock' ||
    (activeVariant ? !activeVariant.isAvailable : false);
  const isReservedPhone = product.category === 'phones';
  const saved = isInWishlist(product.id);
  const mappedCatId = mapLegacyCategoryToCurated(product.category);
  const categoryObj = CATEGORIES.find((c) => c.id === mappedCatId || c.id === product.category);
  const categoryLabel = categoryObj?.label || product.category.replace(/-/g, ' ');

  const related = products
    .filter((p) => p.id !== product.id)
    .sort((a, b) => {
      const aSame = mapLegacyCategoryToCurated(a.category) === mappedCatId ? 1 : 0;
      const bSame = mapLegacyCategoryToCurated(b.category) === mappedCatId ? 1 : 0;
      return bSame - aSame;
    })
    .slice(0, 3);

  const handleAddToCart = () => {
    if (isReservedPhone || isOutOfStock) return;
    addToCart(product, quantity, activeVariant || undefined);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3500);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (galleryList.length <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || galleryList.length <= 1) return;
    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(deltaX) > 36) {
      setGalleryIndex((prev) => wrapGalleryIndex(prev, deltaX > 0 ? 1 : -1, galleryList.length));
    }
    touchStartXRef.current = null;
  };

  const finishes = [
    { name: 'Obsidian Noir', hex: '#1B1B1B' },
    { name: 'Champagne Gold', hex: '#B89B5E' },
    { name: 'Warm Stone', hex: '#A69F94' },
    { name: 'Brushed Silver', hex: '#D8D4CC' },
  ];

  const toggleSection = (key: 'materials' | 'delivery' | 'returns' | 'specs') => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-10 pb-24 lg:py-16 space-y-20 text-[#111111]">
      {/* Breadcrumb Trail */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#5C574E] flex-wrap"
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="hover:text-[#111111] transition-colors"
        >
          Home
        </a>
        <span aria-hidden="true">/</span>
        <a
          href="/shop"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/shop');
          }}
          className="hover:text-[#111111] transition-colors"
        >
          Shop
        </a>
        <span aria-hidden="true">/</span>
        <a
          href={`/category/${mappedCatId}`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(`/category/${mappedCatId}`);
          }}
          className="hover:text-[#111111] transition-colors"
        >
          {categoryLabel}
        </a>
        <span aria-hidden="true">/</span>
        <span className="text-[#111111] font-medium truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main 2-Column Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        {/* Left: Swipeable Studio Gallery & Framing Strip */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative bg-[#EFEAE0] border border-[#111111]/10 aspect-square w-full flex items-center justify-center rounded-xs overflow-hidden group select-none"
          >
            <LuxuryImage
              src={displayImage}
              alt={product.imageAlt || product.title}
              onClick={() => setIsZoomOpen(true)}
              wrapperClassName="w-full h-full"
              className={`h-full w-full object-cover object-center cursor-zoom-in transition-transform duration-500 ease-out group-hover:scale-[1.03] ${
                isOutOfStock ? 'opacity-50' : ''
              }`}
              loading="eager"
              referrerPolicy="no-referrer"
            />

            {galleryList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setGalleryIndex((prev) => wrapGalleryIndex(prev, -1, galleryList.length))}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#F7F3EC]/85 backdrop-blur-xs border border-[#111111]/15 text-[#111111] hover:border-[#B89B5E] rounded-full inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryIndex((prev) => wrapGalleryIndex(prev, 1, galleryList.length))}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#F7F3EC]/85 backdrop-blur-xs border border-[#111111]/15 text-[#111111] hover:border-[#B89B5E] rounded-full inline-flex items-center justify-center transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsZoomOpen(true)}
              aria-label="Enlarge product photograph"
              className="absolute bottom-4 right-4 bg-[#F7F3EC]/90 backdrop-blur-xs border border-[#111111]/15 text-[#111111] hover:border-[#B89B5E] hover:text-[#7A6230] px-3.5 py-2 text-[10px] uppercase tracking-[0.18em] rounded-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Zoom</span>
            </button>
          </div>

          {/* Thumbnail Strip */}
          {galleryList.length > 1 && (
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5">
              {galleryList.slice(0, 6).map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => setGalleryIndex(idx)}
                  aria-label={`View gallery photo ${idx + 1}`}
                  className={`bg-[#EFEAE0] border rounded-xs overflow-hidden aspect-square transition-colors cursor-pointer ${
                    galleryIndex === idx
                      ? 'border-[#B89B5E] ring-1 ring-[#B89B5E]'
                      : 'border-[#111111]/10 hover:border-[#111111]/30'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${product.title} — View ${idx + 1}`}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Calm Purchase & Accordion Details Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-8">
          <div className="bg-[#FAF7F2] border border-[#111111]/10 p-6 sm:p-8 rounded-xs space-y-6">
            <div className="space-y-3 border-b border-[#111111]/10 pb-6">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#5C574E]">
                <span>{categoryLabel}</span>
                <span className={isOutOfStock ? 'text-[#8E3A3A] font-semibold' : 'text-[#7A6230] font-semibold'}>
                  {isOutOfStock
                    ? 'Out of stock'
                    : effectiveStock <= 5
                    ? 'Low stock'
                    : 'In stock'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#111111] leading-tight text-balance">
                  {product.title}
                </h1>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xs border transition-colors cursor-pointer shrink-0 ${
                    saved
                      ? 'border-[#B89B5E] text-[#B89B5E] bg-[#B89B5E]/10'
                      : 'border-[#111111]/15 text-[#5C574E] hover:text-[#111111]'
                  }`}
                >
                  <Heart className="w-4 h-4" strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="flex items-baseline gap-3 pt-2">
                <span className="text-2xl sm:text-3xl font-medium text-[#111111] tabular-nums">
                  {formatAmount(effectivePriceCents)}
                </span>
                {product.referencePriceCents && product.referencePriceCents > effectivePriceCents && (
                  <span className="text-sm text-[#5C574E] line-through tabular-nums">
                    {formatAmount(product.referencePriceCents)}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#5C574E] ml-auto">
                  {currency}
                </span>
              </div>
            </div>

            <p className="text-sm text-[#5C574E] font-light leading-relaxed">{product.description}</p>

            {/* Real Variants or Finish Swatches */}
            {productVariants ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                  <span className="text-[#5C574E]">Edition / Variant</span>
                  <span className="text-[#111111] font-medium">{activeVariant?.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {productVariants.map((variant) => {
                    const variantSelected = activeVariant?.id === variant.id;
                    const variantOutOfStock = !variant.isAvailable || variant.stockQuantity <= 0;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          setQuantity(1);
                          if (variant.image) {
                            const idx = galleryList.indexOf(variant.image);
                            if (idx >= 0) setGalleryIndex(idx);
                          }
                        }}
                        className={`px-3.5 py-2 text-[11px] rounded-xs border transition-colors cursor-pointer text-left ${
                          variantSelected
                            ? 'border-[#B89B5E] bg-[#B89B5E]/15 text-[#111111]'
                            : 'border-[#111111]/12 bg-[#F7F3EC] text-[#5C574E] hover:border-[#111111]/30 hover:text-[#111111]'
                        } ${variantOutOfStock ? 'opacity-50' : ''}`}
                      >
                        <span className="block font-medium">{variant.name}</span>
                        <span className="block text-[9px] uppercase tracking-wider text-[#5C574E]">
                          {variantOutOfStock ? 'Out of stock' : 'Available'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                  <span className="text-[#5C574E]">Finish</span>
                  <span className="text-[#111111] font-medium">{selectedFinish}</span>
                </div>
                <div className="flex items-center gap-3">
                  {finishes.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setSelectedFinish(f.name)}
                      aria-label={`Select ${f.name}`}
                      title={f.name}
                      className={`w-7 h-7 rounded-full border transition-all cursor-pointer ${
                        selectedFinish === f.name
                          ? 'border-[#B89B5E] ring-2 ring-[#B89B5E]/40 ring-offset-2 ring-offset-[#FAF7F2]'
                          : 'border-[#111111]/20 opacity-75 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: f.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Primary Cart Action or Out of Stock State */}
            {!isReservedPhone && !isOutOfStock ? (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#5C574E]">
                    Quantity
                  </span>
                  <div className="inline-flex items-center border border-[#111111]/15 rounded-xs bg-[#F7F3EC]">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3.5 py-2.5 text-[#5C574E] hover:text-[#111111] cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                    <span className="px-4 text-sm font-medium text-[#111111] tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      disabled={quantity >= effectiveStock}
                      onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
                      className="px-3.5 py-2.5 text-[#5C574E] hover:text-[#111111] disabled:opacity-40 cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full gold-gradient-bg py-4 px-6 text-[11px] uppercase tracking-[0.22em] font-semibold rounded-xs cursor-pointer"
                >
                  Add to Cart · {formatAmount(effectivePriceCents * quantity)}
                </button>

                {addedNotice && (
                  <div className="flex items-center justify-between gap-3 p-3.5 bg-[#F7F3EC] border border-[#B89B5E] text-xs text-[#111111] rounded-xs">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#7A6230]" strokeWidth={2} />
                      <span>Added to your shopping bag.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(true)}
                      className="text-[#7A6230] font-semibold underline cursor-pointer shrink-0"
                    >
                      Open Bag
                    </button>
                  </div>
                )}
              </div>
            ) : isOutOfStock ? (
              <div className="p-5 bg-[#FAF7F2] border border-[#8E3A3A]/30 rounded-xs space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#8E3A3A] font-semibold">
                  Currently Out of Stock
                </p>
                <p className="text-xs text-[#5C574E] leading-relaxed">
                  This batch has sold out. Contact CEO Adnuel on WhatsApp for restock scheduling.
                </p>
                <a
                  href={`https://wa.me/2347015285932?text=${encodeURIComponent(
                    `Hello CEO Adnuel, when will ${product.title} be back in stock?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block pt-1 text-[11px] uppercase tracking-[0.18em] text-[#111111] border-b border-[#B89B5E] hover:text-[#7A6230]"
                >
                  Request Restock Update ↗
                </a>
              </div>
            ) : (
              <div className="p-4 bg-[#F7F3EC] border border-[#111111]/12 text-xs text-[#7A6230] rounded-xs">
                Available via private WhatsApp allocation (07015285932).
              </div>
            )}

            {/* Expandable Product Accordions */}
            <div className="pt-4 border-t border-[#111111]/10 divide-y divide-[#111111]/10">
              <div>
                <button
                  type="button"
                  aria-expanded={openAccordion === 'materials'}
                  onClick={() => toggleSection('materials')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#111111] font-medium">
                    Materials & Craft
                  </span>
                  <span className="text-[#7A6230]">
                    {openAccordion === 'materials' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {openAccordion === 'materials' && (
                  <p className="pb-4 text-xs text-[#5C574E] leading-relaxed">
                    Precision-finished exterior, reinforced stress points, and voltage-regulated hardware inspected prior to dispatch for long-term everyday performance.
                  </p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  aria-expanded={openAccordion === 'specs'}
                  onClick={() => toggleSection('specs')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#111111] font-medium">
                    Specifications
                  </span>
                  <span className="text-[#7A6230]">
                    {openAccordion === 'specs' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {openAccordion === 'specs' && (
                  <div className="pb-4 space-y-2 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5C574E]">Category</span>
                      <span className="text-[#111111] font-medium">{categoryLabel}</span>
                    </div>
                    {activeVariant?.sku && (
                      <div className="flex justify-between gap-4">
                        <span className="text-[#5C574E]">SKU</span>
                        <span className="text-[#111111] tabular-nums">{activeVariant.sku}</span>
                      </div>
                    )}
                    {Array.isArray(product.cjSpecs) &&
                      product.cjSpecs
                        .filter((s) => !s.label.toLowerCase().includes('cj product id'))
                        .slice(0, 6)
                        .map((spec) => (
                          <div key={spec.label} className="flex justify-between gap-4">
                            <span className="text-[#5C574E]">{spec.label}</span>
                            <span className="text-[#111111] text-right">{spec.value}</span>
                          </div>
                        ))}
                    <div className="flex justify-between gap-4">
                      <span className="text-[#5C574E]">Settlement</span>
                      <span className="text-[#111111]">Card (NGN / USD) & Bank Transfer</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  aria-expanded={openAccordion === 'delivery'}
                  onClick={() => toggleSection('delivery')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#111111] font-medium">
                    Worldwide Delivery & Transit
                  </span>
                  <span className="text-[#7A6230]">
                    {openAccordion === 'delivery' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {openAccordion === 'delivery' && (
                  <p className="pb-4 text-xs text-[#5C574E] leading-relaxed">
                    Tracked courier delivery worldwide, with regional transit arriving within 1–5 business days based on your chosen destination and complimentary domestic shipping on orders over ₦75,000 ($50).
                  </p>
                )}
              </div>

              <div>
                <button
                  type="button"
                  aria-expanded={openAccordion === 'returns'}
                  onClick={() => toggleSection('returns')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#111111] font-medium">
                    Returns & 12-Month Warranty
                  </span>
                  <span className="text-[#7A6230]">
                    {openAccordion === 'returns' ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                {openAccordion === 'returns' && (
                  <p className="pb-4 text-xs text-[#5C574E] leading-relaxed">
                    Every VANTÉRA piece carries a 12-month defect warranty and a 14-day return window managed directly inside your client account.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Pieces */}
      {related.length > 0 && (
        <section className="pt-12 border-t border-[#111111]/10 space-y-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-editorial text-2xl sm:text-3xl font-medium text-[#111111]">
              You May Also <em className="italic font-normal">Like</em>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(`/category/${mappedCatId}`)}
              className="text-[11px] uppercase tracking-[0.2em] text-[#7A6230] hover:text-[#111111] border-b border-[#B89B5E] pb-0.5 cursor-pointer"
            >
              View Category →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Sticky Bottom Add-to-Cart Bar positioned above the MobileBottomNav */}
      {!isReservedPhone && (
        <div
          className="lg:hidden fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 bg-[#F7F3EC]/95 backdrop-blur-md border-t border-[#111111]/10 px-4 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="font-editorial text-sm font-medium text-[#111111] truncate">{product.title}</p>
            <p className="text-xs font-medium text-[#7A6230] tabular-nums">
              {formatAmount(effectivePriceCents * quantity)}
            </p>
          </div>
          {!isOutOfStock ? (
            <button
              type="button"
              onClick={handleAddToCart}
              className="gold-gradient-bg px-5 py-2.5 min-h-[42px] text-[10px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer shrink-0"
            >
              Add to Cart
            </button>
          ) : (
            <span className="px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#8E3A3A] border border-[#8E3A3A]/30 rounded-xs shrink-0">
              Out of Stock
            </span>
          )}
        </div>
      )}

      {/* Clean Interactive Image Zoom Lightbox */}
      {isZoomOpen && displayImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${product.title} enlarged photograph`}
          onClick={() => setIsZoomOpen(false)}
          className="vantera-overlay-fade fixed inset-0 z-50 bg-[#111111]/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            aria-label="Close zoom view"
            className="absolute top-6 right-6 text-[#F7F3EC] hover:text-[#B89B5E] p-2 cursor-pointer"
          >
            <X className="w-6 h-6" strokeWidth={1.5} />
          </button>
          <img
            src={displayImage}
            alt={product.imageAlt || product.title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain cursor-default"
          />
        </div>
      )}
    </div>
  );
};
