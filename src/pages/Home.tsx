import React, { useState, useMemo } from 'react';
import { Product } from '../data/catalog.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { TechSpecsModal } from '../components/TechSpecsModal.tsx';
import { DeviceComparisonMatrix } from '../components/DeviceComparisonMatrix.tsx';
import { EcosystemBundleBuilder } from '../components/EcosystemBundleBuilder.tsx';

interface HomeProps {
  products: Product[];
  onNavigate: (url: string) => void;
}

export const Home: React.FC<HomeProps> = ({ products, onNavigate }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();
  const [selectedTab, setSelectedTab] = useState<string>('all');
  const [copiedCoupon, setCopiedCoupon] = useState<boolean>(false);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [selectedQuickViewProduct, setSelectedQuickViewProduct] = useState<Product | null>(null);

  // Samsung-style Flagship Hero Interactive Finish Switcher
  const heroFinishes = [
    {
      id: 'titanium-noir',
      name: 'Titanium Noir',
      hex: '#141412',
      accentGlow: 'bg-[#c4a66b]/15',
      tagline: 'Deep Obsidian · Stealth Matte Finish',
      specs: '187g Bespoke Weight · 32 W/m·K Thermal Ratio',
    },
    {
      id: 'natural-titanium',
      name: 'Natural Titanium',
      hex: '#8a8d8f',
      accentGlow: 'bg-[#8a8d8f]/15',
      tagline: 'Aerospace Grade 5 Alloy · Raw Metallic Texture',
      specs: '15,000 Articulation Hinge · CNC Precision Bevel',
    },
    {
      id: 'desert-gold',
      name: 'Desert Gold',
      hex: '#c4a66b',
      accentGlow: 'bg-[#c4a66b]/20',
      tagline: 'Champagne Luster · Anodized Luxury Shield',
      specs: '99.4% Purity Anodization · Scratch-Resistant Hardness',
    },
    {
      id: 'phantom-silver',
      name: 'Phantom Silver',
      hex: '#e2e8f0',
      accentGlow: 'bg-white/10',
      tagline: 'Frosted Architectural Chrome · Pure Minimalist Tone',
      specs: 'Zero Fingerprint Matte Film · 45ms Acoustic Isolation',
    },
  ];

  const [activeHeroFinish, setActiveHeroFinish] = useState(heroFinishes[0]);

  // Find primary flagship item for hero direct add
  const flagshipProduct = useMemo(() => {
    return (
      products.find((p) => p.id === 'foldable-laptop-stand') ||
      products.find((p) => p.trending) ||
      products[0]
    );
  }, [products]);

  // Festive Season Bestsellers (Holiday Tech Gifts)
  const festiveBestsellers = useMemo(() => {
    const list = products.filter((p) => p.festiveBestseller);
    return list.length > 0 ? list : products.slice(0, 8);
  }, [products]);

  // Filter products by selected category tab
  const filteredFeaturedProducts = useMemo(() => {
    let list = products;
    if (selectedTab === 'festive') {
      list = products.filter((p) => p.festiveBestseller);
    } else if (selectedTab === 'smartphones') {
      list = products.filter((p) => p.category === 'phone-cases' || p.category === 'photography');
    } else if (selectedTab === 'gadgets') {
      list = products.filter((p) => p.category === 'room-desk');
    } else if (selectedTab === 'charging') {
      list = products.filter((p) => p.category === 'charging');
    } else if (selectedTab === 'audio') {
      list = products.filter((p) => p.category === 'audio');
    } else {
      const priorityIds = [
        'foldable-laptop-stand',
        'wireless-bluetooth-earbuds',
        'compact-20w-usb-c-charger',
        'portable-bluetooth-speaker',
        'clear-protective-phone-case',
        'adjustable-phone-tripod',
        'compact-usb-hub',
        '3-in-1-charging-cable',
      ];
      list = products.filter((p) => priorityIds.includes(p.id) || p.trending);
    }
    return list.slice(0, 8);
  }, [products, selectedTab]);

  const handleCopyCoupon = () => {
    navigator.clipboard?.writeText('WELCOME10');
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  const handleCopyAccount = () => {
    navigator.clipboard?.writeText('1033269410');
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleAddHeroFlagship = () => {
    if (flagshipProduct) {
      addToCart(flagshipProduct, 1);
      setIsCartOpen(true);
    }
  };

  return (
    <div className="space-y-24 sm:space-y-32 pb-24">
      {/* 1. SAMSUNG-STYLE FLAGSHIP HERO STAGE */}
      <section className="relative bg-[#0d0d0c] text-[#f8f7f4] overflow-hidden border-b border-[#252521]">
        {/* Dynamic Ambient Radial Glow */}
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] blur-[150px] pointer-events-none rounded-full transition-all duration-700 ${activeHeroFinish.accentGlow}`}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Zero-Pill Unboxed Flagship Label */}
            <div className="flex items-center justify-center lg:justify-start gap-2 text-[11px] font-mono tracking-widest uppercase text-[#c4a66b]">
              <span className="w-2 h-2 rounded-full bg-[#c4a66b] animate-pulse"></span>
              <span>Flagship Collection · 2026 Unpacked Edition</span>
            </div>

            <h1 className="font-sans text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-[#f8f7f4]">
              Technology, <span className="text-[#c4a66b]">Elevated.</span>
            </h1>

            <p className="text-[#a9a69f] text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Precision-machined aerospace alloys, GaNFast™ thermal delivery, and acoustic clarity engineered for modern life.
            </p>

            {/* Interactive Colorway Selector (Samsung Galaxy Bespoke Style) */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-center lg:justify-start gap-3">
                <span className="text-xs font-mono text-[#a9a69f] uppercase tracking-wider">
                  Finish: <strong className="text-white font-sans">{activeHeroFinish.name}</strong>
                </span>
                <span className="text-[#3a3a35]">·</span>
                <span className="text-xs font-mono text-[#c4a66b]">{activeHeroFinish.tagline}</span>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-3.5 pt-1">
                {heroFinishes.map((finish) => (
                  <button
                    key={finish.id}
                    type="button"
                    onClick={() => setActiveHeroFinish(finish)}
                    className={`w-7 h-7 rounded-full border border-white/30 transition-all cursor-pointer ${
                      activeHeroFinish.id === finish.id
                        ? 'scale-125 ring-2 ring-[#c4a66b] ring-offset-2 ring-offset-[#0d0d0c]'
                        : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: finish.hex }}
                    title={finish.name}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
              <button
                type="button"
                onClick={handleAddHeroFlagship}
                className="bg-[#f8f7f4] text-[#121210] px-8 py-3.5 text-xs uppercase tracking-widest font-bold hover:bg-[#c4a66b] transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
              >
                Order Flagship ({formatAmount(flagshipProduct?.retailPriceCents || 4500)})
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('featured-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else onNavigate('/shop');
                }}
                className="border border-[#77746d]/50 text-[#f8f7f4] px-8 py-3.5 text-xs uppercase tracking-widest font-bold hover:border-[#f8f7f4] hover:bg-white/5 transition-all duration-200 cursor-pointer"
              >
                Explore Full Lineup
              </button>
            </div>

            {/* Live Spec Ticker */}
            <div className="pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-[#a9a69f] font-mono border-t border-[#252521]">
              <div className="flex items-center gap-2">
                <span className="text-[#c4a66b]">⚡</span>
                <span>GaNFast™ 140W</span>
              </div>
              <span className="text-[#3a3a35]">/</span>
              <div className="flex items-center gap-2">
                <span className="text-[#c4a66b]">🛡️</span>
                <span>Aerospace Titanium</span>
              </div>
              <span className="text-[#3a3a35]">/</span>
              <div className="flex items-center gap-2">
                <span className="text-[#c4a66b]">💎</span>
                <span>GTBank Instant Settlement</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Showcase */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-lg aspect-4/3 sm:aspect-square rounded-xs overflow-hidden border border-[#2a2a26] shadow-2xl bg-[#141412] group">
              <img
                src="/vantera-flagship-hero.jpg"
                alt="VANTÉRA Flagship Technology hardware showcase"
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0c] via-transparent to-transparent opacity-60"></div>

              {/* Floating Bottom Card Banner */}
              <div className="absolute bottom-4 left-4 right-4 bg-[#121210]/95 backdrop-blur-md p-4 border border-[#2e2e2a] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#c4a66b] block">
                    {activeHeroFinish.name} Edition
                  </span>
                  <span className="text-xs font-semibold text-white">
                    {activeHeroFinish.specs}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedQuickViewProduct(flagshipProduct)}
                  className="text-xs text-[#c4a66b] font-semibold hover:underline font-mono"
                >
                  Quick Specs →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROMOTIONAL TECH BANNER (Samsung Deals Inspired) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-[#141412] via-[#1a1a18] to-[#141412] border border-[#2a2a26] text-[#f8f7f4] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md rounded-xs">
          <div className="space-y-1.5 text-center md:text-left">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#c4a66b] font-bold">
              EXCLUSIVE LAUNCH PRIVILEGE
            </span>
            <h3 className="text-xl sm:text-2xl font-bold font-sans">
              Complimentary Express Shipping on Orders Over {currency === 'NGN' ? '₦75,000' : '$50'}
            </h3>
            <p className="text-xs text-[#a9a69f] max-w-xl">
              Enjoy 10% off your entire technology order with promo code <strong className="text-white font-mono">WELCOME10</strong>. Includes 1-year manufacturer replacement care.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyCoupon}
              className="px-4 py-2 text-xs font-mono font-bold border border-[#c4a66b] text-[#c4a66b] hover:bg-[#c4a66b] hover:text-[#121210] transition-colors cursor-pointer"
            >
              {copiedCoupon ? '✓ Code Copied!' : 'Copy Code: WELCOME10'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/shop?filter=deals')}
              className="bg-[#c4a66b] text-[#121210] px-5 py-2 text-xs font-bold uppercase tracking-wider hover:bg-[#d6b97d] transition-colors cursor-pointer"
            >
              Shop Deals
            </button>
          </div>
        </div>
      </section>

      {/* 2.5 FESTIVE SEASON BESTSELLERS SHOWCASE (Holiday Tech Gifting) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e7e4de] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b] font-bold">
                HOLIDAY & FESTIVE SEASON BESTSELLERS
              </span>
              <span className="text-[9px] font-mono bg-[#121210] text-[#c4a66b] px-2 py-0.5 rounded-2xs font-bold">
                TOP GIFTS 2026
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121210] tracking-tight mt-1 font-sans">
              The Year's Most Wanted Tech Gifts
            </h2>
            <p className="text-xs sm:text-sm text-[#77746d] mt-1">
              Real-time festive pricing on the viral accessories, Qi2 travel chargers, spatial audio, and aesthetic smart lighting people buy the most.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/shop?category=festive-season')}
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#121210] hover:text-[#c4a66b] transition-colors self-start md:self-auto cursor-pointer"
          >
            <span>Explore All 10 Festive Deals</span>
            <span>→</span>
          </button>
        </div>

        {/* Festive Bestsellers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {festiveBestsellers.slice(0, 4).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={onNavigate}
              onQuickView={(p) => setSelectedQuickViewProduct(p)}
            />
          ))}
        </div>
      </section>

      {/* 3. FEATURED PRODUCTS (Samsung "Explore the Lineup" Style) */}
      <section id="featured-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#e7e4de] pb-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b] font-bold">
              EXPLORE THE LINEUP
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121210] tracking-tight mt-1 font-sans">
              Featured Technology
            </h2>
            <p className="text-xs sm:text-sm text-[#77746d] mt-1">
              Engineered for seamless productivity, protection, and daily acoustic clarity.
            </p>
          </div>

          {/* Interactive Category Segmented Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none text-xs font-semibold">
            {[
              { id: 'all', label: 'All Essentials', isStar: false },
              { id: 'festive', label: 'Festive Bestsellers', isStar: true },
              { id: 'smartphones', label: 'Smartphones & Accessories', isStar: false },
              { id: 'gadgets', label: 'Smart Gadgets', isStar: false },
              { id: 'charging', label: 'Charging & Power', isStar: false },
              { id: 'audio', label: 'Audio & Sound', isStar: false },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2 rounded-xs transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                  selectedTab === tab.id
                    ? 'bg-[#121210] text-white shadow-xs font-bold'
                    : 'bg-[#f4f2ee] text-[#77746d] hover:text-[#121210] hover:bg-[#eae7e0]'
                }`}
              >
                {tab.isStar && (
                  <svg className="w-3.5 h-3.5 text-[#c4a66b]" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                )}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid with Quick View modal integration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredFeaturedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onNavigate={onNavigate}
              onQuickView={(p) => setSelectedQuickViewProduct(p)}
            />
          ))}
        </div>

        <div className="text-center pt-6">
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="inline-flex items-center gap-2 border-2 border-[#121210] text-[#121210] px-8 py-3 text-xs uppercase tracking-widest font-bold hover:bg-[#121210] hover:text-[#f8f7f4] transition-all cursor-pointer"
          >
            <span>View Complete 62-Product Catalog</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* 4. SAMSUNG-STYLE CONNECTED ECOSYSTEM BUILDER */}
      <EcosystemBundleBuilder products={products} />

      {/* 5. SAMSUNG-STYLE SIDE-BY-SIDE DEVICE COMPARISON MATRIX */}
      <DeviceComparisonMatrix products={products} onNavigate={onNavigate} />

      {/* 6. PRECISION ENGINEERING ARCHITECTURE (Samsung Exploded View Style) */}
      <section className="bg-[#121210] text-[#f8f7f4] py-20 border-y border-[#252521]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#c4a66b] font-bold">
              ENGINEERED WITHOUT COMPROMISE
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight font-sans">
              Architectural Mastery
            </h2>
            <p className="text-xs sm:text-sm text-[#a9a69f] leading-relaxed">
              Every millimeter is evaluated for thermal dissipation, structural durability, and tactile satisfaction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#181816] border border-[#2a2a26] p-6 space-y-3 rounded-xs hover:border-[#c4a66b]/60 transition-colors">
              <span className="font-mono text-xs text-[#c4a66b] block">LAYER 01</span>
              <h3 className="text-base font-bold text-white font-sans">
                Aerospace Grade Titanium
              </h3>
              <p className="text-xs text-[#a9a69f] leading-relaxed">
                Precision CNC milled frames engineered to withstand 15,000 hinge articulations with zero torsional flex.
              </p>
              <div className="text-[11px] font-mono text-[#77746d] pt-2">
                Yield strength: 830 MPa
              </div>
            </div>

            <div className="bg-[#181816] border border-[#2a2a26] p-6 space-y-3 rounded-xs hover:border-[#c4a66b]/60 transition-colors">
              <span className="font-mono text-xs text-[#c4a66b] block">LAYER 02</span>
              <h3 className="text-base font-bold text-white font-sans">
                GaNFast™ Multi-Stage Silicon
              </h3>
              <p className="text-xs text-[#a9a69f] leading-relaxed">
                Gallium Nitride semiconductors operate at 3x higher switching frequency with minimal thermal loss.
              </p>
              <div className="text-[11px] font-mono text-[#77746d] pt-2">
                Efficiency: 94.2% Peak
              </div>
            </div>

            <div className="bg-[#181816] border border-[#2a2a26] p-6 space-y-3 rounded-xs hover:border-[#c4a66b]/60 transition-colors">
              <span className="font-mono text-xs text-[#c4a66b] block">LAYER 03</span>
              <h3 className="text-base font-bold text-white font-sans">
                Acoustic Armature Drivers
              </h3>
              <p className="text-xs text-[#a9a69f] leading-relaxed">
                Custom balanced-armature transducers output crystal highs and punchy bass with ultra-low 45ms gaming latency.
              </p>
              <div className="text-[11px] font-mono text-[#77746d] pt-2">
                THD: &lt; 0.1% at 1kHz
              </div>
            </div>

            <div className="bg-[#181816] border border-[#2a2a26] p-6 space-y-3 rounded-xs hover:border-[#c4a66b]/60 transition-colors">
              <span className="font-mono text-xs text-[#c4a66b] block">LAYER 04</span>
              <h3 className="text-base font-bold text-white font-sans">
                Neodymium Magnetic Ring
              </h3>
              <p className="text-xs text-[#a9a69f] leading-relaxed">
                Custom N52 rare-earth magnetic array provides 15N of holding force for zero-slip MagSafe locking.
              </p>
              <div className="text-[11px] font-mono text-[#77746d] pt-2">
                Qi2 Fast Alignment Ready
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. TRUST & DIRECT GTBANK VIP CONCIERGE (Samsung Trust Pillars) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#fbfaf7] border border-[#e7e4de] p-8 sm:p-12 rounded-xs shadow-xs space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#e7e4de]">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#9d8048] font-bold">
                GUARANTEED SETTLEMENT & CONCIERGE CARE
              </span>
              <h3 className="text-2xl font-bold font-sans text-[#121210]">
                Official GTBank Wire Account & VIP Support
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white px-3 py-2 border border-[#e7e4de] rounded-xs font-mono text-xs">
                <span className="text-[#77746d]">GTBank: </span>
                <strong className="text-[#121210]">1033269410</strong>
              </div>
              <button
                type="button"
                onClick={handleCopyAccount}
                className="bg-[#121210] text-[#f8f7f4] px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors rounded-xs cursor-pointer shadow-xs"
              >
                {copiedAccount ? '✓ Copied!' : 'Copy Account'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-2">
              <div className="w-10 h-10 bg-[#121210] text-[#c4a66b] flex items-center justify-center font-bold text-sm rounded-xs">
                ✓
              </div>
              <h4 className="font-bold text-sm text-[#121210]">Direct CEO Verification</h4>
              <p className="text-xs text-[#77746d] leading-relaxed">
                Every bank transfer order is personally verified by CEO Emmanuel Adarikwu for instant dispatch within 2 hours.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 bg-[#121210] text-[#c4a66b] flex items-center justify-center font-bold text-sm rounded-xs">
                ₦/$
              </div>
              <h4 className="font-bold text-sm text-[#121210]">Dual Currency Settlement</h4>
              <p className="text-xs text-[#77746d] leading-relaxed">
                Seamless real-time conversion between Nigerian Naira (₦) and US Dollar ($) with guaranteed zero-markup exchange.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 bg-[#121210] text-[#c4a66b] flex items-center justify-center font-bold text-sm rounded-xs">
                📦
              </div>
              <h4 className="font-bold text-sm text-[#121210]">Express Tracked Delivery</h4>
              <p className="text-xs text-[#77746d] leading-relaxed">
                Full live tracking provided with DHL Express and FedEx partnerships directly from your customer account portal.
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-10 h-10 bg-[#121210] text-[#c4a66b] flex items-center justify-center font-bold text-sm rounded-xs">
                ★
              </div>
              <h4 className="font-bold text-sm text-[#121210]">1-Year VANTÉRA Warranty</h4>
              <p className="text-xs text-[#77746d] leading-relaxed">
                30-day return policy and full 12-month manufacturer replacement warranty on all technology and charging accessories.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Tech Specs Quick View Modal */}
      <TechSpecsModal
        product={selectedQuickViewProduct}
        isOpen={Boolean(selectedQuickViewProduct)}
        onClose={() => setSelectedQuickViewProduct(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
