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
        name: 'Obsidian Ceramic & Emerald Hide',
        subtitle: 'Diamond-Lapped Mirror Surface & Hand-Finished Seams',
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
    <div className="bg-[#0B0B0B] text-[#EDEDED] relative overflow-x-hidden w-full">
      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 1: THE HERO STATEMENT
          Full-screen mobile viewport, centered sculptural centerpiece, editorial typography
          Neatly fitted to phone width without words cutting off
          ─────────────────────────────────────────────────────────────────────── */}
      <section className="min-h-[88vh] relative flex flex-col items-center justify-between text-center px-3.5 pt-8 pb-12 overflow-hidden">
        {/* Soft Velvet Emerald Atmospheric Light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] pointer-events-none rounded-full blur-[140px] bg-[#0F2E22]/40 z-0" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[220px] pointer-events-none rounded-full blur-[110px] bg-[#D4AF37]/10 z-0" />

        {/* Top Kicker - Neatly wrapping if needed */}
        <div className="relative z-10 pt-2 w-full">
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[9px] min-[360px]:text-[10px] font-meta uppercase tracking-[0.14em] text-[#D4AF37] text-center">
            <span>Atelier VANTÉRA</span>
            <span className="text-[#8E8B82]">·</span>
            <span>Est. 2026</span>
            <span className="text-[#8E8B82]">·</span>
            <span className="text-[#A9A69F]">All About Tech Finds</span>
          </div>
        </div>

        {/* Centered Monolith & Editorial Statement */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center my-auto py-4">
          {/* Editorial Serif Statement: sized for mobile so UNCOMPROMISING never overflows */}
          <h1 className="font-editorial text-[24px] min-[360px]:text-[28px] min-[400px]:text-[32px] font-bold tracking-[0.05em] uppercase text-[#F8F7F4] leading-[1.12] text-balance break-words px-2">
            Timeless <span className="gold-gradient-text">Precision.</span>
            <br />
            Uncompromising <span className="gold-gradient-text">Form.</span>
          </h1>

          {/* Minimalist Brand Philosophy */}
          <p className="font-meta text-[10px] min-[360px]:text-[11px] text-[#A9A69F] max-w-[320px] mx-auto tracking-[0.1em] uppercase font-light leading-relaxed mt-3 text-balance break-words px-2">
            Where engineering transcends utility. A curated sanctuary of bespoke tech finds sculpted for modern living.
          </p>

          {/* Centered Hyper-Stylized Product Monolith (Tactile Media Framing) */}
          <div
            className="relative mt-6 group cursor-pointer w-full max-w-[330px] mx-auto"
            onClick={() => {
              const el = document.getElementById('material-showcase');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {/* Diffuse Gold & Emerald Radial Floor Glow */}
            <div className="absolute -inset-2 bg-gradient-to-t from-[#0F2E22]/60 via-[#D4AF37]/10 to-transparent blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />

            <div className="relative rounded-xs overflow-hidden w-full shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_40px_rgba(15,46,34,0.3)] transition-transform duration-700 ease-out group-hover:scale-[1.015]">
              <img
                src="/vantera-flagship-hero.jpg"
                alt="VANTÉRA Sculptural Obsidian and Champagne Gold Wireless Dock Station"
                className="w-full h-auto object-cover max-h-[300px]"
                loading="eager"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/products/charging-phone-stand.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-transparent to-transparent opacity-60" />
            </div>

            {/* Quiet Micro Tag - No overflow */}
            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#121212]/95 backdrop-blur-md px-3 py-1 rounded-xs border border-white/10 shadow-xl text-[9px] font-meta uppercase tracking-[0.12em] text-[#D4AF37] max-w-[85vw] text-center break-words">
              Artifact No. 01 · Magnetic Obsidian Dock
            </div>
          </div>
        </div>

        {/* Hero Bottom Navigation & Smooth Glide CTA */}
        <div className="relative z-10 flex flex-col items-center gap-2.5 pt-4 w-full">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('material-showcase');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full max-w-[240px] py-2.5 px-5 rounded-xs bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-[10px] font-bold tracking-[0.15em] uppercase hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Explore The Materials</span>
            <span>↓</span>
          </button>
          <span className="text-[9px] font-meta tracking-[0.12em] uppercase text-[#6C6A64] text-center block">
            Physical Craftsmanship · Bespoke Tech Finds
          </span>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 2: THE MATERIAL SHOWCASE
          Interactive Gallery with macro-zoom inspection
          Zero word cutoff on mobile
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="material-showcase" className="relative py-14 px-3.5 w-full">
        {/* Soft Ambient Velvet Emerald Aura */}
        <div className="absolute top-1/4 right-0 w-[300px] h-[300px] pointer-events-none rounded-full blur-[140px] bg-[#0F2E22]/25" />

        {/* Section Header */}
        <div className="text-center w-full mb-8 space-y-2">
          <span className="font-meta text-[9px] min-[360px]:text-[10px] uppercase tracking-[0.18em] text-[#D4AF37] block">
            Chapter II · The Material Matrix
          </span>
          <h2 className="font-editorial text-2xl min-[360px]:text-3xl font-bold tracking-[0.06em] uppercase text-[#F8F7F4] text-balance break-words">
            Tactile <span className="gold-gradient-text">Substance.</span>
          </h2>
          <p className="font-meta text-[10px] min-[360px]:text-[11px] text-[#8E8B82] tracking-[0.08em] uppercase font-light leading-relaxed max-w-[320px] mx-auto break-words">
            Tap any artifact below to inspect micro-precision grooves, diamond lapping, and acoustic resonance in 8K Macro.
          </p>
        </div>

        {/* Vertical Stacked Material Cards for Phone */}
        <div className="flex flex-col gap-4 w-full">
          {/* Card 1: Titanium Alloy Grooves */}
          <div
            onClick={() => setActiveMacroMaterial(materialArtifacts[0])}
            className="group relative bg-[#121212]/90 rounded-xs overflow-hidden zero-border-card cursor-pointer p-4 space-y-3"
          >
            <div className="space-y-1">
              <span className="font-meta text-[9px] uppercase tracking-[0.12em] text-[#D4AF37] block break-words">
                {materialArtifacts[0].specPill}
              </span>
              <h3 className="font-editorial text-lg font-semibold text-[#F8F7F4] break-words">
                {materialArtifacts[0].name}
              </h3>
              <p className="text-[11px] text-[#8E8B82] font-sans font-light leading-snug break-words">
                {materialArtifacts[0].subtitle}
              </p>
            </div>

            {/* Macro Image Frame */}
            <div className="relative aspect-16/10 rounded-xs overflow-hidden bg-black/60">
              <img
                src={materialArtifacts[0].image}
                alt={materialArtifacts[0].name}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/80 via-transparent to-transparent opacity-40" />
              <div className="absolute bottom-2.5 right-2.5 bg-[#0B0B0B]/90 backdrop-blur-md px-2.5 py-1 rounded-xs text-[9px] font-meta uppercase tracking-[0.15em] text-[#D4AF37] flex items-center gap-1 shadow-lg">
                <span>✦ Inspect Macro</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-col min-[350px]:flex-row min-[350px]:items-center justify-between gap-1 text-[10px] font-meta text-[#8E8B82]">
              <span className="truncate">TOLERANCE: {materialArtifacts[0].tolerance}</span>
              <span className="text-[#D4AF37] font-semibold">Expand Specimen →</span>
            </div>
          </div>

          {/* Card 2: Obsidian Ceramic & Velvet Emerald Hide */}
          <div
            onClick={() => setActiveMacroMaterial(materialArtifacts[1])}
            className="group relative bg-[#121212]/90 rounded-xs overflow-hidden zero-border-card cursor-pointer p-4 space-y-3"
          >
            <div className="space-y-1">
              <span className="font-meta text-[9px] uppercase tracking-[0.12em] text-[#34A853] block break-words">
                {materialArtifacts[1].specPill}
              </span>
              <h3 className="font-editorial text-lg font-semibold text-[#F8F7F4] break-words">
                {materialArtifacts[1].name}
              </h3>
              <p className="text-[11px] text-[#8E8B82] font-sans font-light leading-snug break-words">
                {materialArtifacts[1].subtitle}
              </p>
            </div>

            <div className="relative aspect-16/10 rounded-xs overflow-hidden bg-black/60">
              <img
                src={materialArtifacts[1].image}
                alt={materialArtifacts[1].name}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute bottom-2.5 right-2.5 bg-[#0B0B0B]/90 backdrop-blur-md px-2.5 py-1 rounded-xs text-[9px] font-meta uppercase tracking-[0.15em] text-[#34A853]">
                Tactile Hide
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-col min-[350px]:flex-row min-[350px]:items-center justify-between gap-1 text-[10px] font-meta text-[#8E8B82]">
              <span>CRAFTSMANSHIP: Diamond-Lapped</span>
              <span className="text-[#D4AF37] font-semibold">Inspect Specimen →</span>
            </div>
          </div>

          {/* Card 3: Champagne Conductive Brass */}
          <div
            onClick={() => setActiveMacroMaterial(materialArtifacts[2])}
            className="group relative bg-[#121212]/90 rounded-xs overflow-hidden zero-border-card cursor-pointer p-4 space-y-3"
          >
            <div className="space-y-1">
              <span className="font-meta text-[9px] uppercase tracking-[0.12em] text-[#D4AF37] block break-words">
                {materialArtifacts[2].specPill}
              </span>
              <h3 className="font-editorial text-lg font-semibold text-[#F8F7F4] break-words">
                {materialArtifacts[2].name}
              </h3>
              <p className="text-[11px] text-[#8E8B82] font-sans font-light leading-snug break-words">
                {materialArtifacts[2].subtitle}
              </p>
            </div>

            <div className="relative aspect-16/10 rounded-xs overflow-hidden bg-black/60">
              <img
                src={materialArtifacts[2].image}
                alt={materialArtifacts[2].name}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute bottom-2.5 right-2.5 bg-[#0B0B0B]/90 backdrop-blur-md px-2.5 py-1 rounded-xs text-[9px] font-meta uppercase tracking-[0.15em] text-[#D4AF37]">
                15W Inductive
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex flex-col min-[350px]:flex-row min-[350px]:items-center justify-between gap-1 text-[10px] font-meta text-[#8E8B82]">
              <span>EFFICIENCY: 99.98% Induction</span>
              <span className="text-[#D4AF37] font-semibold">Inspect Specimen →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          CURATED TECH FINDS (MUSEUM ARTIFACTS)
          2-column phone grid with zero word cutoff
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="curated-finds" className="relative py-12 px-3.5 w-full">
        <div className="mb-6 space-y-3 border-b border-white/5 pb-5">
          <div>
            <span className="font-meta text-[9px] uppercase tracking-[0.18em] text-[#D4AF37] block mb-1">
              The Permanent Collection
            </span>
            <h2 className="font-editorial text-2xl min-[360px]:text-3xl font-bold tracking-[0.06em] uppercase text-[#F8F7F4] text-balance break-words">
              Curated <span className="gold-gradient-text">Tech Finds.</span>
            </h2>
          </div>

          {/* Clean Segmented Filter Tabs (Horizontal Scroll on Phone) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none w-full">
            <button
              type="button"
              onClick={() => setCurationTab('all')}
              className={`px-3 py-1.5 rounded-xs text-[9px] font-meta uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
                curationTab === 'all'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'bg-[#141414] text-[#8E8B82] border border-white/5'
              }`}
            >
              All Finds
            </button>
            <button
              type="button"
              onClick={() => setCurationTab('magsafe')}
              className={`px-3 py-1.5 rounded-xs text-[9px] font-meta uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
                curationTab === 'magsafe'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'bg-[#141414] text-[#8E8B82] border border-white/5'
              }`}
            >
              MagSafe & Power
            </button>
            <button
              type="button"
              onClick={() => setCurationTab('desk')}
              className={`px-3 py-1.5 rounded-xs text-[9px] font-meta uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
                curationTab === 'desk'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'bg-[#141414] text-[#8E8B82] border border-white/5'
              }`}
            >
              Desk Gear
            </button>
            <button
              type="button"
              onClick={() => setCurationTab('armor')}
              className={`px-3 py-1.5 rounded-xs text-[9px] font-meta uppercase tracking-wider shrink-0 transition-colors cursor-pointer ${
                curationTab === 'armor'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-bold shadow-xs'
                  : 'bg-[#141414] text-[#8E8B82] border border-white/5'
              }`}
            >
              Phone Armor
            </button>
          </div>
        </div>

        {/* 2-Column Product Grid for Phone Screens */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {curatedFinds.map((product) => (
            <ProductCard key={product.id} product={product} onNavigate={onNavigate} />
          ))}
        </div>

        {/* View All in Atelier */}
        <div className="text-center mt-8 pt-6 border-t border-white/5">
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="w-full py-3 px-4 rounded-xs bg-[#161616] hover:bg-[#202020] text-[#D4AF37] font-meta text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 shadow-sm cursor-pointer"
          >
            <span>View Complete Atelier Catalog ({products.length} Finds) →</span>
          </button>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          SECTION 3: THE VIP GATEWAY
          Encased in soft velvet emerald glow, invite-only registry portal
          Tailored for phone screens
          ─────────────────────────────────────────────────────────────────────── */}
      <section id="vip-gateway" className="relative py-16 px-3.5 my-8 w-full">
        {/* Soft Ambient Velvet Emerald Radiance */}
        <div className="absolute inset-0 bg-radial from-[#0F2E22]/50 via-[#0B1510]/30 to-[#0B0B0B] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full blur-[140px] bg-[#0F2E22]/50 pointer-events-none" />

        <div className="relative z-10 w-full text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xs bg-[#0F2E22]/60 text-[#48BB78] border border-[#34A853]/20 text-[9px] font-meta uppercase tracking-[0.14em]">
            <span>✦ VANTÉRA PRIVÉ · ALLOCATION REGISTRY</span>
          </div>

          <h2 className="font-editorial text-2xl min-[360px]:text-3xl font-bold tracking-[0.06em] uppercase text-[#F8F7F4] text-balance break-words">
            The Private <span className="gold-gradient-text">Registry.</span>
          </h2>

          <p className="font-meta text-[10px] min-[360px]:text-[11px] text-[#A9A69F] max-w-[320px] mx-auto tracking-[0.08em] uppercase font-light leading-relaxed text-balance break-words">
            Acquisitions at VANTÉRA are made by private allocation. Register for bespoke material finishes and VIP concierge dispatch.
          </p>

          {/* VIP Registry Registration Form */}
          {vipRegisteredKey ? (
            <div className="bg-[#121E18]/90 border border-[#34A853]/30 p-5 rounded-xs w-full shadow-[0_20px_50px_rgba(15,46,34,0.4)] space-y-3 animate-in fade-in zoom-in-95 duration-300">
              <span className="text-[10px] font-meta uppercase tracking-[0.18em] text-[#D4AF37] block">
                Privé Allocation Key Assigned
              </span>
              <div className="font-mono text-xl min-[360px]:text-2xl font-bold tracking-widest text-[#F8F7F4] bg-black/50 py-2.5 rounded-xs border border-white/5 break-all">
                {vipRegisteredKey}
              </div>
              <p className="text-[11px] text-[#A9A69F] font-sans leading-snug">
                Welcome to VANTÉRA Privé. Present this key on WhatsApp to confirm priority allocations with the master concierge.
              </p>
              <div className="pt-1">
                <a
                  href={`https://wa.me/2349132793670?text=${encodeURIComponent(
                    `Hello VANTÉRA Concierge, I have registered my allocation key: ${vipRegisteredKey}. Kindly confirm my VIP atelier enrollment.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xs bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-[10px] font-bold tracking-[0.15em] uppercase hover:opacity-90"
                >
                  <span>Connect With Concierge ↗</span>
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVipSubmit} className="w-full space-y-3 pt-2">
              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={vipName}
                  onChange={(e) => setVipName(e.target.value)}
                  placeholder="Client Full Name"
                  className="w-full bg-[#121212]/90 border border-white/10 rounded-xs px-3.5 py-2.5 text-xs text-[#F8F7F4] placeholder-[#6C6A64] focus:outline-hidden focus:border-[#D4AF37] font-sans"
                  required
                />
                <input
                  type="email"
                  value={vipEmail}
                  onChange={(e) => setVipEmail(e.target.value)}
                  placeholder="Client Email Address"
                  className="w-full bg-[#121212]/90 border border-white/10 rounded-xs px-3.5 py-2.5 text-xs text-[#F8F7F4] placeholder-[#6C6A64] focus:outline-hidden focus:border-[#D4AF37] font-sans"
                  required
                />
                <select
                  value={vipCategory}
                  onChange={(e) => setVipCategory(e.target.value)}
                  className="w-full bg-[#121212]/90 border border-white/10 rounded-xs px-3.5 py-2.5 text-xs text-[#A9A69F] focus:outline-hidden focus:border-[#D4AF37] font-meta uppercase tracking-wider"
                >
                  <option value="All Atelier Finds">All Atelier Allocations</option>
                  <option value="MagSafe Wireless Docks">MagSafe Wireless Docks</option>
                  <option value="Titanium Phone Armor">Titanium Phone Armor</option>
                  <option value="Acoustic Soundstages">Acoustic Soundstages</option>
                </select>

                <button
                  type="submit"
                  disabled={isRegisteringVip}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-xs font-bold tracking-[0.18em] uppercase py-3 px-4 rounded-xs hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all cursor-pointer"
                >
                  {isRegisteringVip ? 'Allocating Key...' : 'Request VIP Allocation'}
                </button>
              </div>

              <p className="text-[9px] font-meta text-[#6C6A64] tracking-[0.14em] uppercase pt-1">
                Discreet enrollment · Zero marketing spam · Confidential
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────
          TACTILE CRAFTSMANSHIP MACRO ZOOM STUDIO (MODAL)
          Fits cleanly inside phone screen
          ─────────────────────────────────────────────────────────────────────── */}
      {activeMacroMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300 overflow-y-auto">
          <div className="relative bg-[#0F0F0F] max-w-[400px] w-full rounded-xs shadow-[0_25px_80px_rgba(0,0,0,0.98),0_0_60px_rgba(15,46,34,0.4)] border border-white/10 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveMacroMaterial(null)}
              aria-label="Close macro studio"
              className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/80 text-[#A9A69F] hover:text-[#D4AF37] transition-colors"
            >
              ✕
            </button>

            {/* Interactive Macro Pan & Zoom Viewport */}
            <div
              className="relative bg-black flex items-center justify-center overflow-hidden cursor-crosshair min-h-[220px] max-h-[260px] touch-none"
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
              <div className="absolute bottom-2 inset-x-2 flex items-center justify-between pointer-events-auto bg-[#0B0B0B]/90 backdrop-blur-md px-3 py-1.5 rounded-xs border border-white/10 text-[9px] font-meta tracking-wider text-[#A9A69F]">
                <div className="flex items-center gap-1.5">
                  <span>MAG:</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.2)}
                    className={`px-1.5 py-0.5 rounded-xs ${zoomLevel === 1.2 ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#8E8B82]'}`}
                  >
                    1.2X
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.8)}
                    className={`px-1.5 py-0.5 rounded-xs ${zoomLevel === 1.8 ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#8E8B82]'}`}
                  >
                    1.8X
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(2.5)}
                    className={`px-1.5 py-0.5 rounded-xs ${zoomLevel === 2.5 ? 'bg-[#D4AF37] text-black font-bold' : 'text-[#8E8B82]'}`}
                  >
                    2.5X
                  </button>
                </div>
                <span className="text-[#6C6A64]">Drag to pan</span>
              </div>
            </div>

            {/* Tactile Craftsmanship Dossier */}
            <div className="p-4 flex flex-col justify-between overflow-y-auto space-y-4">
              <div className="space-y-2">
                <span className="font-meta text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] block">
                  Tactile Specimen Dossier
                </span>
                <h3 className="font-editorial text-lg font-bold text-[#F8F7F4] break-words">
                  {activeMacroMaterial.name}
                </h3>
                <p className="text-[11px] font-sans text-[#8E8B82] leading-snug break-words">
                  {activeMacroMaterial.subtitle}
                </p>

                <div className="pt-2 space-y-2.5 border-t border-white/5 text-[11px] text-[#A9A69F] leading-relaxed">
                  <p className="break-words">{activeMacroMaterial.craftsmanshipNotes}</p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-[#141414] p-2.5 rounded-xs border border-white/5">
                      <span className="block font-meta text-[8px] uppercase tracking-wider text-[#6C6A64]">
                        Tolerance
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[#D4AF37] truncate block">
                        {activeMacroMaterial.tolerance}
                      </span>
                    </div>
                    <div className="bg-[#141414] p-2.5 rounded-xs border border-white/5">
                      <span className="block font-meta text-[8px] uppercase tracking-wider text-[#6C6A64]">
                        Acoustics
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[#34A853] truncate block">
                        Dampened
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acquisition CTA */}
              <div className="pt-3 border-t border-white/5 space-y-2">
                <button
                  type="button"
                  onClick={() => handleAcquireRelated(activeMacroMaterial.relatedProductId)}
                  className="w-full bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-meta text-[11px] font-bold tracking-[0.18em] uppercase py-3 rounded-xs hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Acquire Related Artifact</span>
                  <span>✦</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
