import React, { useState } from 'react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { trackEvent } from '../lib/tracker.ts';

interface ProductCardProps {
  product: Product;
  onNavigate: (url: string) => void;
  onQuickView?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onNavigate, onQuickView }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();
  const [selectedFinishIndex, setSelectedFinishIndex] = useState<number>(0);
  const [isHovered, setIsHovered] = useState<boolean>(false);

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
    if (product.category === 'phones' || !product.isAvailable) return;
    addToCart(product, 1);
  };

  const handleQuickViewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    } else {
      onNavigate(`/product/${product.slug}`);
    }
  };

  // Curated color finishes for Samsung-inspired visual finish options
  const colorSwatches: Record<string, { name: string; hex: string }[]> = {
    'phone-cases': [
      { name: 'Titanium Noir', hex: '#1e1e1e' },
      { name: 'Desert Gold', hex: '#d4af37' },
      { name: 'Silver Frost', hex: '#e5e7eb' },
    ],
    'charging': [
      { name: 'Obsidian Matte', hex: '#0f172a' },
      { name: 'Pure Chalk', hex: '#f8fafc' },
    ],
    'audio': [
      { name: 'Phantom Black', hex: '#18181b' },
      { name: 'Titanium Silver', hex: '#94a3b8' },
    ],
    'room-desk': [
      { name: 'Space Gray', hex: '#4b5563' },
      { name: 'Raw Aluminum', hex: '#d1d5db' },
    ],
    'photography': [
      { name: 'Matte Stealth', hex: '#18181b' },
      { name: 'Brushed Alloy', hex: '#71717a' },
    ],
  };

  const swatches = colorSwatches[product.category] || [
    { name: 'Matte Black', hex: '#18181b' },
    { name: 'Anodized Silver', hex: '#d4d4d8' },
  ];

  return (
    <article
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col justify-between border border-[#e7e4de] bg-white transition-all duration-300 hover:border-[#121210] hover:shadow-xl cursor-pointer rounded-xs overflow-hidden"
    >
      {/* Top Visual Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#f4f2ee] flex items-center justify-center p-6">
        {product.image ? (
          <img
            src={product.image}
            alt={product.imageAlt || product.title}
            className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#eae7e0] p-6 text-center text-[#77746d]">
            <div className="mb-2 text-3xl font-serif text-[#c4a66b]">V</div>
            <span className="text-[10px] uppercase tracking-wider font-mono">VANTÉRA Craft</span>
          </div>
        )}

        {/* Hover Quick View / Tech Specs Bar (Samsung Luxury Action) */}
        <div
          className={`absolute inset-x-3 bottom-3 transition-all duration-200 z-20 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={handleQuickViewClick}
            className="w-full bg-[#121210]/95 backdrop-blur-md text-[#f8f7f4] py-2 text-[11px] font-mono uppercase tracking-wider font-bold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors rounded-xs shadow-md flex items-center justify-center gap-1.5"
          >
            <span>Tech Specs & Quick View</span>
            <span>↗</span>
          </button>
        </div>
      </div>

      {/* Product Body */}
      <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
        <div>
          {/* Zero-Pill Unboxed Category Kicker */}
          <div className="text-[10px] font-mono tracking-widest uppercase text-[#77746d] flex items-center gap-1.5 mb-1.5">
            <span>{product.category.replace('-', ' ')}</span>
            {product.festiveHolidayTag ? (
              <>
                <span aria-hidden="true" className="text-[#c4a66b]">·</span>
                <span className="text-[#9d8048] font-bold">★ {product.festiveHolidayTag}</span>
              </>
            ) : product.trending ? (
              <>
                <span aria-hidden="true" className="text-[#c4a66b]">·</span>
                <span className="text-[#9d8048] font-bold">Flagship Edit</span>
              </>
            ) : null}
          </div>

          <h3 className="text-sm font-bold text-[#121210] group-hover:text-[#c4a66b] transition-colors leading-snug line-clamp-2">
            {product.title}
          </h3>

          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#77746d]">
            {product.description}
          </p>

          {/* Interactive Finish Dots */}
          <div className="pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {swatches.map((swatch, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFinishIndex(idx);
                  }}
                  className={`w-3.5 h-3.5 rounded-full border border-gray-300 transition-all ${
                    selectedFinishIndex === idx
                      ? 'scale-125 ring-1 ring-[#121210] ring-offset-1'
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.name}
                />
              ))}
            </div>
            <span className="text-[10px] font-mono text-[#77746d] truncate max-w-[120px]">
              {swatches[selectedFinishIndex]?.name}
            </span>
          </div>
        </div>

        {/* Price & Action Row */}
        <div className="pt-3 border-t border-[#e7e4de] flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wider text-[#77746d] font-mono">
                {product.referencePriceCents && product.referencePriceCents > product.retailPriceCents
                  ? 'Festive Deal'
                  : `Price (${currency})`}
              </span>
              {product.referencePriceCents && product.referencePriceCents > product.retailPriceCents && (
                <span className="text-[9px] font-mono line-through text-[#a9a69f]">
                  {formatAmount(product.referencePriceCents)}
                </span>
              )}
            </div>
            <div className="text-base font-extrabold text-[#121210] font-sans">
              {formatAmount(product.retailPriceCents)}
            </div>
          </div>

          {product.category !== 'phones' && product.isAvailable ? (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Add ${product.title} to shopping cart`}
              className="inline-flex items-center gap-1.5 bg-[#121210] text-[#f8f7f4] px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-all hover:bg-[#c4a66b] hover:text-[#121210] cursor-pointer shadow-xs active:scale-95"
            >
              <span>Add</span>
              <span aria-hidden="true" className="text-sm leading-none">+</span>
            </button>
          ) : (
            <span className="text-xs text-[#a9a69f] font-mono italic">
              Coming Soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
