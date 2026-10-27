import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CATEGORIES } from '../data/catalog.ts';
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
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name-asc'>('featured');
  const [selectedQuickViewProduct, setSelectedQuickViewProduct] = useState<Product | null>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Sync if URL activeCategory changes and track category visit
  useEffect(() => {
    if (activeCategory) {
      setSelectedCategory(activeCategory);
      trackEvent('category_visited', { category: activeCategory });
    } else {
      setSelectedCategory('all');
    }
  }, [activeCategory]);

  // Sync if URL initialFilter changes
  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);

  // Sync if URL initialSearchQuery changes
  useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // Track product search debounced
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
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'festive-season') {
          if (!p.festiveBestseller && p.category !== 'festive-season') return false;
        } else if (p.category !== selectedCategory) {
          return false;
        }
      }

      // Feature / Deal / New filter
      if (activeFilter === 'featured') {
        if (!p.trending && p.stockQuantity < 10) return false;
      } else if (activeFilter === 'new') {
        // Products with high stock or designated IDs
        if (!p.isAvailable) return false;
      } else if (activeFilter === 'deals') {
        // Items with reference pricing higher than retail or marked trending
        const hasDiscount = p.referencePriceCents && p.referencePriceCents > p.retailPriceCents;
        if (!hasDiscount && !p.trending) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesCat = p.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [products, selectedCategory, activeFilter, searchQuery]);

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
    if (activeFilter === 'deals') return 'Exclusive Offers & Bundles';
    if (activeFilter === 'new') return 'New Arrivals & Innovations';
    if (activeFilter === 'featured') return 'Featured Technology Highlights';
    if (selectedCategory !== 'all') return currentCategoryObj?.label || 'Curated Collection';
    return 'All Considered Essentials.';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      {/* Masthead */}
      <div className="border-b border-white/5 pb-8">
        <div className="text-[10px] uppercase tracking-[0.25em] font-meta text-[#D4AF37] mb-2">
          {activeFilter !== 'all'
            ? `COLLECTION / ${activeFilter.toUpperCase()}`
            : selectedCategory === 'all'
            ? 'ATELIER PERMANENT COLLECTION'
            : `CATEGORY / ${selectedCategory.toUpperCase()}`}
        </div>
        <h1 className="text-3xl sm:text-5xl font-editorial font-bold tracking-[0.14em] uppercase text-[#F8F7F4]">
          {getPageHeading()}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-[#8E8B82] max-w-2xl leading-relaxed font-light">
          {selectedCategory === 'phones'
            ? 'Flagship phones inventory is currently under VIP preview and marked Coming Soon. Check back for verified models and direct delivery.'
            : 'Explore high-grade phone protection, MagSafe ecosystem hardware, ambient spatial desk illumination, audio equipment, and high-speed charging.'}
        </p>

        {/* Segment Filter Tabs */}
        <div className="flex items-center gap-2 pt-6 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setSelectedCategory('all');
              onNavigate('/shop');
            }}
            className={`px-4 py-2 text-xs font-meta uppercase tracking-wider transition-all rounded-xs cursor-pointer ${
              activeFilter === 'all' && selectedCategory === 'all'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                : 'bg-[#141414] border border-white/10 text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setSelectedCategory('festive-season');
            }}
            className={`px-4 py-2 text-xs font-meta uppercase tracking-wider transition-all rounded-xs cursor-pointer inline-flex items-center gap-1.5 ${
              selectedCategory === 'festive-season'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                : 'bg-[#141414] border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10'
            }`}
          >
            <span className="text-[#D4AF37]">✦</span>
            <span>Festive Bestsellers</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('featured');
              onNavigate('/shop?filter=featured');
            }}
            className={`px-4 py-2 text-xs font-meta uppercase tracking-wider transition-all rounded-xs cursor-pointer ${
              activeFilter === 'featured'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                : 'bg-[#141414] border border-white/10 text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            Featured Highlights
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('new');
              onNavigate('/shop?filter=new');
            }}
            className={`px-4 py-2 text-xs font-meta uppercase tracking-wider transition-all rounded-xs cursor-pointer ${
              activeFilter === 'new'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                : 'bg-[#141414] border border-white/10 text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            New Arrivals
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('deals');
              onNavigate('/shop?filter=deals');
            }}
            className={`px-4 py-2 text-xs font-meta uppercase tracking-wider transition-all rounded-xs cursor-pointer ${
              activeFilter === 'deals'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                : 'bg-[#141414] border border-white/10 text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            Special Offers & Deals %
          </button>
        </div>
      </div>

      {/* Toolbar: Category Chips, Search, Sort */}
      <div className="space-y-4">
        {/* Category horizontal scroll / chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              onNavigate('/shop');
            }}
            className={`px-3 py-1.5 text-xs font-meta tracking-wider uppercase transition-colors shrink-0 rounded-xs cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#1C1C1C] text-[#D4AF37] font-bold border border-[#D4AF37]/40'
                : 'bg-[#121212] border border-white/5 text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            Every Category
          </button>

          {CATEGORIES.map((cat) => {
            const count = products.filter((p) => p.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  onNavigate(`/category/${cat.id}`);
                }}
                className={`px-3 py-1.5 text-xs font-meta tracking-wider uppercase transition-colors shrink-0 rounded-xs cursor-pointer ${
                  isSelected
                    ? 'bg-[#1C1C1C] text-[#D4AF37] font-bold border border-[#D4AF37]/40'
                    : 'bg-[#121212] border border-white/5 text-[#8E8B82] hover:text-[#EDEDED]'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Search & Sort Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products in this collection..."
              className="w-full bg-[#141414] border border-white/10 px-3.5 py-2.5 text-xs text-[#EDEDED] placeholder-[#6C6A64] focus:border-[#D4AF37] focus:outline-hidden rounded-xs transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-xs text-[#8E8B82] hover:text-[#D4AF37]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#6C6A64] shrink-0 font-meta tracking-wider">SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#141414] border border-white/10 px-3 py-2 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden cursor-pointer rounded-xs"
            >
              <option value="featured" className="bg-[#141414] text-[#EDEDED]">Featured / Curated Order</option>
              <option value="price-asc" className="bg-[#141414] text-[#EDEDED]">Price: Low to High</option>
              <option value="price-desc" className="bg-[#141414] text-[#EDEDED]">Price: High to Low</option>
              <option value="name-asc" className="bg-[#141414] text-[#EDEDED]">Alphabetical: A - Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results status */}
      <div className="flex items-center justify-between text-xs text-[#6C6A64] pt-2 font-meta">
        <span>
          Showing <strong className="text-[#EDEDED]">{sortedProducts.length}</strong> of {products.length} products
        </span>
        {searchQuery && (
          <span>
            Filtering by: <em className="text-[#D4AF37]">"{searchQuery}"</em>
          </span>
        )}
      </div>

      {/* Products Grid: 2 columns on phone screens, 2 on sm, 4 on desktop */}
      {sortedProducts.length === 0 ? (
        <div className="border border-white/5 bg-[#121212] p-16 text-center space-y-4 rounded-xs">
          <div className="font-editorial text-4xl text-[#D4AF37]">V</div>
          <h3 className="text-lg font-editorial font-bold text-[#F8F7F4]">No products matched your criteria</h3>
          <p className="text-xs text-[#8E8B82] max-w-sm mx-auto font-light">
            Try adjusting your search terms or selecting another curated category from the list above.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setActiveFilter('all');
              onNavigate('/shop');
            }}
            className="bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] px-6 py-2.5 text-xs font-meta uppercase tracking-wider font-bold rounded-xs hover:shadow-lg transition-all cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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

      {/* Tech Specs & Quick View Modal */}
      <TechSpecsModal
        product={selectedQuickViewProduct}
        isOpen={Boolean(selectedQuickViewProduct)}
        onClose={() => setSelectedQuickViewProduct(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
