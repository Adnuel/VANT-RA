import React, { useState } from 'react';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { CartDrawer } from './CartDrawer.tsx';
import { AndroidInstallModal } from './AndroidInstallModal.tsx';

interface StoreLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (url: string) => void;
}

export const StoreLayout: React.FC<StoreLayoutProps> = ({ children, activePath, onNavigate }) => {
  const { itemCount, setIsCartOpen } = useCart();
  const { user } = useAuth();
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
    <div className="min-h-screen bg-[#070707] text-[#EDEDED] flex justify-center font-sans selection:bg-[#D4AF37]/30 selection:text-white relative overflow-x-hidden">
      {/* Centered Phone Shell - Fits neatly onto actual phone screens and stays phone-sized on desktop */}
      <div className="w-full max-w-[430px] min-h-screen bg-[#0B0B0B] text-[#EDEDED] flex flex-col relative sm:border-x sm:border-white/5 sm:shadow-[0_0_90px_rgba(0,0,0,0.95)] overflow-x-hidden">
        
        {/* Subtle Velvet Emerald Atmosphere Light */}
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[430px] h-[300px] pointer-events-none rounded-full blur-[140px] bg-[#0F2E22]/25 z-0" />

        {/* Compact Phone Header - Zero-Border Glassmorphism */}
        <header className="sticky top-0 z-40 bg-[#0B0B0B]/90 backdrop-blur-xl transition-all duration-300 relative border-b border-white/5">
          <div className="px-3.5 h-15 flex items-center justify-between">
            {/* Brand Wordmark (Editorial Serif) */}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setIsMobileMenuOpen(false);
                onNavigate('/');
              }}
              className="group flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span className="font-editorial text-lg font-bold tracking-[0.25em] uppercase text-[#F8F7F4] group-hover:text-[#D4AF37] transition-colors">
                VANTÉRA
              </span>
            </a>

            {/* Right Action Icons for Phone */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Currency Selector (USD / NGN) */}
              <div className="flex items-center text-[10px] font-mono tracking-wider bg-[#141414] px-1.5 py-0.5 rounded-xs border border-white/5 mr-1">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-1.5 py-0.5 transition-colors cursor-pointer rounded-xs ${
                    currency === 'USD'
                      ? 'text-[#D4AF37] font-bold bg-[#D4AF37]/15'
                      : 'text-[#6C6A64] hover:text-[#EDEDED]'
                  }`}
                >
                  USD
                </button>
                <span className="text-white/10">/</span>
                <button
                  type="button"
                  onClick={() => setCurrency('NGN')}
                  className={`px-1.5 py-0.5 transition-colors cursor-pointer rounded-xs ${
                    currency === 'NGN'
                      ? 'text-[#D4AF37] font-bold bg-[#D4AF37]/15'
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
                className="p-1.5 text-[#8E8B82] hover:text-[#D4AF37] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* VIP Bag Trigger */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                aria-label={`Open Bag with ${itemCount} items`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xs bg-[#161616] hover:bg-[#1E1E1E] text-[#EDEDED] text-[10px] tracking-wider uppercase font-medium transition-all duration-300 hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] cursor-pointer group"
              >
                <span className="text-[#D4AF37]">✦</span>
                <span className="text-[#F8F7F4]">Bag</span>
                <span className="font-mono text-[#D4AF37] font-bold">({itemCount})</span>
              </button>

              {/* Mobile Drawer Menu Toggle */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle navigation menu"
                className="p-1.5 text-[#EDEDED] hover:text-[#D4AF37] transition-colors ml-0.5 cursor-pointer"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Slide-Down Mobile Drawer Menu */}
          {isMobileMenuOpen && (
            <div className="bg-[#0F0F0F] border-b border-white/10 px-5 py-6 space-y-5 animate-in slide-in-from-top-2 duration-300">
              <span className="text-[9px] uppercase font-meta tracking-[0.22em] text-[#7E7B74] block">
                Atelier Directory
              </span>
              <nav className="flex flex-col space-y-3 text-xs font-editorial tracking-wider text-[#EDEDED]">
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate('/');
                  }}
                  className="py-1.5 hover:text-[#D4AF37] flex items-center justify-between"
                >
                  <span>Atelier Overview</span>
                  <span className="text-[#D4AF37]">→</span>
                </a>
                <a
                  href="/shop"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate('/shop');
                  }}
                  className="py-1.5 hover:text-[#D4AF37] flex items-center justify-between"
                >
                  <span>All Tech Finds ({itemCount} in bag)</span>
                  <span className="text-[#D4AF37]">→</span>
                </a>
                <a
                  href="/category/charging"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate('/category/charging');
                  }}
                  className="py-1.5 hover:text-[#D4AF37] flex items-center justify-between"
                >
                  <span>MagSafe & Wireless Docks</span>
                  <span className="text-[#D4AF37]">→</span>
                </a>
                <a
                  href="/category/phone-cases"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate('/category/phone-cases');
                  }}
                  className="py-1.5 hover:text-[#D4AF37] flex items-center justify-between"
                >
                  <span>Titanium Phone Armor</span>
                  <span className="text-[#D4AF37]">→</span>
                </a>
                <a
                  href="/category/room-desk"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate('/category/room-desk');
                  }}
                  className="py-1.5 hover:text-[#D4AF37] flex items-center justify-between"
                >
                  <span>Sculptural Desk Gear</span>
                  <span className="text-[#D4AF37]">→</span>
                </a>
                <a
                  href="/track"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate('/track');
                  }}
                  className="py-1.5 hover:text-[#D4AF37] flex items-center justify-between text-[#8E8B82]"
                >
                  <span>Track Existing Order</span>
                  <span className="text-[#8E8B82]">→</span>
                </a>
              </nav>

              <div className="pt-3 border-t border-white/5 space-y-2">
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNavigate('/account');
                    }}
                    className="w-full text-left py-1 text-xs text-[#34A853] font-meta uppercase tracking-wider flex items-center justify-between"
                  >
                    <span>Client Profile ({user.name.split(' ')[0]})</span>
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNavigate('/account');
                    }}
                    className="w-full text-left py-1 text-xs text-[#A9A69F] hover:text-[#D4AF37] font-meta uppercase tracking-wider flex items-center justify-between"
                  >
                    <span>VIP Client Sign In</span>
                    <span>→</span>
                  </button>
                )}
                <a
                  href="https://wa.me/2349132793670"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#5E8A75] hover:text-[#D4AF37] font-meta uppercase tracking-wider flex items-center justify-between pt-1"
                >
                  <span>WhatsApp VIP Concierge</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          )}
        </header>

        {/* Search Modal in Obsidian Luxury - Constrained to Phone Width */}
        {isSearchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 px-3">
            <div className="bg-[#121212] w-full max-w-[400px] p-5 rounded-xs shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_30px_rgba(212,175,55,0.08)] border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-[#D4AF37] font-meta block">
                    VANTÉRA SEARCH
                  </span>
                  <h3 className="font-editorial text-base font-medium text-[#F8F7F4] mt-0.5">
                    Find Curated Tech Finds
                  </h3>
                </div>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[#8E8B82] hover:text-[#D4AF37] p-1.5 text-base transition-colors"
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
                    placeholder="Search docks, armor, sound..."
                    className="w-full bg-[#181818] border border-white/10 rounded-xs py-2.5 px-3 text-xs text-[#F8F7F4] placeholder-[#6C6A64] focus:outline-hidden focus:border-[#D4AF37] font-sans pr-20 transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] text-[10px] px-3 py-1.5 font-bold tracking-wider uppercase rounded-xs hover:opacity-90 transition-opacity"
                  >
                    Go
                  </button>
                </div>
              </form>

              {/* Suggestions */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <span className="text-[9px] uppercase font-meta tracking-[0.18em] text-[#7E7B74] block mb-2">
                  Suggestions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['MagSafe Charger', 'Titanium Case', 'Desk Lamp', 'Earbuds', 'Hub'].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setSearchQuery(term);
                        setIsSearchOpen(false);
                        onNavigate(`/shop?q=${encodeURIComponent(term)}`);
                      }}
                      className="text-[10px] bg-[#1A1A1A] hover:bg-[#D4AF37] hover:text-[#0B0B0B] text-[#A9A69F] px-2.5 py-1 rounded-xs transition-colors cursor-pointer"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 relative z-10 pb-20 overflow-x-hidden">{children}</main>

        {/* Phone Colophon / Footer - Zero Horizontal Overflow */}
        <footer className="relative z-10 bg-gradient-to-b from-[#0B0B0B] via-[#091410] to-[#070D0B] pt-14 pb-8 px-4 text-[#A9A69F] border-t border-white/5">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-editorial text-xl font-bold tracking-[0.25em] uppercase text-[#F8F7F4]">
                  VANTÉRA
                </span>
                <span className="text-[#D4AF37] text-xs">✦</span>
              </div>
              <p className="font-editorial italic text-xs text-[#D4AF37]/90 tracking-wide">
                All About Tech Finds.
              </p>
              <p className="text-[11px] text-[#8E8B82] leading-relaxed mt-2 font-sans font-light break-words">
                Curated digital craftsmanship, metallic phone armor, inductive charging stands, and tactile desk aesthetics.
              </p>
            </div>

            {/* Private Gazette Subscription */}
            <div className="bg-[#121212] p-3.5 rounded-xs border border-white/5 space-y-2">
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#D4AF37] font-meta block">
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
                  placeholder="Client email address"
                  className="flex-1 bg-[#181818] border border-white/10 px-3 py-1.5 text-xs text-[#F8F7F4] placeholder-[#5C5A55] focus:outline-hidden focus:border-[#D4AF37] rounded-xs"
                  required
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === 'submitting'}
                  className="bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-xs hover:opacity-90 shrink-0 cursor-pointer"
                >
                  {newsletterStatus === 'submitting' ? '...' : 'Join'}
                </button>
              </form>
              {newsletterStatus === 'success' && (
                <p className="text-[10px] text-[#48BB78]">✓ Privé enrollment cataloged.</p>
              )}
            </div>

            {/* Quick 2-Column Links */}
            <div className="grid grid-cols-2 gap-4 text-xs text-[#8E8B82] pt-2">
              <div className="space-y-2">
                <h4 className="font-meta text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                  Curations
                </h4>
                <ul className="space-y-1.5 text-[11px]">
                  <li>
                    <button type="button" onClick={() => onNavigate('/shop')} className="hover:text-[#F8F7F4] text-left">
                      All Tech Finds
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => onNavigate('/category/charging')} className="hover:text-[#F8F7F4] text-left">
                      MagSafe Docks
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => onNavigate('/category/phone-cases')} className="hover:text-[#F8F7F4] text-left">
                      Phone Armor
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => onNavigate('/category/room-desk')} className="hover:text-[#F8F7F4] text-left">
                      Desk Sculptures
                    </button>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-meta text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                  Concierge
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <a
                      href="https://wa.me/2349132793670"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5E8A75] hover:text-[#D4AF37] font-mono flex items-center gap-1"
                    >
                      <span>WhatsApp Support</span>
                      <span className="text-[9px]">↗</span>
                    </a>
                  </div>
                  <div>
                    <a
                      href="mailto:emmanueladarikwu@gmail.com"
                      className="text-[#8E8B82] hover:text-[#D4AF37] break-all block text-[10px]"
                    >
                      emmanueladarikwu@gmail.com
                    </a>
                  </div>
                  <li>
                    <button type="button" onClick={() => onNavigate('/track')} className="hover:text-[#F8F7F4] text-left">
                      Order Verification
                    </button>
                  </li>
                </div>
              </div>
            </div>

            {/* Bottom Colophon */}
            <div className="pt-6 border-t border-white/5 flex flex-col items-center gap-2 text-[10px] text-[#6C6A64] text-center">
              <div>© 2026 VANTÉRA. All rights reserved.</div>
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button type="button" onClick={() => onNavigate('/privacy')} className="hover:text-[#D4AF37]">Privacy</button>
                <span>·</span>
                <button type="button" onClick={() => onNavigate('/terms')} className="hover:text-[#D4AF37]">Terms</button>
                <span>·</span>
                <button type="button" onClick={() => onNavigate('/track')} className="hover:text-[#D4AF37]">Track</button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setIsAndroidModalOpen(true)}
                  className="text-[#8E8B82] hover:text-[#D4AF37] cursor-pointer inline-flex items-center gap-1"
                >
                  <span>📱</span>
                  <span>Android App</span>
                </button>
              </div>
            </div>
          </div>
        </footer>

        {/* Sticky Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Navigation"
          className="sticky bottom-0 inset-x-0 z-40 bg-[#0E0E0E]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around py-2 px-1 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-10px_25px_rgba(0,0,0,0.8)]"
        >
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 transition-colors cursor-pointer ${
              activePath === '/' ? 'text-[#D4AF37]' : 'text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activePath === '/' ? 2.2 : 1.7} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[9px] font-meta uppercase tracking-wider font-medium">Atelier</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 transition-colors cursor-pointer ${
              activePath.includes('shop') || activePath.includes('category') ? 'text-[#D4AF37]' : 'text-[#8E8B82] hover:text-[#EDEDED]'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activePath.includes('shop') ? 2.2 : 1.7} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[9px] font-meta uppercase tracking-wider font-medium">Finds</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 text-[#8E8B82] hover:text-[#D4AF37] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-[9px] font-meta uppercase tracking-wider font-medium">Search</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 text-[#8E8B82] hover:text-[#D4AF37] transition-colors cursor-pointer"
          >
            <div className="relative">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-gradient-to-r from-[#D4AF37] to-[#AA7C11] text-[#0B0B0B] font-mono text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-meta uppercase tracking-wider font-medium">Bag</span>
          </button>

          <a
            href="https://wa.me/2349132793670"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 text-[#5E8A75] hover:text-[#D4AF37] transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.815.82 2.8.82 3.18 0 5.767-2.586 5.768-5.766 0-3.18-2.587-5.766-5.772-5.766zm0-1.672c4.103 0 7.437 3.334 7.437 7.438 0 4.103-3.334 7.438-7.438 7.438-1.218 0-2.378-.303-3.398-.862l-4.633 1.216 1.237-4.521c-.636-1.077-.978-2.308-.978-3.271 0-4.104 3.334-7.438 7.438-7.438z" />
            </svg>
            <span className="text-[9px] font-meta uppercase tracking-wider font-medium">VIP</span>
          </a>
        </nav>

        {/* Cart Drawer */}
        <CartDrawer onNavigate={onNavigate} />

        {/* Android Installation & APK Modal */}
        <AndroidInstallModal
          isOpen={isAndroidModalOpen}
          onClose={() => setIsAndroidModalOpen(false)}
        />
      </div>
    </div>
  );
};
