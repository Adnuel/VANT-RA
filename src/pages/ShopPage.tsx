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
      <div className="border-b border-[#e7e4de] pb-8">
        <div className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b] mb-2">
          {activeFilter !== 'all'
            ? `COLLECTION / ${activeFilter.toUpperCase()}`
            : selectedCategory === 'all'
            ? 'FULL CATALOGUE'
            : `CATEGORY / ${selectedCategory.toUpperCase()}`}
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#121210]">
          {getPageHeading()}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-[#77746d] max-w-2xl leading-relaxed">
          {selectedCategory === 'phones'
            ? 'Flagship phones inventory is currently under VIP preview and marked Coming Soon. Check back for verified models and direct delivery.'
            : 'Explore high-grade phone protection, MagSafe ecosystem hardware, ambient spatial desk illumination, audio equipment, and high-speed charging.'}
        </p>

        {/* Samsung-style Segment Filter Tabs */}
        <div className="flex items-center gap-2 pt-6 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setSelectedCategory('all');
              onNavigate('/shop');
            }}
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all rounded-full cursor-pointer ${
              activeFilter === 'all' && selectedCategory === 'all'
                ? 'bg-[#121210] !text-white shadow-xs'
                : 'bg-white border border-[#e7e4de] text-[#77746d] hover:border-[#121210] hover:text-[#121210]'
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
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all rounded-full cursor-pointer inline-flex items-center gap-1.5 ${
              selectedCategory === 'festive-season'
                ? 'bg-[#121210] !text-white shadow-xs font-bold'
                : 'bg-white border border-[#c4a66b] text-[#9d8048] hover:bg-[#c4a66b] hover:text-[#121210]'
            }`}
          >
            <svg className="w-3.5 h-3.5 text-[#c4a66b]" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>Festive Bestsellers</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveFilter('featured');
              onNavigate('/shop?filter=featured');
            }}
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all rounded-full cursor-pointer ${
              activeFilter === 'featured'
                ? 'bg-[#121210] !text-white shadow-xs'
                : 'bg-white border border-[#e7e4de] text-[#77746d] hover:border-[#121210] hover:text-[#121210]'
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
            className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all rounded-full cursor-pointer ${
              activeFilter === 'new'
                ? 'bg-[#121210] !text-white shadow-xs'
                : 'bg-white border border-[#e7e4de] text-[#77746d] hover:border-[#121210] hover:text-[#121210]'
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
            className={`px-4 py-2 text-xs font-bold tracking-wider uppercase transition-all rounded-full cursor-pointer ${
              activeFilter === 'deals'
                ? 'bg-[#121210] !text-white shadow-xs'
                : 'bg-white border border-[#c4a66b] text-[#9d8048] hover:bg-[#c4a66b]/10'
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
            className={`px-3 py-1.5 text-xs tracking-wider uppercase transition-colors shrink-0 rounded-xs cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#121210] !text-white font-medium'
                : 'bg-white border border-[#e7e4de] text-[#77746d] hover:border-[#121210] hover:text-[#121210]'
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
                className={`px-3 py-1.5 text-xs tracking-wider uppercase transition-colors shrink-0 rounded-xs cursor-pointer ${
                  isSelected
                    ? 'bg-[#121210] !text-white font-medium'
                    : 'bg-white border border-[#e7e4de] text-[#77746d] hover:border-[#121210] hover:text-[#121210]'
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
              className="w-full bg-white border border-[#e7e4de] px-3.5 py-2 text-xs text-[#121210] placeholder-[#a9a69f] focus:border-[#121210] focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-[#77746d] hover:text-[#121210]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort selection */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#77746d] shrink-0 font-mono">SORT:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-[#e7e4de] px-3 py-2 text-xs text-[#121210] focus:border-[#121210] focus:outline-hidden cursor-pointer"
            >
              <option value="featured">Featured / Curated Order</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Alphabetical: A - Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results status */}
      <div className="flex items-center justify-between text-xs text-[#77746d] pt-2">
        <span>
          Showing <strong>{sortedProducts.length}</strong> of {products.length} products
        </span>
        {searchQuery && (
          <span>
            Filtering by: <em className="text-[#121210]">"{searchQuery}"</em>
          </span>
        )}
      </div>

      {/* Products Grid */}
      {sortedProducts.length === 0 ? (
        <div className="border border-[#e7e4de] bg-white p-16 text-center space-y-4">
          <div className="font-serif text-3xl text-[#77746d]">V</div>
          <h3 className="text-lg font-bold text-[#121210]">No products matched your criteria</h3>
          <p className="text-xs text-[#77746d] max-w-sm mx-auto">
            Try adjusting your search terms or selecting another curated category from the list above.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setActiveFilter('all');
              onNavigate('/shop');
            }}
            className="bg-[#121210] text-[#f8f7f4] px-5 py-2.5 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
