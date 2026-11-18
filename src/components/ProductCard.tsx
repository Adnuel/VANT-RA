import React, { useState, useRef } from 'react';
import { Heart, Check } from 'lucide-react';
import { Product, CATEGORIES } from '../data/catalog.ts';
import { getCuratedCategoryById, mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { wrapGalleryIndex } from '../lib/storefrontHelpers.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useWishlist } from '../contexts/WishlistContext.tsx';
import { trackEvent } from '../lib/tracker.ts';
import { LuxuryImage } from './LuxuryImage.tsx';

interface ProductCardProps {
  product: Product;
  onNavigate: (url: string) => void;
  onQuickView?: (product: Product) => void;
}

export const ProductCardSkeleton: React.FC = () => (
  <div className="flex flex-col bg-[#FAF7F2] border border-[#111111]/8 rounded-xs overflow-hidden">
    <div className="aspect-square w-full vantera-shimmer" />
    <div className="p-5 sm:p-6 space-y-4">
      <div className="space-y-2">
        <div className="h-3 w-24 vantera-shimmer rounded-xs" />
        <div className="h-5 w-4/5 vantera-shimmer rounded-xs" />
        <div className="h-5 w-3/5 vantera-shimmer rounded-xs" />
      </div>
      <div className="pt-4 border-t border-[#111111]/8 flex items-center justify-between">
        <div className="h-5 w-20 vantera-shimmer rounded-xs" />
        <div className="h-9 w-28 vantera-shimmer rounded-xs" />
      </div>
    </div>
  </div>
);

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate, onQuickView }) => {
  const { addToCart } = useCart();
  const { formatAmount } = useCurrency();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [swipeIndex, setSwipeIndex] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  const firstAvailableVariant = hasVariants
    ? product.variants!.find((v) => v.isAvailable && v.stockQuantity > 0)
    : undefined;
  const isOutOfStock =
    !product.isAvailable ||
    product.stockQuantity <= 0 ||
    product.availability === 'out_of_stock' ||
    (hasVariants && !firstAvailableVariant);
  const isReservedPhone = product.category === 'phones';
  const isLowStock = !isOutOfStock && product.stockQuantity > 0 && product.stockQuantity <= 5;
  const saved = isInWishlist(product.id);

  // Build deduplicated image list for hover/swipe second image reveal
  const cardImages = React.useMemo(() => {
    const list: string[] = [];
    if (product.image) list.push(product.image);
    if (Array.isArray(product.galleryImages)) {
      for (const img of product.galleryImages) {
        if (img && !list.includes(img)) list.push(img);
      }
    }
    if (list.length === 0) {
      list.push('/products/charging-phone-stand.jpg');
    }
    return list;
  }, [product.image, product.galleryImages]);

  const primaryImage = cardImages[swipeIndex] || cardImages[0];
  const secondaryImage = cardImages.length > 1 ? cardImages[(swipeIndex + 1) % cardImages.length] : null;

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    trackEvent('product_viewed', {
      productId: product.id,
      productTitle: product.title,
      category: product.category,
    });
    onNavigate(`/product/${product.slug}`);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (cardImages.length <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    didSwipeRef.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || cardImages.length <= 1) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 32) {
      didSwipeRef.current = true;
      setSwipeIndex((prev) => wrapGalleryIndex(prev, diff > 0 ? 1 : -1, cardImages.length));
    }
    touchStartXRef.current = null;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReservedPhone || isOutOfStock) return;
    addToCart(product, 1, firstAvailableVariant);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    } else {
      onNavigate(`/product/${product.slug}`);
    }
  };

  const mappedCatId = mapLegacyCategoryToCurated(product.category);
  const curatedCat = getCuratedCategoryById(String(mappedCatId));
  const categoryObj = CATEGORIES.find((c) => c.id === mappedCatId || c.id === product.category);
  const categoryLabel = curatedCat?.shortLabel || categoryObj?.label || product.category.replace(/-/g, ' ');
  const statusNote = isOutOfStock
    ? 'Out of stock'
    : isLowStock
    ? 'Low stock'
    : product.trending
    ? 'Featured'
    : null;

  return (
    <article
      onClick={handleCardClick}
      className="group flex flex-col justify-between bg-[#FAF7F2] zero-border-card text-[#111111] hover:-translate-y-1 cursor-pointer overflow-hidden rounded-xs"
    >
      {/* Uniform Square Studio Frame on Clean Uniform Warm-Neutral Backdrop */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative aspect-square w-full overflow-hidden bg-[#EFEAE0] border-b border-[#111111]/8"
      >
        <LuxuryImage
          src={primaryImage}
          alt={product.imageAlt || product.title}
          wrapperClassName="w-full h-full"
          className={`h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.04] ${
            isOutOfStock ? 'opacity-45 grayscale-[30%]' : ''
          }`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Second Image Cross-Fade on Desktop Hover */}
        {secondaryImage && !isOutOfStock && (
          <img
            src={secondaryImage}
            alt=""
            aria-hidden="true"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="hidden sm:block absolute inset-0 z-10 h-full w-full object-cover object-center opacity-0 group-hover:opacity-100 group-hover:scale-[1.04] transition-all duration-700 ease-out pointer-events-none"
          />
        )}

        {/* Mobile Multi-Photo Dots Indicator */}
        {cardImages.length > 1 && (
          <div className="sm:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-1 bg-[#F7F3EC]/80 backdrop-blur-xs rounded-full">
            {cardImages.slice(0, 4).map((_, idx) => (
              <span
                key={idx}
                className={`block w-1.5 h-1.5 rounded-full transition-colors ${
                  swipeIndex % Math.min(4, cardImages.length) === idx
                    ? 'bg-[#B89B5E]'
                    : 'bg-[#111111]/25'
                }`}
              />
            ))}
          </div>
        )}

        {/* Thin-Stroke Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className={`absolute top-3 right-3 z-20 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xs border transition-colors cursor-pointer ${
            saved
              ? 'bg-[#F7F3EC]/95 border-[#B89B5E] text-[#B89B5E]'
              : 'bg-[#F7F3EC]/85 backdrop-blur-xs border-[#111111]/12 text-[#5C574E] hover:text-[#111111] hover:border-[#B89B5E]'
          }`}
        >
          <Heart className="w-4 h-4" strokeWidth={1.5} fill={saved ? 'currentColor' : 'none'} />
        </button>

        {onQuickView && (
          <button
            type="button"
            onClick={handleQuickViewClick}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 absolute bottom-3 right-3 z-20 bg-[#F7F3EC]/92 backdrop-blur-xs text-[#111111] border border-[#111111]/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded-xs hover:border-[#B89B5E] hover:text-[#7A6230] cursor-pointer whitespace-nowrap"
          >
            Quick View
          </button>
        )}
      </div>

      {/* Metadata & Pricing */}
      <div className="flex flex-1 flex-col justify-between p-5 sm:p-6 gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#5C574E]">
            <span>{categoryLabel}</span>
            {statusNote && (
              <>
                <span aria-hidden="true">·</span>
                <span className={isOutOfStock ? 'text-[#8E3A3A] font-medium' : 'text-[#7A6230] font-medium'}>
                  {statusNote}
                </span>
              </>
            )}
          </div>

          <h3 className="font-editorial text-lg font-medium text-[#111111] group-hover:text-[#7A6230] transition-colors leading-snug line-clamp-2 min-h-[3rem]">
            {product.title}
          </h3>
        </div>

        {/* Price & Prominent Action */}
        <div className="pt-4 border-t border-[#111111]/8 flex items-center justify-between gap-3">
          <div className="text-base font-medium text-[#111111] tabular-nums whitespace-nowrap">
            {formatAmount(product.retailPriceCents)}
          </div>

          {!isReservedPhone && !isOutOfStock ? (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Add ${product.title} to shopping bag`}
              className={`px-4 py-2.5 min-h-[40px] text-[10px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer shrink-0 whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
                justAdded
                  ? 'bg-[#111111] text-[#F7F3EC]'
                  : 'gold-gradient-bg'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#B89B5E]" strokeWidth={2} />
                  <span>Added</span>
                </>
              ) : (
                <span>Add to Cart</span>
              )}
            </button>
          ) : isOutOfStock ? (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#8E3A3A] whitespace-nowrap">
              Out of Stock
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#7A6230] whitespace-nowrap">
              View Details
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
