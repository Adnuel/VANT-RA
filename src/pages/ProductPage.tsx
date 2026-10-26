import React, { useState, useEffect } from 'react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { ProductCard } from '../components/ProductCard.tsx';
import { trackEvent } from '../lib/tracker.ts';

interface ProductPageProps {
  productSlug: string;
  products: Product[];
  onNavigate: (url: string) => void;
}

export const ProductPage: React.FC<ProductPageProps> = ({ productSlug, products, onNavigate }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [selectedFinish, setSelectedFinish] = useState('Space Gray');
  const [addedNotice, setAddedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'warranty' | 'shipping'>('overview');

  const product = products.find((p) => p.slug === productSlug || p.id === productSlug);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center space-y-4">
        <h2 className="text-3xl font-extrabold text-[#121210]">Product Not Found</h2>
        <p className="text-xs text-[#77746d]">The product listing you requested does not exist or has been relocated.</p>
        <button
          onClick={() => onNavigate('/shop')}
          className="bg-[#121210] text-[#f8f7f4] px-6 py-3 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors cursor-pointer"
        >
          Return to catalogue
        </button>
      </div>
    );
  }

  const related = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    if (product.category === 'phones' || !product.isAvailable) return;
    addToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 3500);
  };

  useEffect(() => {
    if (product) {
      trackEvent('product_viewed', {
        productId: product.id,
        productTitle: product.title,
        category: product.category,
        retailPriceCents: product.retailPriceCents,
      });
    }
  }, [product?.id]);

  // Curated finishes
  const finishes = [
    { name: 'Space Gray', hex: '#374151' },
    { name: 'Obsidian Black', hex: '#111827' },
    { name: 'Pure Silver', hex: '#e5e7eb' },
    { name: 'Champagne Gold', hex: '#d4af37' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16 font-sans">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-[#77746d] font-mono">
        <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/'); }} className="hover:text-[#121210]">Home</a>
        <span>/</span>
        <a href="/shop" onClick={(e) => { e.preventDefault(); onNavigate('/shop'); }} className="hover:text-[#121210]">Shop</a>
        <span>/</span>
        <a href={`/category/${product.category}`} onClick={(e) => { e.preventDefault(); onNavigate(`/category/${product.category}`); }} className="hover:text-[#121210] uppercase">
          {product.category.replace('-', ' ')}
        </a>
        <span>/</span>
        <span className="text-[#121210] font-semibold truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Showcase (Samsung-Style Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left: Product Imagery Showcase */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border border-[#e7e4de] bg-[#f8f7f4] aspect-square max-h-[540px] w-full relative overflow-hidden flex items-center justify-center p-8 sm:p-12 rounded-xs shadow-xs group">
            {product.image ? (
              <img
                src={product.image}
                alt={product.imageAlt || product.title}
                className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-center text-[#77746d]">
                <div className="font-serif text-6xl mb-3 text-[#c4a66b]">V</div>
                <span className="text-xs uppercase tracking-widest font-mono block text-[#121210] font-bold">VANTÉRA Masterpiece</span>
                <span className="text-[11px] text-[#77746d] block mt-1">Official Hardware Curation</span>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-5 left-5 flex flex-col gap-2">
              <span className="bg-[#121210] text-[#f8f7f4] text-[10px] px-3 py-1 tracking-widest uppercase font-mono font-semibold shadow-xs">
                {product.category.replace('-', ' ')}
              </span>
              {product.trending && (
                <span className="bg-[#c4a66b] text-[#121210] text-[10px] px-3 py-1 tracking-wider uppercase font-mono font-bold shadow-xs">
                  ★ Flagship Edition
                </span>
              )}
            </div>

            {/* Availability Indicator */}
            <div className="absolute bottom-5 left-5">
              <span className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-xs text-[#121210] text-xs px-3 py-1.5 font-medium border border-[#e7e4de] shadow-xs">
                <span className={`w-2 h-2 rounded-full ${product.isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span>{product.isAvailable ? 'In Stock · Ready for Immediate Dispatch' : 'Backorder Curation'}</span>
              </span>
            </div>
          </div>

          {/* Quick Specifications Strip */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-white border border-[#e7e4de] rounded-xs">
              <span className="block text-[10px] font-mono text-[#77746d] uppercase">Craftsmanship</span>
              <span className="text-xs font-bold text-[#121210]">Aerospace Grade</span>
            </div>
            <div className="p-3 bg-white border border-[#e7e4de] rounded-xs">
              <span className="block text-[10px] font-mono text-[#77746d] uppercase">Warranty</span>
              <span className="text-xs font-bold text-[#121210]">1-Year VANTÉRA Care</span>
            </div>
            <div className="p-3 bg-white border border-[#e7e4de] rounded-xs">
              <span className="block text-[10px] font-mono text-[#77746d] uppercase">Shipping</span>
              <span className="text-xs font-bold text-[#1e7e34]">Free Above $100 / ₦150k</span>
            </div>
          </div>
        </div>

        {/* Right: Buy Box & Options */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6 bg-white p-6 sm:p-8 border border-[#e7e4de] rounded-xs shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-[#c4a66b] font-mono font-bold">
                VANTÉRA OFFICIAL LINEUP
              </span>
              <span className="text-[11px] font-mono text-[#77746d]">
                SKU: {product.slug.toUpperCase().slice(0, 10)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121210] tracking-tight leading-tight">
              {product.title}
            </h1>

            {/* Price section */}
            <div className="space-y-1 pt-1 border-b border-[#e7e4de] pb-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-[#121210] font-sans">
                  {formatAmount(product.retailPriceCents)}
                </span>
                <span className="text-xs uppercase text-[#77746d] font-mono font-medium">
                  {currency} · Tax Included
                </span>
              </div>
              {product.referencePriceCents && product.referencePriceCents > product.retailPriceCents && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#77746d]">
                    Market Benchmark: <span className="line-through">{formatAmount(product.referencePriceCents)}</span>
                  </span>
                  <span className="text-[#1e7e34] font-semibold bg-emerald-50 px-2 py-0.5 rounded-2xs">
                    Save {Math.round(((product.referencePriceCents - product.retailPriceCents) / product.referencePriceCents) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Color / Finish Selector */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#121210]">Finish:</span>
                <span className="font-mono text-[#77746d]">{selectedFinish}</span>
              </div>
              <div className="flex items-center gap-3">
                {finishes.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setSelectedFinish(f.name)}
                    className={`relative w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                      selectedFinish === f.name ? 'border-[#121210] scale-110 shadow-sm' : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: f.hex }}
                    title={f.name}
                  >
                    {selectedFinish === f.name && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className={`w-2 h-2 rounded-full ${f.name === 'Pure Silver' ? 'bg-[#121210]' : 'bg-white'}`}></span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="pt-2">
              <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Quantity and Actions */}
            {product.category !== 'phones' && product.isAvailable ? (
              <div className="pt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center border border-[#e7e4de] bg-[#fbfaf7] rounded-xs">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2.5 text-sm hover:bg-[#eae7e0] cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <span className="px-4 py-2 text-xs font-mono font-bold text-[#121210]">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(99, quantity + 1))}
                      className="px-3 py-2.5 text-sm hover:bg-[#eae7e0] cursor-pointer"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="flex-1 bg-[#121210] py-3.5 px-6 text-xs uppercase tracking-widest text-[#f8f7f4] font-bold hover:bg-[#c4a66b] hover:text-[#121210] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                  >
                    <span>Add to Cart</span>
                    <span>·</span>
                    <span>{formatAmount(product.retailPriceCents * quantity)}</span>
                  </button>
                </div>

                {addedNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#1e7e34] text-xs flex items-center justify-between rounded-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">✓</span>
                      <span>Added to your cart successfully!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(true)}
                      className="font-bold underline text-xs hover:text-[#121210] cursor-pointer"
                    >
                      View Cart →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-4 p-4 border border-amber-200 bg-amber-50 text-xs text-amber-900 rounded-xs">
                This flagship device is currently in VIP allocation. Reserve your interest via WhatsApp with CEO Adnuel.
              </div>
            )}
          </div>

          {/* Payment & CEO Direct Transfer Info */}
          <div className="bg-[#fbfaf7] border border-[#e7e4de] p-4 text-xs space-y-2 rounded-xs">
            <div className="font-bold text-[#121210] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Verified Direct Bank Transfer</span>
              </span>
              <span className="text-[10px] font-mono text-[#1e7e34] uppercase font-bold">100% Authentic</span>
            </div>
            <p className="text-[11px] text-[#77746d] leading-relaxed">
              Nigeria Payments: <strong>GTBank 1033269410</strong> (ADARIKWU EMMANUEL UGBADA).
              Global USD Wire available. Verified and fulfilled by CEO Adnuel.
            </p>
            <div className="pt-1 flex items-center justify-between">
              <a
                href="https://wa.me/2349132793670"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1e7e34] hover:underline"
              >
                <span>💬 WhatsApp CEO Adnuel: +234 913 279 3670</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Samsung-Style Specifications & Information Tabs */}
      <section className="border border-[#e7e4de] bg-white rounded-xs shadow-xs overflow-hidden">
        <div className="flex border-b border-[#e7e4de] bg-[#fbfaf7] overflow-x-auto">
          {[
            { id: 'overview', label: 'Product Highlights' },
            { id: 'specs', label: 'Technical Specifications' },
            { id: 'warranty', label: 'Warranty & Authenticity' },
            { id: 'shipping', label: 'Delivery & Shipping' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-4 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#121210] text-[#121210] bg-white'
                  : 'border-transparent text-[#77746d] hover:text-[#121210]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 sm:p-10">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="text-xl font-bold text-[#121210]">Engineered for Modern Precision</h3>
              <p className="text-sm text-[#4b5563] leading-relaxed">
                The {product.title} represents VANTÉRA’s commitment to combining minimalist aesthetics with durable, everyday functionality.
                Every curve, material finish, and internal component has been inspected to meet elevated performance standards.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-[#fbfaf7] border border-[#e7e4de] rounded-xs">
                  <h4 className="text-xs font-bold text-[#121210] uppercase tracking-wider font-mono mb-1">
                    Premium Material Quality
                  </h4>
                  <p className="text-xs text-[#77746d]">
                    Manufactured with resilient composite polymers, scratch-resistant finishes, and reinforced internal connectors.
                  </p>
                </div>
                <div className="p-4 bg-[#fbfaf7] border border-[#e7e4de] rounded-xs">
                  <h4 className="text-xs font-bold text-[#121210] uppercase tracking-wider font-mono mb-1">
                    Universal Compatibility
                  </h4>
                  <p className="text-xs text-[#77746d]">
                    Engineered to seamlessly integrate with your existing smartphones, laptops, audio systems, and workstation ecosystems.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-xl font-bold text-[#121210] mb-4">Official Hardware Specifications</h3>
              <div className="divide-y divide-[#e7e4de] border border-[#e7e4de] text-xs">
                <div className="grid grid-cols-3 p-3.5 bg-[#fbfaf7]">
                  <span className="font-semibold text-[#121210]">Model / Title</span>
                  <span className="col-span-2 text-[#4b5563] font-mono">{product.title}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="font-semibold text-[#121210]">Product Category</span>
                  <span className="col-span-2 text-[#4b5563] uppercase font-mono">{product.category.replace('-', ' ')}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-[#fbfaf7]">
                  <span className="font-semibold text-[#121210]">Materials & Finish</span>
                  <span className="col-span-2 text-[#4b5563]">Anodized Aluminum, Reinforced Thermoplastic, Braided Core</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="font-semibold text-[#121210]">Device Compatibility</span>
                  <span className="col-span-2 text-[#4b5563]">iOS, Android, macOS, Windows, iPadOS</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-[#fbfaf7]">
                  <span className="font-semibold text-[#121210]">Stock Status</span>
                  <span className="col-span-2 text-[#1e7e34] font-semibold">{product.isAvailable ? 'In Stock (Direct Dispatch)' : 'VIP Allocation'}</span>
                </div>
                <div className="grid grid-cols-3 p-3.5 bg-white">
                  <span className="font-semibold text-[#121210]">What’s in the Box</span>
                  <span className="col-span-2 text-[#4b5563]">1x {product.title}, Quick Start Documentation, VANTÉRA Authenticity Card</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'warranty' && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-xl font-bold text-[#121210]">VANTÉRA Global Hardware Assurance</h3>
              <p className="text-sm text-[#4b5563] leading-relaxed">
                All VANTÉRA technology hardware is backed by our comprehensive 12-month manufacturer guarantee. If you encounter any functional defect, our executive customer team will provide replacement or credit.
              </p>
              <ul className="space-y-2 text-xs text-[#77746d] list-disc list-inside">
                <li>100% Genuine, authentic products verified before dispatch</li>
                <li>14-day hassle-free return window for unopened items</li>
                <li>Direct escalation to CEO Adnuel for VIP enterprise orders</li>
              </ul>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-xl font-bold text-[#121210]">Nationwide & Global Delivery</h3>
              <p className="text-sm text-[#4b5563] leading-relaxed">
                Orders are processed within 24 hours of bank transfer confirmation. We partner with DHL, FedEx, and GIG Logistics for fast doorstep delivery.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-[#fbfaf7] border border-[#e7e4de]">
                  <span className="font-bold text-[#121210] block mb-1">Domestic Delivery (Nigeria)</span>
                  <p className="text-[#77746d]">Lagos: 1-2 business days. Nationwide: 2-4 business days via GIG Logistics.</p>
                </div>
                <div className="p-4 bg-[#fbfaf7] border border-[#e7e4de]">
                  <span className="font-bold text-[#121210] block mb-1">International Air Express</span>
                  <p className="text-[#77746d]">Global delivery within 5-8 business days with door-to-door tracking.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Related Products Grid */}
      {related.length > 0 && (
        <section className="pt-12 border-t border-[#e7e4de] space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#c4a66b] block">COMPLETE YOUR ECOSYSTEM</span>
              <h3 className="text-2xl font-extrabold text-[#121210]">Considered in the Same Category</h3>
            </div>
            <button
              onClick={() => onNavigate(`/category/${product.category}`)}
              className="text-xs uppercase tracking-wider text-[#77746d] hover:text-[#121210] font-bold cursor-pointer"
            >
              View category →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
