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
  const { addToCart } = useCart();
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

  // Curated color finishes with luxury naming
  const colorSwatches: Record<string, { name: string; hex: string }[]> = {
    'phone-cases': [
      { name: 'Titanium Noir', hex: '#1e1e1e' },
      { name: 'Champagne Gold', hex: '#d4af37' },
      { name: 'Silver Frost', hex: '#e5e7eb' },
    ],
    'charging': [
      { name: 'Obsidian Matte', hex: '#0b0b0b' },
      { name: 'Pure Chalk', hex: '#f8fafc' },
    ],
    'audio': [
      { name: 'Phantom Black', hex: '#141414' },
      { name: 'Titanium Silver', hex: '#94a3b8' },
    ],
    'room-desk': [
      { name: 'Space Gray', hex: '#374151' },
      { name: 'Raw Aluminum', hex: '#d1d5db' },
    ],
    'photography': [
      { name: 'Matte Stealth', hex: '#141414' },
      { name: 'Brushed Alloy', hex: '#71717a' },
    ],
  };

  const swatches = colorSwatches[product.category] || [
    { name: 'Obsidian Noir', hex: '#141414' },
    { name: 'Champagne Alloy', hex: '#d4af37' },
  ];

  return (
    <article
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col justify-between bg-[#111111]/90 zero-border-card text-[#EDEDED] transition-all duration-500 hover:shadow-[0_25px_50px_rgba(15,46,34,0.3)] hover:-translate-y-1 cursor-pointer overflow-hidden rounded-xs"
    >
      {/* Top Visual Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#0a0a0a] flex items-center justify-center p-3 sm:p-7">
        <div className="absolute inset-0 bg-radial from-[#151515] to-[#080808] opacity-80" />
        
        {product.image ? (
          <img
            src={product.image}
            alt={product.imageAlt || product.title}
            className="relative z-10 h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-108"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
            }}
          />
        ) : (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center bg-[#141414] p-4 text-center text-[#77746d]">
            <div className="mb-2 text-3xl font-editorial text-[#D4AF37]">V</div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-meta text-[#A0A09A]">VANTÉRA ATELIER</span>
          </div>
        )}

        {/* Hover Quick View / Tech Specs Bar */}
        <div
          className={`absolute inset-x-2 sm:inset-x-4 bottom-2 sm:bottom-4 transition-all duration-300 z-20 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={handleQuickViewClick}
            className="w-full bg-[#0B0B0B]/95 backdrop-blur-md text-[#D4AF37] border border-[#D4AF37]/30 py-2 sm:py-2.5 text-[9px] sm:text-[10px] font-meta uppercase tracking-[0.2em] font-medium hover:bg-[#D4AF37] hover:text-[#0B0B0B] transition-colors rounded-xs shadow-xl flex items-center justify-center gap-1.5"
          >
            <span>Dossier</span>
            <span>↗</span>
          </button>
        </div>
      </div>

      {/* Product Body */}
      <div className="flex flex-1 flex-col justify-between p-3 space-y-2.5">
        <div>
          {/* Zero-Pill Unboxed Category Kicker */}
          <div className="text-[9px] font-meta tracking-[0.12em] uppercase text-[#73736E] flex items-center gap-1 mb-1 flex-wrap">
            <span>{product.category.replace('-', ' ')}</span>
            {product.festiveHolidayTag ? (
              <>
                <span aria-hidden="true" className="text-[#D4AF37]">·</span>
                <span className="text-[#D4AF37] font-semibold">★ {product.festiveHolidayTag}</span>
              </>
            ) : product.trending ? (
              <>
                <span aria-hidden="true" className="text-[#D4AF37]">·</span>
                <span className="text-[#D4AF37]">Flagship</span>
              </>
            ) : null}
          </div>

          <h3 className="font-editorial text-[13px] font-semibold text-[#F5F5F0] group-hover:text-[#D4AF37] transition-colors leading-snug line-clamp-2 break-words">
            {product.title}
          </h3>

          <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-[#8E8E88] font-meta font-light break-words">
            {product.description}
          </p>

          {/* Interactive Finish Dots */}
          <div className="pt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {swatches.map((swatch, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFinishIndex(idx);
                  }}
                  className={`w-2.5 h-2.5 rounded-full border border-white/20 transition-all ${
                    selectedFinishIndex === idx
                      ? 'scale-125 ring-1 ring-[#D4AF37] ring-offset-1 ring-offset-[#0B0B0B]'
                      : 'hover:scale-110 opacity-60 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                  title={swatch.name}
                />
              ))}
            </div>
            <span className="text-[8px] font-meta tracking-wider text-[#73736E] truncate max-w-[80px] uppercase">
              {swatches[selectedFinishIndex]?.name}
            </span>
          </div>
        </div>

        {/* Price & Action Row */}
        <div className="pt-2 flex items-center justify-between gap-1.5 border-t border-white/5">
          <div className="min-w-0">
            <span className="text-[8px] uppercase tracking-wider text-[#73736E] font-meta block truncate">
              {product.referencePriceCents && product.referencePriceCents > product.retailPriceCents
                ? 'Privé Reserve'
                : currency}
            </span>
            <div className="text-[13px] font-editorial font-bold text-[#D4AF37] truncate">
              {formatAmount(product.retailPriceCents)}
            </div>
          </div>

          {product.category !== 'phones' && product.isAvailable ? (
            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={`Add ${product.title} to shopping bag`}
              className="gold-gradient-bg text-[#0B0B0B] px-2 py-1 text-[9px] font-meta font-bold uppercase tracking-wider hover:brightness-110 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0 rounded-xs"
            >
              <span>Acquire</span>
            </button>
          ) : (
            <span className="text-[9px] text-[#555550] font-meta uppercase tracking-wider italic">
              Reserved
            </span>
          )}
        </div>
      </div>
    </article>
  );
};
