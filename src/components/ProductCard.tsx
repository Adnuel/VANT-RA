import React from 'react';
import { Product, CATEGORIES } from '../data/catalog.ts';
import { getCuratedCategoryById, mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useWishlist } from '../contexts/WishlistContext.tsx';
import { trackEvent } from '../lib/tracker.ts';

interface ProductCardProps {
  product: Product;
  onNavigate: (url: string) => void;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate, onQuickView }) => {
  const { addToCart } = useCart();
  const { formatAmount } = useCurrency();
  const { isInWishlist, toggleWishlist } = useWishlist();

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

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    trackEvent('product_viewed', {
      productId: product.id,
      productTitle: product.title,
      category: product.category,
    });
    onNavigate(`/product/${product.slug}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReservedPhone || isOutOfStock) return;
    addToCart(product, 1, firstAvailableVariant);
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
      className="group flex flex-col justify-between bg-[#141416] zero-border-card text-[#F5F1E8] hover:-translate-y-0.5 cursor-pointer overflow-hidden rounded-xs"
    >
      {/* Uniform Square Studio Image Frame */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#101012] border-b border-white/6">
        {product.image ? (
          <img
            src={product.image}
            alt={product.imageAlt || product.title}
            className={`relative z-10 h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
              isOutOfStock ? 'opacity-45' : ''
            }`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
            }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-center text-[#A8A297]">
            <span className="text-4xl font-editorial text-[#C8A96A]">V</span>
          </div>
        )}

        {/* Thin-Stroke Wishlist Button */}
        <button
          type="button"
          onClick={handleWishlistClick}
          aria-label={saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`}
          className={`absolute top-3.5 right-3.5 z-20 p-2 rounded-xs border transition-colors cursor-pointer ${
            saved
              ? 'bg-[#C8A96A]/15 border-[#C8A96A]/50 text-[#C8A96A]'
              : 'bg-[#0B0B0C]/70 border-white/10 text-[#A8A297] hover:text-[#F5F1E8] hover:border-white/25'
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

        {onQuickView && (
          <button
            type="button"
            onClick={handleQuickViewClick}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-200 absolute bottom-3.5 right-3.5 z-20 bg-[#0B0B0C]/90 text-[#F5F1E8] border border-white/15 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] rounded-xs hover:border-[#C8A96A] hover:text-[#C8A96A] cursor-pointer whitespace-nowrap"
          >
            Quick View
          </button>
        )}
      </div>

      {/* Metadata & Pricing */}
      <div className="flex flex-1 flex-col justify-between p-6 gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#A8A297]">
            <span>{categoryLabel}</span>
            {statusNote && (
              <>
                <span aria-hidden="true">·</span>
                <span className={isOutOfStock ? 'text-[#E57373]' : 'text-[#C8A96A]'}>
                  {statusNote}
                </span>
              </>
            )}
          </div>

          <h3 className="font-editorial text-lg font-medium text-[#F5F1E8] group-hover:text-[#C8A96A] transition-colors leading-snug line-clamp-2 min-h-[3rem]">
            {product.title}
          </h3>
        </div>

        {/* Price & Prominent Action */}
        <div className="pt-4 border-t border-white/6 flex items-center justify-between gap-3">
          <div className="text-base font-medium text-[#F5F1E8] tabular-nums whitespace-nowrap">
            {formatAmount(product.retailPriceCents)}
          </div>

          {!isReservedPhone && !isOutOfStock ? (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Add ${product.title} to shopping bag`}
              className="gold-gradient-bg px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer shrink-0 whitespace-nowrap"
            >
              Add to Cart
            </button>
          ) : isOutOfStock ? (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#A8A297] whitespace-nowrap">
              Out of Stock
            </span>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#C8A96A] whitespace-nowrap">
              View Details
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
