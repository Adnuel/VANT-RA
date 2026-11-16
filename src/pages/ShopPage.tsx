import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CATEGORIES } from '../data/catalog.ts';
import { mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { TechSpecsModal } from '../components/TechSpecsModal.tsx';
import { trackEvent } from '../lib/tracker.ts';

interface ShopPageProps {
  products: Product[];
  activeCategory?: string;
  initialFilter?: string;
  initialSearchQuery?: string;
  onNavigate: (url: string) => void;
}

export const ShopPage: React.FC<ShopPageProps> = ({
  products,
  activeCategory,
  initialFilter = 'all',
  initialSearchQuery = '',
  onNavigate,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(activeCategory || 'all');
  const [activeFilter, setActiveFilter] = useState<string>(initialFilter || 'all');
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name-asc'>('featured');
  const [selectedQuickViewProduct, setSelectedQuickViewProduct] = useState<Product | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (activeCategory) {
      setSelectedCategory(String(mapLegacyCategoryToCurated(activeCategory)));
      trackEvent('category_visited', { category: activeCategory });
    } else {
      setSelectedCategory('all');
    }
  }, [activeCategory]);

  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length >= 2) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        trackEvent('product_searched', { query: q });
      }, 700);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== 'all') {
        const mappedProductCat = mapLegacyCategoryToCurated(p.category);
        if (mappedProductCat !== selectedCategory && p.category !== selectedCategory) {
          return false;
        }
      }

      if (inStockOnly && (!p.isAvailable || p.stockQuantity <= 0 || p.availability === 'out_of_stock')) {
        return false;
      }

      if (activeFilter === 'featured') {
        if (!p.trending && p.stockQuantity < 10) return false;
      } else if (activeFilter === 'new') {
        if (!p.isAvailable) return false;
      } else if (activeFilter === 'deals') {
        const hasDiscount = p.referencePriceCents && p.referencePriceCents > p.retailPriceCents;
        if (!hasDiscount && !p.trending) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesCat = p.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [products, selectedCategory, activeFilter, inStockOnly, searchQuery]);

  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.retailPriceCents - b.retailPriceCents);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.retailPriceCents - a.retailPriceCents);
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [filteredProducts, sortBy]);

  const currentCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory);

  const getPageHeading = () => {
    if (activeFilter === 'deals') return 'Special Offers';
    if (activeFilter === 'new') return 'New Arrivals';
    if (activeFilter === 'featured') return 'Featured Hardware';
    if (selectedCategory !== 'all') return currentCategoryObj?.label || 'Curated Collection';
    return 'Complete Collection';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-14 lg:py-20 space-y-12">
      {/* Page Masthead */}
      <div className="border-b border-white/8 pb-10 space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#C8A96A]">
          {selectedCategory === 'all' ? 'VANTÉRA Catalog' : selectedCategory.replace('-', ' ')}
        </p>
        <h1 className="font-editorial text-3xl sm:text-5xl font-medium text-[#F5F1E8] text-balance">
          {getPageHeading()}
        </h1>
        <p className="text-sm sm:text-base text-[#A8A297] max-w-2xl leading-relaxed">
          {currentCategoryObj?.description ||
            'Premium tech accessories, smart home technology, laptop & workspace gear, lifestyle gadgets, and everyday carry essentials.'}
        </p>
      </div>

      {/* Category Filter Tabs & Search/Sort Toolbar */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setSelectedCategory('all');
              onNavigate('/shop');
            }}
            className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'all' && selectedCategory === 'all'
                ? 'bg-[#C8A96A] text-[#0B0B0C] font-semibold'
                : 'bg-[#141416] border border-white/10 text-[#A8A297] hover:text-[#F5F1E8]'
            }`}
          >
            All Collections
          </button>

          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveFilter('all');
                  setSelectedCategory(cat.id);
                  onNavigate(`/category/${cat.id}`);
                }}
                className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#C8A96A] text-[#0B0B0C] font-semibold'
                    : 'bg-[#141416] border border-white/10 text-[#A8A297] hover:text-[#F5F1E8]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="shop-search" className="sr-only">
              Search collection
            </label>
            <input
              id="shop-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pieces by name or category..."
              className="w-full bg-[#141416] border border-white/12 px-4 py-2.5 text-sm text-[#F5F1E8] placeholder-[#A8A297]/60 focus:border-[#C8A96A] focus:outline-hidden rounded-xs transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-sm text-[#A8A297] hover:text-[#F5F1E8] cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-4">
            <button
              type="button"
              onClick={() => setInStockOnly(!inStockOnly)}
              aria-pressed={inStockOnly}
              className={`px-3.5 py-2 text-[11px] uppercase tracking-[0.16em] border rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                inStockOnly
                  ? 'border-[#C8A96A] text-[#C8A96A] bg-[#C8A96A]/10'
                  : 'border-white/10 text-[#A8A297] bg-[#141416] hover:text-[#F5F1E8]'
              }`}
            >
              In Stock Only
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort products"
              className="bg-[#141416] border border-white/12 px-4 py-2.5 text-xs uppercase tracking-[0.14em] text-[#F5F1E8] focus:border-[#C8A96A] focus:outline-hidden cursor-pointer rounded-xs"
            >
              <option value="featured">Featured Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {sortedProducts.length === 0 ? (
        <div className="border border-white/8 bg-[#141416] p-16 text-center space-y-5 rounded-xs">
          <h3 className="text-2xl font-editorial font-medium text-[#F5F1E8]">
            No pieces matched your selection
          </h3>
          <p className="text-sm text-[#A8A297] max-w-md mx-auto">
            Try clearing your search terms or adjusting the category filters above.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setActiveFilter('all');
              setInStockOnly(false);
              onNavigate('/shop');
            }}
            className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
          >
            Show All Pieces
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={onNavigate}
              onQuickView={(p) => setSelectedQuickViewProduct(p)}
            />
          ))}
        </div>
      )}

      {/* Quick View Modal */}
      <TechSpecsModal
        product={selectedQuickViewProduct}
        isOpen={Boolean(selectedQuickViewProduct)}
        onClose={() => setSelectedQuickViewProduct(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
