import React, { useState, useEffect } from 'react';
import { Product, CATEGORIES } from '../data/catalog.ts';
import { mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useWishlist } from '../contexts/WishlistContext.tsx';
import { ProductCard } from '../components/ProductCard.tsx';
import { trackEvent } from '../lib/tracker.ts';

interface ProductPageProps {
  productSlug: string;
  products: Product[];
  onNavigate: (url: string) => void;
}

export const ProductPage: React.FC<ProductPageProps> = ({ productSlug, products, onNavigate }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState('Obsidian Noir');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState(false);
  const [activeView, setActiveView] = useState<'studio' | 'detail' | 'angle'>('studio');
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<'materials' | 'delivery' | 'returns' | 'specs' | null>(
    'materials'
  );

  const product = products.find((p) => p.slug === productSlug || p.id === productSlug);

  useEffect(() => {
    setQuantity(1);
    setAddedNotice(false);
    setActiveView('studio');
    setIsZoomOpen(false);
    if (product) {
      const firstAvail =
        product.variants && product.variants.length > 0
          ? product.variants.find((v) => v.isAvailable && v.stockQuantity > 0) || product.variants[0]
          : null;
      setSelectedVariantId(firstAvail?.id || null);
      setSelectedGalleryImage(firstAvail?.image || product.image || null);
      trackEvent('product_viewed', {
        productId: product.id,
        productTitle: product.title,
        category: product.category,
        retailPriceCents: firstAvail?.retailPriceCents ?? product.retailPriceCents,
      });
    } else {
      setSelectedVariantId(null);
      setSelectedGalleryImage(null);
    }
  }, [product?.id]);

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-28 text-center space-y-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#C8A96A]">Unavailable</p>
        <h1 className="text-3xl font-editorial font-medium text-[#F5F1E8]">Product Not Found</h1>
        <p className="text-sm text-[#A8A297]">
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
  const displayImage = selectedGalleryImage || activeVariant?.image || product.image;
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
    .filter((p) => mapLegacyCategoryToCurated(p.category) === mappedCatId && p.id !== product.id)
    .slice(0, 3);

  const handleAddToCart = () => {
    if (isReservedPhone || isOutOfStock) return;
    addToCart(product, quantity, activeVariant || undefined);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3500);
  };

  const finishes = [
    { name: 'Obsidian Noir', hex: '#141416' },
    { name: 'Champagne Gold', hex: '#C8A96A' },
    { name: 'Slate Gray', hex: '#4B5563' },
    { name: 'Brushed Silver', hex: '#E5E7EB' },
  ];

  const views: Array<{ id: 'studio' | 'detail' | 'angle'; label: string; imgClass: string }> = [
    { id: 'studio', label: 'Studio Front', imgClass: 'object-contain scale-100' },
    { id: 'detail', label: 'Finish Macro', imgClass: 'object-contain scale-[1.38] origin-center' },
    { id: 'angle', label: 'Silhouette Crop', imgClass: 'object-contain scale-[1.25] origin-top-left' },
  ];
  const currentView = views.find((v) => v.id === activeView) || views[0];

  const toggleSection = (key: 'materials' | 'delivery' | 'returns' | 'specs') => {
    setOpenAccordion((prev) => (prev === key ? null : key));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 lg:py-16 space-y-20">
      {/* Breadcrumb Trail */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#A8A297] flex-wrap"
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="hover:text-[#F5F1E8] transition-colors"
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
          className="hover:text-[#F5F1E8] transition-colors"
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
          className="hover:text-[#F5F1E8] transition-colors"
        >
          {categoryLabel}
        </a>
        <span aria-hidden="true">/</span>
        <span className="text-[#F5F1E8] truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main 2-Column Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        {/* Left: Uniform Studio Viewer & Multi-Angle Framing Strip */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative bg-[#141416] border border-white/8 aspect-square w-full flex items-center justify-center p-8 sm:p-14 rounded-xs overflow-hidden group">
            {displayImage ? (
              <img
                src={displayImage}
                alt={product.imageAlt || product.title}
                onClick={() => setIsZoomOpen(true)}
                className={`max-h-full max-w-full cursor-zoom-in transition-transform duration-500 ease-out ${currentView.imgClass} ${
                  isOutOfStock ? 'opacity-50' : ''
                }`}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
                }}
              />
            ) : (
              <span className="font-editorial text-5xl text-[#C8A96A]">V</span>
            )}

            <button
              type="button"
              onClick={() => setIsZoomOpen(true)}
              aria-label="Enlarge product photograph"
              className="absolute bottom-4 right-4 bg-[#0B0B0C]/85 border border-white/12 text-[#F5F1E8] hover:border-[#C8A96A] hover:text-[#C8A96A] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded-xs transition-colors cursor-pointer"
            >
              Zoom View
            </button>
          </div>

          {/* Uniform Framing Strip or Product Gallery */}
          {Array.isArray(product.galleryImages) && product.galleryImages.length > 1 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
              {product.galleryImages.slice(0, 6).map((imgUrl, idx) => (
                <button
                  key={`${imgUrl}-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveView('studio');
                    setSelectedGalleryImage(imgUrl);
                  }}
                  aria-label={`View gallery photo ${idx + 1}`}
                  className={`bg-[#141416] border rounded-xs overflow-hidden p-2 aspect-square flex items-center justify-center transition-colors cursor-pointer ${
                    displayImage === imgUrl
                      ? 'border-[#C8A96A]'
                      : 'border-white/8 hover:border-white/25'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${product.title} — View ${idx + 1}`}
                    className="h-full w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {views.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setActiveView(view.id)}
                  className={`bg-[#141416] border rounded-xs overflow-hidden p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                    activeView === view.id
                      ? 'border-[#C8A96A]'
                      : 'border-white/8 hover:border-white/25'
                  }`}
                >
                  <div className="aspect-square w-full max-h-20 bg-[#0B0B0C] flex items-center justify-center overflow-hidden p-2">
                    <img
                      src={displayImage || '/products/charging-phone-stand.jpg'}
                      alt={`${product.title} — ${view.label}`}
                      className={`h-full w-full ${view.imgClass}`}
                    />
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[#A8A297]">
                    {view.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Calm Purchase & Accordion Details Column */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-8">
          <div className="bg-[#141416] border border-white/8 p-6 sm:p-8 rounded-xs space-y-6">
            <div className="space-y-3 border-b border-white/8 pb-6">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#A8A297]">
                <span>{categoryLabel}</span>
                <span className={isOutOfStock ? 'text-[#E57373]' : 'text-[#C8A96A]'}>
                  {isOutOfStock
                    ? 'Out of stock'
                    : effectiveStock <= 5
                    ? 'Low stock'
                    : 'In stock'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[#F5F1E8] leading-tight text-balance">
                  {product.title}
                </h1>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`p-2 rounded-xs border transition-colors cursor-pointer shrink-0 ${
                    saved
                      ? 'border-[#C8A96A] text-[#C8A96A] bg-[#C8A96A]/10'
                      : 'border-white/12 text-[#A8A297] hover:text-[#F5F1E8]'
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill={saved ? 'currentColor' : 'none'}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-baseline gap-3 pt-2">
                <span className="text-2xl sm:text-3xl font-medium text-[#C8A96A] tabular-nums">
                  {formatAmount(effectivePriceCents)}
                </span>
                {product.referencePriceCents && product.referencePriceCents > effectivePriceCents && (
                  <span className="text-sm text-[#A8A297] line-through tabular-nums">
                    {formatAmount(product.referencePriceCents)}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#A8A297] ml-auto">
                  {currency}
                </span>
              </div>
            </div>

            <p className="text-sm text-[#A8A297] leading-relaxed">{product.description}</p>

            {/* Real Variants or Finish Swatches */}
            {productVariants ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                  <span className="text-[#A8A297]">Edition / Variant</span>
                  <span className="text-[#F5F1E8]">{activeVariant?.name}</span>
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
                            setSelectedGalleryImage(variant.image);
                          }
                        }}
                        className={`px-3 py-2 text-[11px] rounded-xs border transition-colors cursor-pointer text-left ${
                          variantSelected
                            ? 'border-[#C8A96A] bg-[#C8A96A]/10 text-[#F5F1E8]'
                            : 'border-white/12 bg-[#0B0B0C] text-[#A8A297] hover:border-white/30 hover:text-[#F5F1E8]'
                        } ${variantOutOfStock ? 'opacity-50' : ''}`}
                      >
                        <span className="block font-medium">{variant.name}</span>
                        <span className="block text-[9px] uppercase tracking-wider text-[#A8A297]">
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
                  <span className="text-[#A8A297]">Finish</span>
                  <span className="text-[#F5F1E8]">{selectedFinish}</span>
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
                          ? 'border-[#C8A96A] ring-2 ring-[#C8A96A]/40 ring-offset-2 ring-offset-[#141416]'
                          : 'border-white/15 opacity-75 hover:opacity-100'
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
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[#A8A297]">
                    Quantity
                  </span>
                  <div className="inline-flex items-center border border-white/12 rounded-xs bg-[#0B0B0C]">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3.5 py-2 text-sm text-[#A8A297] hover:text-[#F5F1E8] cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="px-4 text-sm font-medium text-[#F5F1E8] tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      disabled={quantity >= effectiveStock}
                      onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
                      className="px-3.5 py-2 text-sm text-[#A8A297] hover:text-[#F5F1E8] disabled:opacity-40 cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      +
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
                  <div className="flex items-center justify-between gap-3 p-3.5 bg-[#0F2E22] border border-[#2E9B6B]/40 text-xs text-[#F5F1E8] rounded-xs">
                    <span>Added to your shopping bag.</span>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(true)}
                      className="text-[#C8A96A] font-semibold underline cursor-pointer shrink-0"
                    >
                      Open Bag
                    </button>
                  </div>
                )}
              </div>
            ) : isOutOfStock ? (
              <div className="p-5 bg-[#1B1212] border border-[#E57373]/25 rounded-xs space-y-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#E57373] font-semibold">
                  Currently Out of Stock
                </p>
                <p className="text-xs text-[#A8A297] leading-relaxed">
                  This batch has sold out. Contact CEO Adnuel on WhatsApp for restock scheduling.
                </p>
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello CEO Adnuel, when will ${product.title} be back in stock?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block pt-1 text-[11px] uppercase tracking-[0.18em] text-[#C8A96A] hover:underline"
                >
                  Request Restock Update ↗
                </a>
              </div>
            ) : (
              <div className="p-4 bg-[#0B0B0C] border border-white/10 text-xs text-[#C8A96A] rounded-xs">
                Available via private WhatsApp allocation (+234 913 279 3670).
              </div>
            )}

            {/* Expandable Product Accordions */}
            <div className="pt-4 border-t border-white/8 divide-y divide-white/8">
              <div>
                <button
                  type="button"
                  aria-expanded={openAccordion === 'materials'}
                  onClick={() => toggleSection('materials')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer"
                >
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#F5F1E8] font-medium">
                    Materials & Craft
                  </span>
                  <span className="text-[#C8A96A] text-sm">{openAccordion === 'materials' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'materials' && (
                  <p className="pb-4 text-xs text-[#A8A297] leading-relaxed">
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
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#F5F1E8] font-medium">
                    Specifications
                  </span>
                  <span className="text-[#C8A96A] text-sm">{openAccordion === 'specs' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'specs' && (
                  <div className="pb-4 space-y-2 text-xs">
                    <div className="flex justify-between gap-4">
                      <span className="text-[#A8A297]">Category</span>
                      <span className="text-[#F5F1E8]">{categoryLabel}</span>
                    </div>
                    {activeVariant?.sku && (
                      <div className="flex justify-between gap-4">
                        <span className="text-[#A8A297]">SKU</span>
                        <span className="text-[#F5F1E8] font-mono">{activeVariant.sku}</span>
                      </div>
                    )}
                    {Array.isArray(product.cjSpecs) &&
                      product.cjSpecs
                        .filter((s) => !s.label.toLowerCase().includes('cj product id'))
                        .slice(0, 6)
                        .map((spec) => (
                          <div key={spec.label} className="flex justify-between gap-4">
                            <span className="text-[#A8A297]">{spec.label}</span>
                            <span className="text-[#F5F1E8] text-right">{spec.value}</span>
                          </div>
                        ))}
                    <div className="flex justify-between gap-4">
                      <span className="text-[#A8A297]">Settlement</span>
                      <span className="text-[#F5F1E8]">Card (NGN / USD) & Bank Transfer</span>
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
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#F5F1E8] font-medium">
                    Delivery & State Transit
                  </span>
                  <span className="text-[#C8A96A] text-sm">{openAccordion === 'delivery' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'delivery' && (
                  <p className="pb-4 text-xs text-[#A8A297] leading-relaxed">
                    Lagos delivery arrives in 1–2 business days (₦2,500). Other Nigerian states take 2–5 business days (₦3,500–₦5,000), and orders over ₦75,000 ($50) qualify for complimentary domestic shipping.
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
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[#F5F1E8] font-medium">
                    Returns & 12-Month Warranty
                  </span>
                  <span className="text-[#C8A96A] text-sm">{openAccordion === 'returns' ? '−' : '+'}</span>
                </button>
                {openAccordion === 'returns' && (
                  <p className="pb-4 text-xs text-[#A8A297] leading-relaxed">
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
        <section className="pt-12 border-t border-white/8 space-y-10">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-editorial text-2xl sm:text-3xl font-medium text-[#F5F1E8]">
              You May Also Like
            </h2>
            <button
              type="button"
              onClick={() => onNavigate(`/category/${mappedCatId}`)}
              className="text-[11px] uppercase tracking-[0.2em] text-[#C8A96A] hover:underline cursor-pointer"
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

      {/* Clean Interactive Image Zoom Lightbox */}
      {isZoomOpen && displayImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${product.title} enlarged photograph`}
          onClick={() => setIsZoomOpen(false)}
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-10 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setIsZoomOpen(false)}
            aria-label="Close zoom view"
            className="absolute top-6 right-6 text-[#F5F1E8] hover:text-[#C8A96A] text-xl p-2 cursor-pointer"
          >
            ✕
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
