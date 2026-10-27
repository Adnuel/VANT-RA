import React, { useState, useMemo } from 'react';
import { Product } from '../data/catalog.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';

interface HomeProps {
  products: Product[];
  onNavigate: (url: string) => void;
}

interface MaterialArtifact {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  specPill: string;
  craftsmanshipNotes: string;
  tolerance: string;
  acousticProperty: string;
  relatedProductId: string;
}

export const Home: React.FC<HomeProps> = ({ products, onNavigate }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();

  // Macro zoom modal state
  const [activeMacroMaterial, setActiveMacroMaterial] = useState<MaterialArtifact | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.6);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // VIP Gateway registration state
  const [vipName, setVipName] = useState('');
  const [vipEmail, setVipEmail] = useState('');
  const [vipCategory, setVipCategory] = useState('All Atelier Finds');
  const [vipRegisteredKey, setVipRegisteredKey] = useState<string | null>(null);
  const [isRegisteringVip, setIsRegisteringVip] = useState(false);

  // Filter curated collection tab
  const [curationTab, setCurationTab] = useState<'all' | 'magsafe' | 'desk' | 'armor'>('all');

  // Defined tactile materials for the interactive asymmetric gallery
  const materialArtifacts: MaterialArtifact[] = useMemo(
    () => [
      {
        id: 'titanium-radial-grooves',
        name: 'Aerospace Titanium Alloy',
        subtitle: 'Micro-Precision Radial Thermal Grooves',
        image: '/products/charging-phone-stand.jpg',
        specPill: 'GRADE-5 TITANIUM · 0.02MM LATHE',
        craftsmanshipNotes:
          'Sculpted from forged solid titanium bars using multi-axis CNC lathe cutters. The concentric ridges dissipate heat under 15W MagSafe continuous induction while providing an unmistakable haptic texture.',
        tolerance: '±0.005mm laser-calibrated depth',
        acousticProperty: 'High-frequency resonance dampening',
        relatedProductId: 'festive-3in1-foldable-magsafe-charger',
      },
      {
        id: 'ceramic-velvet-matrix',
        name: 'Obsidian Ceramic & Velvet Emerald',
        subtitle: 'Diamond-Lapped Mirror Surface & Hand-Finished Hide',
        image: '/products/transparent-magsafe-compatible-case.jpg',
        specPill: 'ZIRCONIUM MATRIX · LIQUID GOLD SEAM',
        craftsmanshipNotes:
          'High-density zirconium oxide sintered at 1,500°C for sapphire-level scratch immunity, seamlessly paired with Italian velvet emerald hide through an immaculate liquid gold hand-stitched border.',
        tolerance: 'Zero-seam tactile transition',
        acousticProperty: 'Acoustically deadened anti-vibration chassis',
        relatedProductId: 'clear-protective-phone-case',
      },
      {
        id: 'champagne-conductive-brass',
        name: 'Liquid Champagne Brass',
        subtitle: 'Micro-Brushed Magnetic Induction Architecture',
        image: '/products/magnetic-phone-mount.jpg',
        specPill: 'HIGH-CONDUCTIVITY BRASS · CIRCULAR GRAIN',
        craftsmanshipNotes:
          'Solid unlacquered champagne brass machined with microscopic circular brush grain to catch directional studio light. Serves as the conductive grounding ring for ultra-fast wireless energy transfer.',
        tolerance: '99.98% inductive flux efficiency',
        acousticProperty: 'Warm harmonic natural tactile ring',
        relatedProductId: 'foldable-laptop-stand',
      },
    ],
    []
  );

  // Curated museum tech finds
  const curatedFinds = useMemo(() => {
    if (curationTab === 'magsafe') {
      return products.filter((p) => p.category === 'charging' || p.title.toLowerCase().includes('magnetic') || p.title.toLowerCase().includes('wireless'));
    }
    if (curationTab === 'desk') {
      return products.filter((p) => p.category === 'room-desk');
    }
    if (curationTab === 'armor') {
      return products.filter((p) => p.category === 'phone-cases' || p.category === 'photography');
    }
    return products.slice(0, 8);
  }, [products, curationTab]);

  const handleMouseMoveOverMacro = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPanPosition({ x, y });
  };

  const handleTouchMoveOverMacro = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
    setPanPosition({ x, y });
  };

  const handleAcquireRelated = (productId: string) => {
    const found = products.find((p) => p.id === productId) || products[0];
    if (found) {
      addToCart(found, 1);
      setActiveMacroMaterial(null);
      setIsCartOpen(true);
    }
  };

  const handleVipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipEmail.trim()) return;
    setIsRegisteringVip(true);
    setTimeout(() => {
      const generatedCode = `VP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setVipRegisteredKey(generatedCode);
      setIsRegisteringVip(false);
    }, 600);
  };

  return (
    <div className="bg-[#0B0B0B] text-[#EDEDED] relative overflow-hidden">
      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 1: THE HERO STATEMENT
          Full-screen viewport, centered sculptural centerpiece, editorial typography
          ─────────────────────────────────────────────────────────────────────── */}
      <section className="min-h-screen relative flex flex-col items-center justify-between text-center px-4 sm:px-8 pt-12 pb-16 overflow-hidden">
        {/* Soft Velvet Emerald Atmospheric Light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] pointer-events-none rounded-full blur-[200px] bg-[#0F2E22]/45 z-0" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] pointer-events-none rounded-full blur-[160px] bg-[#D4AF37]/10 z-0" />

        {/* Top Kicker */}
        <div className="relative z-10 pt-4">
          <div className="inline-flex items-center gap-3 text-[10px] sm:text-[11px] font-meta uppercase tracking-[0.3em] text-[#D4AF37]">
            <span>Atelier VANTÉRA</span>
            <span className="text-[#8E8B82]">·</span>
            <span>Est. 2026</span>
            <span className="text-[#8E8B82]">·</span>
            <span className="text-[#A9A69F]">All About Tech Finds</span>
          </div>
        </div>

        {/* Centered Monolith & Massive Editorial Statement */}
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center justify-center my-auto py-8">
          {/* Massive Editorial Serif Statement */}
          <h1 className="font-editorial text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-[0.14em] uppercase text-[#F8F7F4] leading-[1.08] text-balance">
            Timeless <span className="gold-gradient-text">Precision.</span>
            <br />
            Uncompromising <span className="gold-gradient-text">Form.</span>
          </h1>

          {/* Minimalist Brand Philosophy */}
          <p className="font-meta text-xs sm:text-sm text-[#A9A69F] max-w-xl mx-auto tracking-[0.22em] uppercase font-light leading-relaxed mt-6 text-balance">
            Where engineering transcends utility. A curated sanctuary of bespoke tech finds sculpted for modern living.
          </p>

          {/* Centered Hyper-Stylized Product Monolith (Tactile Media Framing) */}
          <div className="relative mt-10 sm:mt-12 group cursor-pointer" onClick={() => {
            const el = document.getElementById('material-showcase');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}>
            {/* Diffuse Gold & Emerald Radial Floor Glow */}
            <div className="absolute -inset-4 bg-gradient-to-t from-[#0F2E22]/60 via-[#D4AF37]/10 to-transparent blur-3xl opacity-75 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />

            <div className="relative rounded-xs overflow-hidden max-w-xl sm:max-w-2xl mx-auto shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_50px_rgba(15,46,34,0.35)] transition-transform duration-700 ease-out group-hover:scale-[1.015]">
              <img
                src="/vantera-flagship-hero.jpg"
                alt="VANTÉRA Sculptural Obsidian and Champagne Gold Wireless Dock Station"
                className="w-full h-auto object-cover"
                loading="eager"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-transparent to-transparent opacity-60" />
            </div>

            {/* Quiet Micro Tag */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#121212]/90 backdrop-blur-md px-4 py-1.5 rounded-xs border border-white/5 shadow-xl text-[10px] font-meta uppercase tracking-[0.25em] text-[#D4AF37] whitespace-nowrap">
              Artifact No. 01 · Magnetic Obsidian Dock
            </div>
          </div>
        </div>

        {/* Hero Bottom Navigation & Smooth Glide CTA */}
        <div className="relative z-10 flex flex-col items-center gap-4 pt-6">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('material-showcase');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-xs bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-[11px] font-bold tracking-[0.25em] uppercase hover:shadow-[0_0_40px_rgba(212,175,55,0.4)] transition-all duration-300 cursor-pointer"
          >
            <span>Explore The Materials</span>
            <span className="group-hover:translate-y-0.5 transition-transform">↓</span>
          </button>
          <span className="text-[10px] font-meta tracking-[0.3em] uppercase text-[#6C6A64]">
            Physical Craftsmanship · Bespoke Tech Finds
          </span>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 2: THE MATERIAL SHOWCASE
          Asymmetric Interactive Gallery with macro-zoom inspection
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="material-showcase" className="relative py-32 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        {/* Soft Ambient Velvet Emerald Aura */}
        <div className="absolute top-1/4 right-0 w-[600px] h-[500px] pointer-events-none rounded-full blur-[180px] bg-[#0F2E22]/30" />

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <span className="font-meta text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#D4AF37] block">
            Chapter II · The Material Matrix
          </span>
          <h2 className="font-editorial text-3xl sm:text-5xl lg:text-6xl font-bold tracking-[0.14em] uppercase text-[#F8F7F4] text-balance">
            Tactile <span className="gold-gradient-text">Substance.</span>
          </h2>
          <p className="font-meta text-xs sm:text-sm text-[#8E8B82] tracking-[0.2em] uppercase font-light leading-relaxed max-w-xl mx-auto">
            Click any elemental artifact below to enter macro inspection mode and inspect the micro-precision grooves, diamond lapping, and acoustic resonance.
          </p>
        </div>

        {/* Asymmetric Interactive Gallery Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Card 1: Large Featured Anchor (Titanium Alloy Grooves) */}
          <div
            onClick={() => setActiveMacroMaterial(materialArtifacts[0])}
            className="lg:col-span-7 group relative bg-[#121212]/80 rounded-xs overflow-hidden zero-border-card cursor-pointer flex flex-col justify-between p-6 sm:p-8"
          >
            <div className="space-y-2 mb-6">
              <span className="font-meta text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] block">
                {materialArtifacts[0].specPill}
              </span>
              <h3 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#F8F7F4] tracking-wide">
                {materialArtifacts[0].name}
              </h3>
              <p className="text-xs text-[#8E8B82] font-sans font-light">
                {materialArtifacts[0].subtitle}
              </p>
            </div>

            {/* Macro Image Frame */}
            <div className="relative aspect-4/3 rounded-xs overflow-hidden bg-black/60 my-auto">
              <img
                src={materialArtifacts[0].image}
                alt={materialArtifacts[0].name}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/80 via-transparent to-transparent opacity-40 group-hover:opacity-10 transition-opacity" />
              <div className="absolute bottom-4 right-4 bg-[#0B0B0B]/90 backdrop-blur-md px-3 py-1.5 rounded-xs text-[10px] font-meta uppercase tracking-[0.2em] text-[#D4AF37] flex items-center gap-1.5 shadow-lg">
                <span>✦ Inspect 8K Macro</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-meta text-[#8E8B82] tracking-wider">
              <span>TOLERANCE: {materialArtifacts[0].tolerance}</span>
              <span className="text-[#D4AF37] group-hover:translate-x-1 transition-transform">Expand Specimen →</span>
            </div>
          </div>

          {/* Right Column: 2 Staggered Asymmetric Material Artifacts */}
          <div className="lg:col-span-5 flex flex-col gap-8 justify-between">
            {/* Card 2: Obsidian Ceramic & Velvet Emerald Hide */}
            <div
              onClick={() => setActiveMacroMaterial(materialArtifacts[1])}
              className="group relative bg-[#121212]/80 rounded-xs overflow-hidden zero-border-card cursor-pointer p-6 sm:p-8 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-1 mb-4">
                <span className="font-meta text-[10px] uppercase tracking-[0.25em] text-[#34A853] block">
                  {materialArtifacts[1].specPill}
                </span>
                <h3 className="font-editorial text-xl sm:text-2xl font-semibold text-[#F8F7F4]">
                  {materialArtifacts[1].name}
                </h3>
              </div>

              <div className="relative aspect-16/10 rounded-xs overflow-hidden bg-black/60 my-2">
                <img
                  src={materialArtifacts[1].image}
                  alt={materialArtifacts[1].name}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                />
                <div className="absolute bottom-3 right-3 bg-[#0B0B0B]/90 backdrop-blur-md px-2.5 py-1 rounded-xs text-[9px] font-meta uppercase tracking-[0.2em] text-[#34A853]">
                  Tactile Hide
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-meta text-[#8E8B82]">
                <span>CRAFTSMANSHIP: Diamond-Lapped</span>
                <span className="text-[#D4AF37]">Inspect →</span>
              </div>
            </div>

            {/* Card 3: Champagne Conductive Brass */}
            <div
              onClick={() => setActiveMacroMaterial(materialArtifacts[2])}
              className="group relative bg-[#121212]/80 rounded-xs overflow-hidden zero-border-card cursor-pointer p-6 sm:p-8 flex-1 flex flex-col justify-between"
            >
              <div className="space-y-1 mb-4">
                <span className="font-meta text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] block">
                  {materialArtifacts[2].specPill}
                </span>
                <h3 className="font-editorial text-xl sm:text-2xl font-semibold text-[#F8F7F4]">
                  {materialArtifacts[2].name}
                </h3>
              </div>

              <div className="relative aspect-16/10 rounded-xs overflow-hidden bg-black/60 my-2">
                <img
                  src={materialArtifacts[2].image}
                  alt={materialArtifacts[2].name}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                />
                <div className="absolute bottom-3 right-3 bg-[#0B0B0B]/90 backdrop-blur-md px-2.5 py-1 rounded-xs text-[9px] font-meta uppercase tracking-[0.2em] text-[#D4AF37]">
                  15W Inductive
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-meta text-[#8E8B82]">
                <span>EFFICIENCY: 99.98% Induction</span>
                <span className="text-[#D4AF37]">Inspect →</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          CURATED MUSEUM ARTIFACTS (VANTÉRA TECH FINDS)
          Zero borders, velvet emerald hover glow, clean unboxed metadata
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="curated-finds" className="relative py-28 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-16 border-b border-white/5 pb-8">
          <div>
            <span className="font-meta text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#D4AF37] block mb-2">
              The Permanent Collection
            </span>
            <h2 className="font-editorial text-3xl sm:text-5xl font-bold tracking-[0.14em] uppercase text-[#F8F7F4]">
              Curated <span className="gold-gradient-text">Tech Finds.</span>
            </h2>
          </div>

          {/* Clean Segmented Filter Tabs (Zero Pills, Functional Buttons) */}
          <div className="flex items-center gap-1 p-1 bg-[#141414] rounded-xs border border-white/5 text-[10px] font-meta uppercase tracking-[0.2em]">
            <button
              type="button"
              onClick={() => setCurationTab('all')}
              className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
                curationTab === 'all'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              All Finds
            </button>
            <button
              type="button"
              onClick={() => setCurationTab('magsafe')}
              className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
                curationTab === 'magsafe'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              MagSafe & Power
            </button>
            <button
              type="button"
              onClick={() => setCurationTab('desk')}
              className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
                curationTab === 'desk'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              Desk Gear
            </button>
            <button
              type="button"
              onClick={() => setCurationTab('armor')}
              className={`px-3 py-1.5 rounded-xs transition-colors cursor-pointer ${
                curationTab === 'armor'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'text-[#8E8B82] hover:text-[#EDEDED]'
              }`}
            >
              Phone Armor
            </button>
          </div>
        </div>

        {/* 4-Column Desktop Museum Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {curatedFinds.map((product) => (
            <ProductCard key={product.id} product={product} onNavigate={onNavigate} />
          ))}
        </div>

        {/* View All in Atelier */}
        <div className="text-center mt-16 pt-8 border-t border-white/5">
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="inline-flex items-center gap-3 px-8 py-3.5 rounded-xs bg-[#161616] hover:bg-[#202020] text-[#D4AF37] font-meta text-[11px] font-semibold tracking-[0.25em] uppercase transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] cursor-pointer"
          >
            <span>View Complete Atelier Catalog ({products.length} Finds)</span>
            <span>→</span>
          </button>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 3: THE VIP GATEWAY
          Encased in soft velvet emerald green glow, invite-only registry portal
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="vip-gateway" className="relative py-32 px-4 sm:px-8 lg:px-12 my-20">
        {/* Soft Ambient Velvet Emerald Radiance */}
        <div className="absolute inset-0 bg-radial from-[#0F2E22]/55 via-[#0B1510]/30 to-[#0B0B0B] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full blur-[180px] bg-[#0F2E22]/60 pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xs bg-[#0F2E22]/60 text-[#48BB78] border border-[#34A853]/20 text-[10px] font-meta uppercase tracking-[0.25em]">
            <span>✦ VANTÉRA PRIVÉ · ALLOCATION REGISTRY</span>
          </div>

          <h2 className="font-editorial text-3xl sm:text-5xl lg:text-6xl font-bold tracking-[0.14em] uppercase text-[#F8F7F4] text-balance">
            The Private <span className="gold-gradient-text">Registry.</span>
          </h2>

          <p className="font-meta text-xs sm:text-sm text-[#A9A69F] max-w-xl mx-auto tracking-[0.2em] uppercase font-light leading-relaxed text-balance">
            Acquisitions at VANTÉRA are made by private invitation and allocated editions. Enlist in the registry for private atelier dispatches, bespoke material finishes, and global VIP concierge courier delivery.
          </p>

          {/* VIP Registry Registration Form */}
          {vipRegisteredKey ? (
            <div className="bg-[#121E18]/90 border border-[#34A853]/30 p-8 rounded-xs max-w-lg mx-auto shadow-[0_20px_50px_rgba(15,46,34,0.4)] space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <span className="text-xs font-meta uppercase tracking-[0.25em] text-[#D4AF37] block">
                Privé Allocation Key Assigned
              </span>
              <div className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-[#F8F7F4] bg-black/40 py-3 rounded-xs border border-white/5">
                {vipRegisteredKey}
              </div>
              <p className="text-xs text-[#A9A69F] font-sans">
                Welcome to VANTÉRA Privé. Your credentials have been cataloged with our master concierge. You may present this key on WhatsApp for priority allocations.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello VANTÉRA Concierge, I have registered my allocation key: ${vipRegisteredKey}. Kindly confirm my VIP atelier enrollment.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xs bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-[11px] font-bold tracking-[0.2em] uppercase hover:opacity-90"
                >
                  <span>Connect With Concierge</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVipSubmit} className="max-w-lg mx-auto space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={vipName}
                  onChange={(e) => setVipName(e.target.value)}
                  placeholder="Client Full Name"
                  className="flex-1 bg-[#121212]/90 border border-white/10 rounded-xs px-4 py-3 text-xs text-[#F8F7F4] placeholder-[#6C6A64] focus:outline-hidden focus:border-[#D4AF37] font-sans"
                  required
                />
                <input
                  type="email"
                  value={vipEmail}
                  onChange={(e) => setVipEmail(e.target.value)}
                  placeholder="Client Email Address"
                  className="flex-1 bg-[#121212]/90 border border-white/10 rounded-xs px-4 py-3 text-xs text-[#F8F7F4] placeholder-[#6C6A64] focus:outline-hidden focus:border-[#D4AF37] font-sans"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <select
                  value={vipCategory}
                  onChange={(e) => setVipCategory(e.target.value)}
                  className="w-full sm:w-1/2 bg-[#121212]/90 border border-white/10 rounded-xs px-4 py-3 text-xs text-[#A9A69F] focus:outline-hidden focus:border-[#D4AF37] font-meta uppercase tracking-wider"
                >
                  <option value="All Atelier Finds">All Atelier Allocations</option>
                  <option value="MagSafe Wireless Docks">MagSafe Wireless Docks</option>
                  <option value="Titanium Phone Armor">Titanium Phone Armor</option>
                  <option value="Acoustic Soundstages">Acoustic Soundstages</option>
                </select>

                <button
                  type="submit"
                  disabled={isRegisteringVip}
                  className="w-full sm:w-1/2 bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-xs font-bold tracking-[0.25em] uppercase py-3 px-6 rounded-xs hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all cursor-pointer"
                >
                  {isRegisteringVip ? 'Allocating Key...' : 'Request VIP Allocation'}
                </button>
              </div>

              <p className="text-[10px] font-meta text-[#6C6A64] tracking-[0.18em] uppercase pt-2">
                Discreet enrollment · Zero marketing spam · Private client confidentiality
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          TACTILE CRAFTSMANSHIP MACRO ZOOM STUDIO (MODAL)
          Smoothly triggered on clicking any material item
          ─────────────────────────────────────────────────────────────────────── */}
      {activeMacroMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative bg-[#0F0F0F] max-w-5xl w-full rounded-xs shadow-[0_25px_80px_rgba(0,0,0,0.98),0_0_60px_rgba(15,46,34,0.4)] border border-white/10 overflow-hidden flex flex-col lg:flex-row max-h-[92vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveMacroMaterial(null)}
              aria-label="Close macro studio"
              className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 text-[#A9A69F] hover:text-[#D4AF37] hover:bg-black/80 transition-colors"
            >
              ✕
            </button>

            {/* Left: Interactive Macro Pan & Zoom Viewport */}
            <div
              className="lg:w-7/12 relative bg-black flex items-center justify-center overflow-hidden cursor-crosshair min-h-[350px] sm:min-h-[460px] touch-none"
              onMouseMove={handleMouseMoveOverMacro}
              onTouchMove={handleTouchMoveOverMacro}
              onTouchStart={handleTouchMoveOverMacro}
            >
              <div
                className="w-full h-full relative transition-transform duration-100 ease-out flex items-center justify-center"
                style={{
                  transformOrigin: `${panPosition.x}% ${panPosition.y}%`,
                  transform: `scale(${zoomLevel})`,
                }}
              >
                <img
                  src={activeMacroMaterial.image}
                  alt={activeMacroMaterial.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Viewport Overlay Controls */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto bg-[#0B0B0B]/85 backdrop-blur-md px-4 py-2 rounded-xs border border-white/5 text-[10px] font-meta tracking-wider text-[#A9A69F]">
                <div className="flex items-center gap-2">
                  <span>MAGNIFICATION:</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.2)}
                    className={`px-2 py-0.5 rounded-xs ${zoomLevel === 1.2 ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#8E8B82]'}`}
                  >
                    1.2X
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.8)}
                    className={`px-2 py-0.5 rounded-xs ${zoomLevel === 1.8 ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#8E8B82]'}`}
                  >
                    1.8X
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(2.5)}
                    className={`px-2 py-0.5 rounded-xs ${zoomLevel === 2.5 ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#8E8B82]'}`}
                  >
                    2.5X
                  </button>
                </div>
                <span className="hidden sm:inline text-[#6C6A64]">Hover cursor to pan micro-grooves</span>
              </div>
            </div>

            {/* Right: Tactile Craftsmanship Dossier */}
            <div className="lg:w-5/12 p-6 sm:p-8 flex flex-col justify-between overflow-y-auto space-y-6">
              <div className="space-y-3">
                <span className="font-meta text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] block">
                  Tactile Specimen Dossier
                </span>
                <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-[#F8F7F4]">
                  {activeMacroMaterial.name}
                </h3>
                <p className="text-xs font-sans text-[#8E8B82]">
                  {activeMacroMaterial.subtitle}
                </p>

                <div className="pt-4 space-y-4 border-t border-white/5 text-xs text-[#A9A69F] leading-relaxed">
                  <div>
                    <span className="block font-meta text-[10px] uppercase tracking-[0.2em] text-[#6C6A64] mb-1">
                      Elemental Composition & Finish
                    </span>
                    <p>{activeMacroMaterial.craftsmanshipNotes}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="bg-[#141414] p-3 rounded-xs border border-white/5">
                      <span className="block font-meta text-[9px] uppercase tracking-[0.2em] text-[#6C6A64] mb-1">
                        Machining Tolerance
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#D4AF37]">
                        {activeMacroMaterial.tolerance}
                      </span>
                    </div>
                    <div className="bg-[#141414] p-3 rounded-xs border border-white/5">
                      <span className="block font-meta text-[9px] uppercase tracking-[0.2em] text-[#6C6A64] mb-1">
                        Harmonic Resonance
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#34A853]">
                        {activeMacroMaterial.acousticProperty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acquisition CTA */}
              <div className="pt-6 border-t border-white/5 space-y-3">
                <button
                  type="button"
                  onClick={() => handleAcquireRelated(activeMacroMaterial.relatedProductId)}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-xs font-bold tracking-[0.25em] uppercase py-3.5 rounded-xs hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Acquire Related Atelier Artifact</span>
                  <span>✦</span>
                </button>
                <p className="text-[10px] font-meta tracking-[0.18em] uppercase text-center text-[#6C6A64]">
                  Instant VIP Bag allocation · Direct GTBank wire or Card payment
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
