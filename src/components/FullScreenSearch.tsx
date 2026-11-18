import React, { useEffect, useMemo, useRef } from 'react';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { Product } from '../data/catalog.ts';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { getSearchSuggestions } from '../lib/storefrontHelpers.ts';

interface FullScreenSearchProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (val: string) => void;
  onClose: () => void;
  products: Product[];
  onNavigate: (url: string) => void;
}

export const FullScreenSearch: React.FC<FullScreenSearchProps> = ({
  isOpen,
  query,
  onQueryChange,
  onClose,
  products,
  onNavigate,
}) => {
  const { formatAmount } = useCurrency();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 60);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const suggestions = useMemo(() => getSearchSuggestions(query, products, 6), [query, products]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
    if (query.trim()) {
      onNavigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    } else {
      onNavigate('/shop');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search VANTÉRA Catalog"
      data-testid="fullscreen-search"
      className="vantera-overlay-fade fixed inset-0 z-50 bg-[#F7F3EC]/98 backdrop-blur-md flex flex-col font-meta text-[#111111]"
    >
      {/* Top Bar */}
      <div className="border-b border-[#111111]/10 px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.24em] text-[#7A6230] font-medium">
          Search Collection
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[#111111] hover:text-[#7A6230] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Search Input */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label htmlFor="fullscreen-search-input" className="sr-only">
              Search products and categories
            </label>
            <div className="relative flex items-center gap-2 border-b border-[#111111]/25 focus-within:border-[#B89B5E] transition-colors pb-3">
              <Search className="w-5 h-5 text-[#5C574E] shrink-0 mr-1 sm:mr-2" strokeWidth={1.5} aria-hidden="true" />
              <input
                ref={inputRef}
                id="fullscreen-search-input"
                type="text"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Search stands, chargers, lighting..."
                className="min-w-0 w-full flex-1 bg-transparent font-editorial text-base sm:text-2xl text-[#111111] placeholder-[#5C574E]/50 focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  aria-label="Clear search query"
                  className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-[#5C574E] hover:text-[#111111] px-2 py-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                className="gold-gradient-bg px-3.5 sm:px-5 py-2.5 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer shrink-0"
              >
                Search
              </button>
            </div>
          </form>

          {/* Live Category Suggestions */}
          {suggestions.categories.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#5C574E] font-medium">
                {query.trim() ? 'Matching Collections' : 'Curated Collections'}
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate(`/category/${cat.id}`);
                    }}
                    className="px-4 py-2.5 text-xs tracking-[0.1em] uppercase bg-[#FAF7F2] border border-[#111111]/12 hover:border-[#B89B5E] text-[#111111] rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{cat.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#7A6230]" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Product Suggestions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#111111]/10 pb-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#5C574E] font-medium">
                {query.trim()
                  ? `Live Matches (${suggestions.products.length})`
                  : 'Featured Hardware'}
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate('/shop');
                }}
                className="text-[11px] uppercase tracking-[0.18em] text-[#7A6230] hover:text-[#111111] cursor-pointer"
              >
                View All Products →
              </button>
            </div>

            {suggestions.products.length === 0 ? (
              <div className="py-10 text-center border border-[#111111]/10 bg-[#FAF7F2] p-6 space-y-3">
                <p className="font-editorial text-xl text-[#111111]">
                  No pieces matched “{query.trim()}”
                </p>
                <p className="text-xs text-[#5C574E]">
                  Try another keyword or browse our complete curated catalog.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('/shop');
                  }}
                  className="gold-gradient-bg px-6 py-2.5 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs cursor-pointer"
                >
                  Browse Collection
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.products.map((product) => {
                  const isOut =
                    !product.isAvailable ||
                    product.stockQuantity <= 0 ||
                    product.availability === 'out_of_stock';
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigate(`/product/${product.slug}`);
                      }}
                      className="flex items-center gap-4 p-3 bg-[#FAF7F2] border border-[#111111]/10 hover:border-[#B89B5E] text-left transition-colors cursor-pointer group"
                    >
                      <div className="w-16 h-16 bg-[#EFEAE0] shrink-0 overflow-hidden">
                        <img
                          src={product.image || '/products/charging-phone-stand.jpg'}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-editorial text-sm sm:text-base text-[#111111] group-hover:text-[#7A6230] truncate">
                          {product.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs tabular-nums">
                          <span className="font-medium text-[#111111]">
                            {formatAmount(product.retailPriceCents)}
                          </span>
                          {isOut && (
                            <span className="text-[10px] uppercase tracking-[0.14em] text-[#8E3A3A]">
                              · Out of stock
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
