import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { CartDrawer } from './CartDrawer.tsx';
import { AndroidInstallModal } from './AndroidInstallModal.tsx';
import { downloadProjectZip } from '../lib/downloadZip.ts';

interface StoreLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (url: string) => void;
}

const NairaGlyph: React.FC<{ className?: string }> = ({ className = 'w-2.5 h-2.5 inline-block -mt-0.5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 19V5l16 14V5" />
    <path d="M1.5 10h21" />
    <path d="M1.5 14h21" />
  </svg>
);

export const StoreLayout: React.FC<StoreLayoutProps> = ({ children, activePath, onNavigate }) => {
  const { itemCount, setIsCartOpen } = useCart();
  const { user, logoutCustomer } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    onNavigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#EDEDED] flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white relative">
      {/* Subtle Velvet Emerald Atmosphere Light */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[400px] pointer-events-none rounded-full blur-[180px] bg-[#0F2E22]/30 z-0" />

      {/* Main Header - Zero-Border Glassmorphism */}
      <header className="sticky top-0 z-40 bg-[#0B0B0B]/80 backdrop-blur-xl transition-all duration-300 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
          {/* Brand Wordmark (Editorial Serif, High-Fashion Tracking) */}
          <div className="flex items-center gap-4 sm:gap-10">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setIsMobileMenuOpen(false);
                onNavigate('/');
              }}
              className="group flex items-center gap-3 cursor-pointer shrink-0"
            >
              <span className="font-editorial text-xl sm:text-2xl font-bold tracking-[0.3em] uppercase text-[#F8F7F4] group-hover:text-[#D4AF37] transition-colors">
                VANTÉRA
              </span>
            </a>

            {/* Desktop Navigation (Quiet, Widely-Spaced Sans) */}
            <nav className="hidden lg:flex items-center gap-8 xl:gap-10 text-[11px] font-medium tracking-[0.22em] uppercase text-[#A9A69F]">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/');
                }}
                className={`transition-colors hover:text-[#D4AF37] py-1 ${
                  activePath === '/' ? 'text-[#D4AF37] font-semibold' : 'text-[#8E8B82]'
                }`}
              >
                Atelier
              </a>
              <a
                href="#material-showcase"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById('material-showcase');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else onNavigate('/#material-showcase');
                }}
                className="transition-colors hover:text-[#D4AF37] py-1 text-[#8E8B82]"
              >
                Materials
              </a>
              <a
                href="/shop"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/shop');
                }}
                className={`transition-colors hover:text-[#D4AF37] py-1 ${
                  activePath.includes('shop') ? 'text-[#D4AF37] font-semibold' : 'text-[#8E8B82]'
                }`}
              >
                Curations
              </a>
              <a
                href="#vip-gateway"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById('vip-gateway');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else onNavigate('/#vip-gateway');
                }}
                className="transition-colors hover:text-[#D4AF37] py-1 text-[#8E8B82]"
              >
                VIP Registry
              </a>
              <a
                href="https://wa.me/2349132793670"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-[#D4AF37] py-1 text-[#5E8A75] hover:text-[#D4AF37] flex items-center gap-1.5"
              >
                <span>Concierge</span>
              </a>
            </nav>
          </div>

          {/* Right Actions - Ultra-refined Gold & Obsidian Controls */}
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
            {/* Currency Selector (USD / NGN) */}
            <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono tracking-widest text-[#7E7B74]">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2 py-1 transition-colors cursor-pointer rounded-xs ${
                  currency === 'USD'
                    ? 'text-[#D4AF37] font-bold bg-[#D4AF37]/10'
                    : 'text-[#6C6A64] hover:text-[#EDEDED]'
                }`}
              >
                USD
              </button>
              <span className="text-white/10">/</span>
              <button
                type="button"
                onClick={() => setCurrency('NGN')}
                className={`px-2 py-1 transition-colors cursor-pointer rounded-xs ${
                  currency === 'NGN'
                    ? 'text-[#D4AF37] font-bold bg-[#D4AF37]/10'
                    : 'text-[#6C6A64] hover:text-[#EDEDED]'
                }`}
              >
                NGN
              </button>
            </div>

            {/* Search Affordance */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search curated finds"
              className="p-2 text-[#8E8B82] hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Customer Account Button */}
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('/account')}
                className="hidden sm:inline-flex items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-[#C8C4BD] hover:text-[#D4AF37] transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]"></span>
                <span>{user.name.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/account')}
                className="hidden sm:inline-flex items-center gap-1.5 text-[11px] tracking-[0.18em] uppercase text-[#8E8B82] hover:text-[#D4AF37] transition-colors"
              >
                <span>Client Sign In</span>
              </button>
            )}

            {/* VIP Bag Trigger (Liquid Champagne Gold Accent) */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Open Bag with ${itemCount} items`}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xs bg-[#161616] hover:bg-[#1E1E1E] text-[#EDEDED] text-[11px] tracking-[0.2em] uppercase font-medium transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] cursor-pointer group"
            >
              <span className="text-[#D4AF37] group-hover:scale-110 transition-transform">✦</span>
              <span className="text-[#F8F7F4]">Bag</span>
              <span className="font-mono text-[#D4AF37] font-bold">({itemCount})</span>
            </button>

            {/* Mobile Navigation Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="lg:hidden p-2 text-[#EDEDED] hover:text-[#D4AF37] transition-colors"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Over Drawer in Obsidian Black */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#0F0F0F] border-b border-white/5 px-6 py-8 space-y-6 animate-in slide-in-from-top-2 duration-300">
            <span className="text-[10px] uppercase font-meta tracking-[0.25em] text-[#7E7B74]">Atelier Navigation</span>
            <nav className="flex flex-col space-y-4 text-sm font-editorial tracking-[0.15em] text-[#EDEDED]">
              <a
                href="/"
                onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/'); }}
                className="py-2 hover:text-[#D4AF37] flex items-center justify-between"
              >
                <span>Atelier Overview</span>
                <span className="text-[#D4AF37]">→</span>
              </a>
              <a
                href="#material-showcase"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  const el = document.getElementById('material-showcase');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else onNavigate('/#material-showcase');
                }}
                className="py-2 hover:text-[#D4AF37] flex items-center justify-between"
              >
                <span>Tactile Materials</span>
                <span className="text-[#D4AF37]">→</span>
              </a>
              <a
                href="/shop"
                onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/shop'); }}
                className="py-2 hover:text-[#D4AF37] flex items-center justify-between"
              >
                <span>Curated Tech Finds</span>
                <span className="text-[#D4AF37]">→</span>
              </a>
              <a
                href="#vip-gateway"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  const el = document.getElementById('vip-gateway');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else onNavigate('/#vip-gateway');
                }}
                className="py-2 hover:text-[#D4AF37] flex items-center justify-between text-[#D4AF37]"
              >
                <span>Private VIP Registry</span>
                <span>✦</span>
              </a>
              <a
                href="https://wa.me/2349132793670"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 text-[#5E8A75] hover:text-[#D4AF37] flex items-center justify-between"
              >
                <span>WhatsApp VIP Concierge</span>
                <span>↗</span>
              </a>
            </nav>
            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <span className="text-[#7E7B74]">Currency:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-1 rounded-xs ${currency === 'USD' ? 'text-[#D4AF37] bg-white/5 font-bold' : 'text-[#7E7B74]'}`}
                >
                  USD ($)
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('NGN')}
                  className={`px-3 py-1 rounded-xs ${currency === 'NGN' ? 'text-[#D4AF37] bg-white/5 font-bold' : 'text-[#7E7B74]'}`}
                >
                  NGN (₦)
                </button>
              </div>
            </div>
          </div>
        )}
      </header>


      {/* Search Modal in Obsidian Luxury */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#121212] w-full max-w-2xl mx-4 p-8 rounded-xs shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.08)] border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] font-meta block">VANTÉRA ATELIER SEARCH</span>
                <h3 className="font-editorial text-xl font-medium text-[#F8F7F4] mt-1">Discover Curated Tech Finds</h3>
              </div>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-[#8E8B82] hover:text-[#D4AF37] p-2 text-base transition-colors"
                aria-label="Close search"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search magnetic docks, titanium armor, soundstages..."
                  className="w-full bg-[#181818] border border-white/10 rounded-xs py-3.5 px-4 text-sm text-[#F8F7F4] placeholder-[#6C6A64] focus:outline-hidden focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] font-sans pr-28 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] text-xs px-5 py-2 font-semibold tracking-wider uppercase rounded-xs hover:opacity-90 transition-opacity"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Quick Suggestions */}
            <div className="mt-6 pt-4 border-t border-white/5">
              <span className="text-[10px] uppercase font-meta tracking-[0.2em] text-[#7E7B74] block mb-2.5">Editorial Suggestions</span>
              <div className="flex flex-wrap gap-2">
                {[
                  '3-in-1 Foldable MagSafe',
                  'Titanium Armor Case',
                  'Wireless Earbuds',
                  'Sculptural Desk Lamp',
                  'Fast USB-C Hub',
                  'Acoustic Soundstage',
                ].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      setIsSearchOpen(false);
                      onNavigate(`/shop?q=${encodeURIComponent(term)}`);
                    }}
                    className="text-xs bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-[#0B0B0B] text-[#A9A69F] px-3 py-1.5 rounded-xs transition-colors cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Page Slot */}
      <main className="flex-1 relative z-10">{children}</main>

      {/* Luxury Colophon Footer - Zero hard borders, Velvet Emerald ambient glow */}
      <footer className="relative z-10 bg-gradient-to-b from-[#0B0B0B] via-[#091410] to-[#070D0B] pt-24 pb-16 text-[#A9A69F]">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] pointer-events-none rounded-full blur-[160px] bg-[#0F2E22]/35" />

        <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-16">
            {/* Heritage Brand Statement */}
            <div className="md:col-span-5 space-y-5">
              <div className="flex items-center gap-3">
                <span className="font-editorial text-2xl font-bold tracking-[0.3em] uppercase text-[#F8F7F4]">
                  VANTÉRA
                </span>
                <span className="text-[#D4AF37] text-xs">✦</span>
              </div>
              <p className="font-editorial italic text-sm text-[#D4AF37]/90 tracking-wide">
                All About Tech Finds.
              </p>
              <p className="text-xs text-[#8E8B82] leading-relaxed max-w-md font-sans">
                Curating fine digital craftsmanship, high-grade metallic armor, inductive charging sculptures, and viral workspace finds. Designed for individuals who demand tactile perfection and unyielding aesthetics.
              </p>

              {/* Private Registry Invitation */}
              <div className="pt-2 max-w-sm">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] font-meta block mb-2">
                  Atelier Private Gazette
                </span>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newsletterEmail) return;
                    setNewsletterStatus('submitting');
                    try {
                      const res = await fetch('/api/newsletter', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: newsletterEmail }),
                      });
                      if (res.ok) {
                        setNewsletterStatus('success');
                        setNewsletterEmail('');
                      } else {
                        setNewsletterStatus('error');
                      }
                    } catch {
                      setNewsletterStatus('error');
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter private client email"
                    className="flex-1 bg-[#141414] border border-white/10 px-3.5 py-2 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:outline-hidden focus:border-[#D4AF37] rounded-xs"
                    required
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'submitting'}
                    className="bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xs hover:opacity-90 transition-opacity shrink-0 cursor-pointer"
                  >
                    {newsletterStatus === 'submitting' ? '...' : 'Register'}
                  </button>
                </form>
                {newsletterStatus === 'success' && (
                  <p className="text-[10px] text-[#48BB78] mt-1.5">✓ Client registry updated. Welcome to VANTÉRA Privé.</p>
                )}
                {newsletterStatus === 'error' && (
                  <p className="text-[10px] text-[#F56565] mt-1.5">Please provide a valid client email address.</p>
                )}
              </div>
            </div>

            {/* Collections */}
            <div className="md:col-span-2 space-y-4">
              <h4 className="font-meta text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                Collections
              </h4>
              <ul className="space-y-2.5 text-xs text-[#8E8B82]">
                <li>
                  <a href="/shop" onClick={(e) => { e.preventDefault(); onNavigate('/shop'); }} className="hover:text-[#F8F7F4] transition-colors">
                    All Tech Finds
                  </a>
                </li>
                <li>
                  <a href="/category/charging" onClick={(e) => { e.preventDefault(); onNavigate('/category/charging'); }} className="hover:text-[#F8F7F4] transition-colors">
                    MagSafe & Power Docks
                  </a>
                </li>
                <li>
                  <a href="/category/phone-cases" onClick={(e) => { e.preventDefault(); onNavigate('/category/phone-cases'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Titanium Phone Armor
                  </a>
                </li>
                <li>
                  <a href="/category/room-desk" onClick={(e) => { e.preventDefault(); onNavigate('/category/room-desk'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Sculptural Desk Gear
                  </a>
                </li>
                <li>
                  <a href="/category/audio" onClick={(e) => { e.preventDefault(); onNavigate('/category/audio'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Acoustic Soundstages
                  </a>
                </li>
              </ul>
            </div>

            {/* Atelier Information */}
            <div className="md:col-span-2 space-y-4">
              <h4 className="font-meta text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                Atelier
              </h4>
              <ul className="space-y-2.5 text-xs text-[#8E8B82]">
                <li>
                  <a href="/about" onClick={(e) => { e.preventDefault(); onNavigate('/about'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Design Philosophy
                  </a>
                </li>
                <li>
                  <a href="/faq" onClick={(e) => { e.preventDefault(); onNavigate('/faq'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Acquisition & Dispatch
                  </a>
                </li>
                <li>
                  <a href="/shipping" onClick={(e) => { e.preventDefault(); onNavigate('/shipping'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Insured Global Transit
                  </a>
                </li>
                <li>
                  <a href="/track" onClick={(e) => { e.preventDefault(); onNavigate('/track'); }} className="hover:text-[#F8F7F4] transition-colors">
                    Order Verification
                  </a>
                </li>
              </ul>
            </div>

            {/* VIP Client Services */}
            <div className="md:col-span-3 space-y-4">
              <h4 className="font-meta text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
                VIP Concierge
              </h4>
              <div className="space-y-3 text-xs text-[#8E8B82]">
                <div>
                  <span className="block text-[10px] uppercase font-meta tracking-[0.2em] text-[#6C6A64]">Direct Atelier Email</span>
                  <a href="mailto:emmanueladarikwu@gmail.com" className="text-[#EDEDED] hover:text-[#D4AF37] font-mono transition-colors">
                    emmanueladarikwu@gmail.com
                  </a>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-meta tracking-[0.2em] text-[#6C6A64]">WhatsApp VIP Concierge</span>
                  <a href="https://wa.me/2349132793670" target="_blank" rel="noopener noreferrer" className="text-[#5E8A75] hover:text-[#D4AF37] font-mono transition-colors flex items-center gap-1.5">
                    <span>+234 913 279 3670</span>
                    <span className="text-[10px]">↗</span>
                  </a>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-meta tracking-[0.2em] text-[#6C6A64]">Settlement Methods</span>
                  <span className="text-[#EDEDED] font-meta text-[11px]">Direct Bank Wire & Card at Allocation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Colophon - Zero hard borders */}
          <div className="mt-20 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#6C6A64]">
            <div>
              © 2026 VANTÉRA. All rights reserved. Curated Luxury Tech Finds.
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('/privacy'); }} className="hover:text-[#D4AF37] transition-colors">Privacy</a>
              <span>·</span>
              <a href="/terms" onClick={(e) => { e.preventDefault(); onNavigate('/terms'); }} className="hover:text-[#D4AF37] transition-colors">Terms</a>
              <span>·</span>
              <a href="/track" onClick={(e) => { e.preventDefault(); onNavigate('/track'); }} className="hover:text-[#D4AF37] transition-colors">Track Order</a>
              <span>·</span>
              <button
                type="button"
                onClick={() => setIsAndroidModalOpen(true)}
                className="text-[#8E8B82] hover:text-[#D4AF37] transition-colors cursor-pointer inline-flex items-center gap-1"
                title="VANTÉRA Android Experience"
              >
                <span>📱</span>
                <span>Android App</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Cart Drawer */}
      <CartDrawer onNavigate={onNavigate} />

      {/* Android Installation & APK Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />
    </div>
  );
};
