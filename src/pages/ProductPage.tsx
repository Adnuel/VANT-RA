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
  const [selectedFinish, setSelectedFinish] = useState('Obsidian Noir');
  const [addedNotice, setAddedNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'warranty' | 'shipping'>('overview');

  const product = products.find((p) => p.slug === productSlug || p.id === productSlug);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-28 text-center space-y-6">
        <h2 className="text-3xl font-editorial text-[#F5F5F0]">Artifact Not Found</h2>
        <p className="text-xs text-[#888880] font-meta">The curated tech find you requested does not exist or has been relocated to the archives.</p>
        <button
          onClick={() => onNavigate('/shop')}
          className="gold-gradient-bg text-[#0B0B0B] px-7 py-3 text-[10px] font-meta font-bold uppercase tracking-[0.2em] shadow-lg cursor-pointer"
        >
          Return to Curations
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

  // Curated luxury finishes
  const finishes = [
    { name: 'Obsidian Noir', hex: '#111827' },
    { name: 'Champagne Alloy', hex: '#d4af37' },
    { name: 'Space Gray', hex: '#374151' },
    { name: 'Pure Silver', hex: '#e5e7eb' },
  ];

  return (
    <div className="w-full px-3.5 py-6 space-y-8 font-sans">
      {/* Editorial Breadcrumbs - Horizontal scroll on mobile if long */}
      <nav className="flex items-center gap-1.5 text-[9px] text-[#73736E] font-meta tracking-wider uppercase overflow-x-auto scrollbar-none pb-1">
        <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/'); }} className="hover:text-[#D4AF37] transition-colors shrink-0">Atelier</a>
        <span>/</span>
        <a href="/shop" onClick={(e) => { e.preventDefault(); onNavigate('/shop'); }} className="hover:text-[#D4AF37] transition-colors shrink-0">Curations</a>
        <span>/</span>
        <a href={`/category/${product.category}`} onClick={(e) => { e.preventDefault(); onNavigate(`/category/${product.category}`); }} className="hover:text-[#D4AF37] transition-colors shrink-0">
          {product.category.replace('-', ' ')}
        </a>
        <span>/</span>
        <span className="text-[#D4AF37] font-medium truncate max-w-[140px] shrink-0">{product.title}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="flex flex-col gap-6">
        {/* Product Imagery Showcase */}
        <div className="space-y-3">
          <div className="bg-[#111111]/90 zero-border-card aspect-square max-h-[360px] w-full relative overflow-hidden flex items-center justify-center p-6 rounded-xs group">
            <div className="absolute inset-0 bg-radial from-[#181818] to-[#0A0A0A] opacity-90" />

            {product.image ? (
              <img
                src={product.image}
                alt={product.imageAlt || product.title}
                className="relative z-10 max-h-full max-w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
                }}
              />
            ) : (
              <div className="relative z-10 text-center text-[#77746d]">
                <div className="font-editorial text-5xl mb-2 text-[#D4AF37]">V</div>
                <span className="text-xs uppercase tracking-[0.2em] font-meta block text-[#EDEDED] font-bold">VANTÉRA ATELIER</span>
                <span className="text-[10px] text-[#73736E] block mt-1 font-meta">Official Hardware Curation</span>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
              <span className="bg-[#0B0B0B]/90 text-[#EDEDED] border border-white/10 text-[8px] px-2.5 py-0.5 tracking-wider uppercase font-meta font-semibold backdrop-blur-md">
                {product.category.replace('-', ' ')}
              </span>
              {product.trending && (
                <span className="gold-gradient-bg text-[#0B0B0B] text-[8px] px-2.5 py-0.5 tracking-wider uppercase font-meta font-bold shadow-xs">
                  ★ Flagship Edition
                </span>
              )}
            </div>

            {/* Availability Indicator */}
            <div className="absolute bottom-3 left-3 z-20">
              <span className="inline-flex items-center gap-1.5 bg-[#0B0B0B]/90 backdrop-blur-md text-[#EDEDED] text-[9px] px-2.5 py-1 font-meta tracking-wider border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${product.isAvailable ? 'bg-[#10b981] animate-pulse' : 'bg-amber-400'}`}></span>
                <span>{product.isAvailable ? 'Vault Ready' : 'VIP Allocation'}</span>
              </span>
            </div>
          </div>

          {/* Quick Specifications Strip */}
          <div className="grid grid-cols-3 gap-1.5 text-center font-meta">
            <div className="p-2 bg-[#111111]/80 zero-border-card rounded-xs">
              <span className="block text-[8px] text-[#73736E] uppercase tracking-wider">Craft</span>
              <span className="text-[10px] font-medium text-[#EDEDED] mt-0.5 block truncate">Aerospace Alloy</span>
            </div>
            <div className="p-2 bg-[#111111]/80 zero-border-card rounded-xs">
              <span className="block text-[8px] text-[#73736E] uppercase tracking-wider">Assurance</span>
              <span className="text-[10px] font-medium text-[#EDEDED] mt-0.5 block truncate">1-Year Care</span>
            </div>
            <div className="p-2 bg-[#111111]/80 zero-border-card rounded-xs">
              <span className="block text-[8px] text-[#73736E] uppercase tracking-wider">Transit</span>
              <span className="text-[10px] font-medium text-[#D4AF37] mt-0.5 block truncate">Express</span>
            </div>
          </div>
        </div>

        {/* Buy Box & Options */}
        <div className="flex flex-col space-y-4 bg-[#111111]/90 zero-border-card p-4 rounded-xs text-[#EDEDED]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#D4AF37] font-meta font-bold">
                VANTÉRA OFFICIAL
              </span>
              <span className="text-[9px] font-meta text-[#73736E] tracking-wider">
                REF: {product.slug.toUpperCase().slice(0, 8)}
              </span>
            </div>

            <h1 className="text-xl min-[360px]:text-2xl font-editorial text-[#F5F5F0] leading-snug break-words">
              {product.title}
            </h1>

            {/* Price section */}
            <div className="space-y-1 pt-1 border-b border-white/5 pb-3">
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-editorial font-bold text-[#D4AF37]">
                  {formatAmount(product.retailPriceCents)}
                </span>
                <span className="text-[9px] uppercase text-[#73736E] font-meta tracking-wider">
                  {currency} · Inspected
                </span>
              </div>
              {product.referencePriceCents && product.referencePriceCents > product.retailPriceCents && (
                <div className="flex items-center gap-2 text-[10px] font-meta flex-wrap">
                  <span className="text-[#73736E]">
                    Standard: <span className="line-through">{formatAmount(product.referencePriceCents)}</span>
                  </span>
                  <span className="text-[#10b981] bg-[#0F2E22] px-1.5 py-0.5 text-[9px] tracking-wide">
                    {Math.round(((product.referencePriceCents - product.retailPriceCents) / product.referencePriceCents) * 100)}% Off
                  </span>
                </div>
              )}
            </div>

            {/* Color / Finish Selector */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center text-[10px] font-meta">
                <span className="text-[#A0A09A] uppercase">Finish:</span>
                <span className="text-[#EDEDED] font-medium uppercase tracking-wider">{selectedFinish}</span>
              </div>
              <div className="flex items-center gap-2.5">
                {finishes.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setSelectedFinish(f.name)}
                    className={`relative w-7 h-7 rounded-full border transition-all cursor-pointer ${
                      selectedFinish === f.name ? 'border-[#D4AF37] scale-110 ring-1 ring-[#D4AF37]/50 ring-offset-1 ring-offset-[#0B0B0B]' : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: f.hex }}
                    title={f.name}
                  />
                ))}
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-1.5 pt-1">
              <label htmlFor="quantity-input" className="block text-[9px] font-meta uppercase tracking-wider text-[#A0A09A]">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-white/10 rounded-xs bg-[#0B0B0B]">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1 text-xs text-[#888880] hover:text-[#EDEDED]"
                  >
                    -
                  </button>
                  <span className="px-2.5 text-xs font-meta text-[#EDEDED]">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1 text-xs text-[#888880] hover:text-[#EDEDED]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 space-y-2">
              {product.category !== 'phones' && product.isAvailable ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="w-full gold-gradient-bg text-[#0B0B0B] py-3 text-[11px] font-meta font-bold uppercase tracking-[0.15em] shadow-lg hover:brightness-110 cursor-pointer active:scale-98 transition-all rounded-xs"
                  >
                    Acquire for Atelier Bag
                  </button>
                  {addedNotice && (
                    <div className="p-2.5 bg-[#0F2E22] text-[#10b981] border border-[#10b981]/30 text-[11px] font-meta text-center rounded-xs">
                      ✓ Added to Atelier Bag.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-[#0F2E22]/30 border border-[#0F2E22] text-xs font-meta text-[#D4AF37] rounded-xs">
                  This flagship device is currently in VIP allocation. Contact concierge to reserve.
                </div>
              )}
            </div>

            {/* Payment & Security Assurance */}
            <div className="bg-[#0E0E0E] border border-white/5 p-3 text-[11px] space-y-2 rounded-xs">
              <div className="font-editorial text-[#F5F5F0] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span>✦</span>
                  <span>Settlement Assurance</span>
                </span>
                <span className="text-[9px] font-meta text-[#10b981] uppercase tracking-wider">Authentic</span>
              </div>
              <p className="text-[10px] text-[#888880] font-meta leading-relaxed break-words">
                Official GTBank (NGN) and Card checkout. Official bank transfer coordinates are provided during checkout when you are ready to complete payment.
              </p>
              <div className="pt-1">
                <a
                  href="https://wa.me/2349132793670"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-meta tracking-wider text-[#D4AF37] hover:underline break-words"
                >
                  <span>VIP WhatsApp Concierge (+234 913 279 3670) ↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications & Information Tabs */}
      <section className="bg-[#111111]/90 zero-border-card rounded-xs overflow-hidden text-[#EDEDED]">
        <div className="flex border-b border-white/5 bg-[#0E0E0E] overflow-x-auto scrollbar-none">
          {[
            { id: 'overview', label: 'Highlights' },
            { id: 'specs', label: 'Dossier' },
            { id: 'warranty', label: 'Warranty' },
            { id: 'shipping', label: 'Delivery' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-[10px] font-meta uppercase tracking-wider font-medium transition-colors cursor-pointer border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'border-[#D4AF37] text-[#D4AF37] bg-[#141414]'
                  : 'border-transparent text-[#73736E] hover:text-[#EDEDED]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-3xl">
              <h3 className="text-xl font-editorial text-[#F5F5F0]">Engineered for Modern Precision</h3>
              <p className="text-sm text-[#A0A09A] font-meta leading-relaxed">
                The {product.title} represents VANTÉRA’s commitment to combining minimalist aesthetics with durable, everyday functionality.
                Every curve, material finish, and internal component has been inspected to meet elevated performance standards.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-5 bg-[#0E0E0E] border border-white/5 rounded-xs">
                  <h4 className="text-[10px] font-meta uppercase tracking-[0.2em] text-[#D4AF37] mb-1">
                    Premium Material Quality
                  </h4>
                  <p className="text-xs text-[#888880] font-meta leading-relaxed">
                    Manufactured with resilient composite polymers, scratch-resistant finishes, and reinforced internal connectors.
                  </p>
                </div>
                <div className="p-5 bg-[#0E0E0E] border border-white/5 rounded-xs">
                  <h4 className="text-[10px] font-meta uppercase tracking-[0.2em] text-[#D4AF37] mb-1">
                    Universal Compatibility
                  </h4>
                  <p className="text-xs text-[#888880] font-meta leading-relaxed">
                    Engineered to seamlessly integrate with your existing smartphones, laptops, audio systems, and workstation ecosystems.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-4 max-w-4xl">
              <h3 className="text-xl font-editorial text-[#F5F5F0] mb-4">Official Hardware Specifications</h3>
              <div className="divide-y divide-white/5 border border-white/5 text-xs font-meta rounded-xs overflow-hidden">
                <div className="grid grid-cols-3 p-4 bg-[#0E0E0E]">
                  <span className="text-[#73736E] uppercase tracking-wider text-[10px]">Model / Title</span>
                  <span className="col-span-2 text-[#EDEDED] font-editorial">{product.title}</span>
                </div>
                <div className="grid grid-cols-3 p-4 bg-[#121212]">
                  <span className="text-[#73736E] uppercase tracking-wider text-[10px]">Product Category</span>
                  <span className="col-span-2 text-[#D4AF37] uppercase tracking-wider">{product.category.replace('-', ' ')}</span>
                </div>
                <div className="grid grid-cols-3 p-4 bg-[#0E0E0E]">
                  <span className="text-[#73736E] uppercase tracking-wider text-[10px]">Materials & Finish</span>
                  <span className="col-span-2 text-[#A0A09A]">Anodized Aluminum, Reinforced Thermoplastic, Braided Core</span>
                </div>
                <div className="grid grid-cols-3 p-4 bg-[#121212]">
                  <span className="text-[#73736E] uppercase tracking-wider text-[10px]">Device Compatibility</span>
                  <span className="col-span-2 text-[#A0A09A]">iOS, Android, macOS, Windows, iPadOS</span>
                </div>
                <div className="grid grid-cols-3 p-4 bg-[#0E0E0E]">
                  <span className="text-[#73736E] uppercase tracking-wider text-[10px]">Stock Status</span>
                  <span className="col-span-2 text-[#10b981]">{product.isAvailable ? 'In Stock (Atelier Dispatch)' : 'VIP Allocation'}</span>
                </div>
                <div className="grid grid-cols-3 p-4 bg-[#121212]">
                  <span className="text-[#73736E] uppercase tracking-wider text-[10px]">Box Contents</span>
                  <span className="col-span-2 text-[#A0A09A]">1x {product.title}, Quick Start Documentation, VANTÉRA Authenticity Card</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'warranty' && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-xl font-editorial text-[#F5F5F0]">VANTÉRA Global Hardware Assurance</h3>
              <p className="text-sm text-[#A0A09A] font-meta leading-relaxed">
                All VANTÉRA technology hardware is backed by our comprehensive 12-month manufacturer guarantee. If you encounter any functional defect, our executive customer team will provide replacement or credit.
              </p>
              <ul className="space-y-2 text-xs text-[#888880] font-meta list-disc list-inside">
                <li>100% Genuine, authentic products verified before dispatch</li>
                <li>14-day return window for unopened items</li>
                <li>Direct escalation to CEO Adnuel for VIP enterprise orders</li>
              </ul>
            </div>
          )}

          {activeTab === 'shipping' && (
            <div className="space-y-4 max-w-3xl">
              <h3 className="text-xl font-editorial text-[#F5F5F0]">Nationwide & Global Delivery</h3>
              <p className="text-sm text-[#A0A09A] font-meta leading-relaxed">
                Orders are processed within 24 hours of bank transfer confirmation. We partner with DHL, FedEx, and GIG Logistics for fast doorstep delivery.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-meta">
                <div className="p-5 bg-[#0E0E0E] border border-white/5 rounded-xs">
                  <span className="text-[#D4AF37] block mb-1 uppercase tracking-wider text-[10px]">Domestic Delivery (Nigeria)</span>
                  <p className="text-[#888880]">Lagos: 1-2 business days. Nationwide: 2-4 business days via GIG Logistics.</p>
                </div>
                <div className="p-5 bg-[#0E0E0E] border border-white/5 rounded-xs">
                  <span className="text-[#D4AF37] block mb-1 uppercase tracking-wider text-[10px]">International Air Express</span>
                  <p className="text-[#888880]">Global delivery within 5-8 business days with door-to-door tracking.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Related Products Grid */}
      {related.length > 0 && (
        <section className="pt-12 border-t border-white/5 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-meta uppercase tracking-[0.25em] text-[#D4AF37] block">COMPLETE YOUR ECOSYSTEM</span>
              <h3 className="text-2xl font-editorial text-[#F5F5F0] mt-1">Considered in the Same Category</h3>
            </div>
            <button
              onClick={() => onNavigate(`/category/${product.category}`)}
              className="text-[10px] font-meta uppercase tracking-[0.2em] text-[#73736E] hover:text-[#D4AF37] cursor-pointer transition-colors"
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
