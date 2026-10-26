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
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleDownload = async () => {
    setIsDownloadingZip(true);
    try {
      await downloadProjectZip();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    onNavigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#121210] flex flex-col font-sans selection:bg-[#c4a66b]/30">
      {/* Top Banner Notice */}
      <div className="bg-[#121210] text-[#f8f7f4] text-[11px] py-1.5 px-4 text-center border-b border-[#252521] flex items-center justify-center gap-2 flex-wrap">
        <span className="font-semibold tracking-wider uppercase text-[#c4a66b]">VANTÉRA</span>
        <span className="text-[#77746d]">/</span>
        <span>All About Tech Finds</span>
        <span className="text-[#77746d]">·</span>
        <span className="text-[#a9a69f] hidden sm:inline">Direct Bank Transfer Orders Active · Verified by CEO Adnuel</span>
        <span className="text-[#77746d] hidden sm:inline">·</span>
        <button
          type="button"
          onClick={() => setIsAndroidModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#252521] hover:bg-[#c4a66b] hover:text-[#121210] text-[#e7e4de] text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer"
          title="Install Android App (APK / PWA)"
        >
          <span>📱</span>
          <span className="font-bold">Android App</span>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded-2xs font-semibold">APK / PWA</span>
        </button>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#f8f7f4]/95 backdrop-blur-md border-b border-[#e7e4de] transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Lockup */}
          <div className="flex items-center gap-2 sm:gap-6 lg:gap-10">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setIsMobileMenuOpen(false);
                onNavigate('/');
              }}
              className="group flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#121210] text-[#f8f7f4] flex items-center justify-center font-serif text-sm sm:text-base font-bold rounded-xs transition-transform group-hover:scale-105 shadow-xs">
                V
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-xl font-extrabold tracking-[0.2em] sm:tracking-[0.25em] uppercase font-sans text-[#121210]">
                  VANTÉRA
                </span>
                <span className="text-[9px] tracking-[0.2em] uppercase text-[#c4a66b] font-mono hidden sm:inline">
                  All About Tech Finds
                </span>
              </div>
            </a>

            {/* Desktop Navigation (Samsung-inspired Category Links) */}
            <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-xs font-semibold uppercase tracking-wider text-[#77746d]">
              <a
                href="/shop"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/shop');
                }}
                className={`transition-colors hover:text-[#121210] py-2 border-b-2 ${
                  activePath === '/shop' ? 'border-[#121210] text-[#121210]' : 'border-transparent'
                }`}
              >
                Shop
              </a>
              <a
                href="/category/phone-cases"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/category/phone-cases');
                }}
                className={`transition-colors hover:text-[#121210] py-2 border-b-2 ${
                  activePath.includes('phone-cases') ? 'border-[#121210] text-[#121210]' : 'border-transparent'
                }`}
              >
                Smartphones & Accessories
              </a>
              <a
                href="/category/room-desk"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/category/room-desk');
                }}
                className={`transition-colors hover:text-[#121210] py-2 border-b-2 ${
                  activePath.includes('room-desk') ? 'border-[#121210] text-[#121210]' : 'border-transparent'
                }`}
              >
                Smart Gadgets
              </a>
              <a
                href="/shop?filter=featured"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/shop?filter=featured');
                }}
                className="transition-colors hover:text-[#121210] py-2 border-b-2 border-transparent"
              >
                Featured Products
              </a>
              <a
                href="/shop?filter=new"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/shop?filter=new');
                }}
                className="transition-colors hover:text-[#121210] py-2 border-b-2 border-transparent"
              >
                New Arrivals
              </a>
              <a
                href="/shop?category=festive-season"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/shop?category=festive-season');
                }}
                className={`transition-colors hover:text-[#c4a66b] text-[#9d8048] font-bold py-2 border-b-2 inline-flex items-center gap-1.5 ${
                  activePath.includes('festive-season') ? 'border-[#c4a66b] text-[#c4a66b]' : 'border-transparent'
                }`}
              >
                <svg className="w-3.5 h-3.5 text-[#c4a66b]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>Festive Gifts</span>
              </a>
              <a
                href="/shop?filter=deals"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/shop?filter=deals');
                }}
                className="transition-colors hover:text-[#c4a66b] text-[#77746d] hover:text-[#121210] py-2 border-b-2 border-transparent"
              >
                Deals
              </a>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Desktop Currency Selector (USD / NGN) */}
            <div className="hidden sm:flex items-center border border-[#e7e4de] bg-[#fbfaf7] text-[11px] font-mono shadow-2xs">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1.5 transition-colors cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-[#121210] !text-white font-bold'
                    : 'text-[#77746d] hover:text-[#121210]'
                }`}
                title="US Dollar ($)"
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('NGN')}
                className={`px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-0.5 ${
                  currency === 'NGN'
                    ? 'bg-[#121210] !text-white font-bold'
                    : 'text-[#77746d] hover:text-[#121210]'
                }`}
                title="Nigerian Naira (NGN)"
              >
                <span>NGN (</span>
                <NairaGlyph className="w-2.5 h-2.5 inline-block -mt-0.5" />
                <span>)</span>
              </button>
            </div>

            {/* Android App Button */}
            <button
              type="button"
              onClick={() => setIsAndroidModalOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono uppercase tracking-wider border border-[#e7e4de] bg-[#fbfaf7] text-[#121210] hover:border-[#121210] hover:bg-[#121210] hover:text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="VANTÉRA Android App (APK / PWA)"
            >
              <span className="text-xs">📱</span>
              <span className="font-semibold">Android</span>
            </button>

            {/* Mobile Compact Currency Toggle (hidden when drawer is open to avoid duplicate controls) */}
            {!isMobileMenuOpen && (
              <button
                type="button"
                onClick={() => setCurrency(currency === 'USD' ? 'NGN' : 'USD')}
                className="sm:hidden px-2 py-1 text-[11px] font-mono font-bold border border-[#e7e4de] bg-[#fbfaf7] text-[#121210] rounded-xs cursor-pointer inline-flex items-center gap-1"
                title="Switch Currency"
              >
                {currency === 'USD' ? (
                  <span>$ USD</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5">
                    <NairaGlyph className="w-2.5 h-2.5 inline-block -mt-0.5" />
                    <span>NGN</span>
                  </span>
                )}
              </button>
            )}

            {/* Search Button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search the catalog"
              className="p-1.5 sm:p-2 text-[#77746d] hover:text-[#121210] hover:bg-[#eae7e0]/60 rounded-full transition-colors cursor-pointer shrink-0"
              title="Search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Customer Account Button */}
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate('/account')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#e7e4de] bg-white hover:border-[#121210] transition-colors shrink-0"
                title="Customer Account"
              >
                <span className="w-2 h-2 rounded-full bg-[#1e7e34]"></span>
                <span>{user.name.split(' ')[0]}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/account')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#121210] font-semibold border border-transparent hover:border-[#e7e4de] hover:bg-white transition-colors shrink-0"
                title="Sign In"
              >
                <svg className="w-3.5 h-3.5 text-[#77746d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Sign In</span>
              </button>
            )}

            {/* Cart Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Open shopping cart with ${itemCount} items`}
              className="flex items-center gap-1.5 bg-[#121210] !text-white px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold tracking-wider transition-colors hover:bg-[#c4a66b] hover:!text-[#121210] cursor-pointer shadow-xs shrink-0"
            >
              <svg className="w-4 h-4 !text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="!text-white hidden md:inline">Cart</span>
              <span className="font-mono bg-white/20 !text-white px-1.5 py-0.2 rounded-xs text-[11px] font-bold">
                {itemCount}
              </span>
            </button>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile navigation menu"
              className="lg:hidden p-1.5 sm:p-2 text-[#121210] hover:bg-[#eae7e0]/60 rounded-xs transition-colors shrink-0"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Over Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-[#e7e4de] px-6 py-6 shadow-xl space-y-6 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#77746d]">Navigation</span>
              <nav className="flex flex-col divide-y divide-[#e7e4de] text-sm font-semibold text-[#121210]">
                <a
                  href="/shop"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/shop'); }}
                  className="py-3 flex items-center justify-between hover:text-[#c4a66b]"
                >
                  <span>Shop All Products</span>
                  <span>→</span>
                </a>
                <a
                  href="/category/phone-cases"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/category/phone-cases'); }}
                  className="py-3 flex items-center justify-between hover:text-[#c4a66b]"
                >
                  <span>Smartphones & Accessories</span>
                  <span>→</span>
                </a>
                <a
                  href="/category/room-desk"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/category/room-desk'); }}
                  className="py-3 flex items-center justify-between hover:text-[#c4a66b]"
                >
                  <span>Smart Gadgets</span>
                  <span>→</span>
                </a>
                <a
                  href="/shop?filter=featured"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/shop?filter=featured'); }}
                  className="py-3 flex items-center justify-between hover:text-[#c4a66b]"
                >
                  <span>Featured Products</span>
                  <span>→</span>
                </a>
                <a
                  href="/shop?filter=new"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/shop?filter=new'); }}
                  className="py-3 flex items-center justify-between hover:text-[#c4a66b]"
                >
                  <span>New Arrivals</span>
                  <span>→</span>
                </a>
                <a
                  href="/shop?category=festive-season"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/shop?category=festive-season'); }}
                  className="py-3 flex items-center justify-between text-[#9d8048] hover:text-[#c4a66b] font-bold"
                >
                  <span className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-[#c4a66b]" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>Festive Bestsellers</span>
                  </span>
                  <span>→</span>
                </a>
                <a
                  href="/shop?filter=deals"
                  onClick={(e) => { e.preventDefault(); setIsMobileMenuOpen(false); onNavigate('/shop?filter=deals'); }}
                  className="py-3 flex items-center justify-between hover:text-[#c4a66b]"
                >
                  <span>Deals & Bundles</span>
                  <span>%</span>
                </a>
              </nav>
            </div>

            <div className="pt-4 border-t border-[#e7e4de] space-y-4">
              {/* Android App Button in Drawer */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsAndroidModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-3.5 bg-[#121210] text-[#f8f7f4] rounded-xs hover:bg-[#c4a66b] hover:text-[#121210] transition-colors text-left cursor-pointer shadow-xs group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xs bg-[#252521] flex items-center justify-center text-lg shrink-0">
                    📱
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#f8f7f4] flex items-center gap-2">
                      <span>VANTÉRA Android App</span>
                      <span className="text-[9px] bg-[#c4a66b] text-[#121210] font-sans font-bold px-1.5 py-0.5 rounded-2xs">
                        NEW
                      </span>
                    </div>
                    <div className="text-[11px] text-[#a9a69f] font-sans">
                      WebAPK standalone & APK install
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-sans font-semibold text-[#c4a66b] group-hover:text-[#121210] shrink-0 pl-2">
                  <span>Get</span>
                  <span>→</span>
                </div>
              </button>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#77746d] font-sans font-medium">Payment Currency:</span>
                <div className="flex border border-[#e7e4de] text-xs font-sans shadow-2xs">
                  <button
                    onClick={() => setCurrency('USD')}
                    className={`px-3 py-1 font-semibold transition-colors cursor-pointer ${
                      currency === 'USD' ? 'bg-[#121210] text-white' : 'text-[#77746d] hover:text-[#121210] bg-[#fbfaf7]'
                    }`}
                  >
                    USD ($)
                  </button>
                  <button
                    onClick={() => setCurrency('NGN')}
                    className={`px-3 py-1 font-semibold transition-colors cursor-pointer inline-flex items-center gap-0.5 ${
                      currency === 'NGN' ? 'bg-[#121210] text-white' : 'text-[#77746d] hover:text-[#121210] bg-[#fbfaf7]'
                    }`}
                  >
                    <span>NGN (</span>
                    <NairaGlyph className="w-2.5 h-2.5 inline-block -mt-0.5" />
                    <span>)</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setIsMobileMenuOpen(false); onNavigate('/account'); }}
                  className="flex-1 bg-[#121210] text-[#f8f7f4] py-2.5 text-xs uppercase tracking-wider font-semibold text-center hover:bg-[#c4a66b] hover:text-[#121210]"
                >
                  {user ? 'My Account' : 'Customer Sign In'}
                </button>
                <button
                  onClick={() => { setIsMobileMenuOpen(false); onNavigate('/track'); }}
                  className="px-4 py-2.5 border border-[#e7e4de] text-xs uppercase tracking-wider text-[#121210]"
                >
                  Track Order
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl mx-4 p-8 shadow-2xl border border-[#e7e4de] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#c4a66b] font-mono block">VANTÉRA SEARCH</span>
                <h3 className="text-lg font-bold text-[#121210]">Explore the Technology Collection</h3>
              </div>
              <button
                onClick={() => setIsSearchOpen(false)}
                className="text-[#77746d] hover:text-[#121210] p-1 text-base font-mono"
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
                  placeholder="Search laptops, earbuds, fast chargers, MagSafe mounts..."
                  className="w-full border-b-2 border-[#121210] py-3 text-lg text-[#121210] placeholder-[#a9a69f] focus:outline-hidden pr-24 font-sans"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-2.5 bg-[#121210] text-[#f8f7f4] text-xs px-5 py-2 uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Quick Suggestions */}
            <div className="mt-6 pt-4 border-t border-[#e7e4de]">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#77746d] block mb-2">Popular Searches</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'Foldable Laptop Stand',
                  'Wireless Earbuds',
                  '20W Fast Charger',
                  'Magnetic Tripod',
                  'Phone Cases',
                  'Bluetooth Speaker',
                ].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      setIsSearchOpen(false);
                      onNavigate(`/shop?q=${encodeURIComponent(term)}`);
                    }}
                    className="text-xs bg-[#f4f2ee] hover:bg-[#121210] hover:text-white px-3 py-1.5 rounded-xs transition-colors text-[#252521]"
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
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-[#e7e4de] bg-[#f4f2ee] mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 bg-[#121210] text-[#f8f7f4] flex items-center justify-center font-serif text-xs font-bold rounded-xs">
                  V
                </div>
                <span className="text-base font-bold tracking-[0.2em] uppercase text-[#121210]">
                  VANTÉRA
                </span>
              </div>
              <p className="font-serif italic text-sm text-[#252521]">All About Tech Finds.</p>
              <p className="text-xs text-[#77746d] max-w-sm leading-relaxed">
                A curated luxury storefront for cutting-edge tech finds, wireless charging, and everyday device essentials. Direct bank transfer verified and authorized under CEO Adnuel.
              </p>

              {/* Private Newsletter Subscription */}
              <div className="pt-2 max-w-sm">
                <span className="text-[10px] uppercase tracking-wider text-[#121210] font-semibold block mb-1.5 font-mono">
                  Private Curation Newsletter
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
                    placeholder="Enter your email"
                    className="flex-1 bg-white border border-[#e7e4de] px-3 py-1.5 text-xs text-[#121210] focus:border-[#121210] focus:outline-hidden"
                    required
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus === 'submitting'}
                    className="bg-[#121210] text-[#f8f7f4] px-3.5 py-1.5 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors whitespace-nowrap"
                  >
                    {newsletterStatus === 'submitting' ? '...' : 'Subscribe'}
                  </button>
                </form>
                {newsletterStatus === 'success' && (
                  <p className="text-[10px] text-[#1e7e34] mt-1">✓ Thank you for subscribing to VANTÉRA.</p>
                )}
                {newsletterStatus === 'error' && (
                  <p className="text-[10px] text-[#9b1c1c] mt-1">Please enter a valid email address.</p>
                )}
              </div>
            </div>

            {/* Explore column */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">Explore Tech Finds</h3>
              <ul className="space-y-2 text-xs text-[#77746d]">
                <li>
                  <a href="/shop" onClick={(e) => { e.preventDefault(); onNavigate('/shop'); }} className="hover:text-[#121210]">
                    Shop All Finds
                  </a>
                </li>
                <li>
                  <a href="/category/phone-cases" onClick={(e) => { e.preventDefault(); onNavigate('/category/phone-cases'); }} className="hover:text-[#121210]">
                    Phone Protection & MagSafe
                  </a>
                </li>
                <li>
                  <a href="/category/charging" onClick={(e) => { e.preventDefault(); onNavigate('/category/charging'); }} className="hover:text-[#121210]">
                    Charging & Power Hubs
                  </a>
                </li>
                <li>
                  <a href="/category/room-desk" onClick={(e) => { e.preventDefault(); onNavigate('/category/room-desk'); }} className="hover:text-[#121210]">
                    Desk & Workspace Gear
                  </a>
                </li>
                <li>
                  <a href="/category/trending" onClick={(e) => { e.preventDefault(); onNavigate('/category/trending'); }} className="hover:text-[#121210]">
                    Trending Viral Finds
                  </a>
                </li>
              </ul>
            </div>

            {/* Information column */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">Information</h3>
              <ul className="space-y-2 text-xs text-[#77746d]">
                <li>
                  <a href="/about" onClick={(e) => { e.preventDefault(); onNavigate('/about'); }} className="hover:text-[#121210]">
                    About VANTÉRA
                  </a>
                </li>
                <li>
                  <a href="/contact" onClick={(e) => { e.preventDefault(); onNavigate('/contact'); }} className="hover:text-[#121210]">
                    Contact & WhatsApp
                  </a>
                </li>
                <li>
                  <a href="/faq" onClick={(e) => { e.preventDefault(); onNavigate('/faq'); }} className="hover:text-[#121210]">
                    Frequently asked questions
                  </a>
                </li>
                <li>
                  <a href="/shipping" onClick={(e) => { e.preventDefault(); onNavigate('/shipping'); }} className="hover:text-[#121210]">
                    Shipping & delivery
                  </a>
                </li>
                <li>
                  <a href="/returns" onClick={(e) => { e.preventDefault(); onNavigate('/returns'); }} className="hover:text-[#121210]">
                    Returns & refunds
                  </a>
                </li>
              </ul>
            </div>

            {/* Customer Care column */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#121210]">Customer Care</h3>
              <div className="space-y-2 text-xs text-[#77746d]">
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-[#a9a69f]">Direct Email</span>
                  <a href="mailto:emmanueladarikwu@gmail.com" className="text-[#121210] hover:underline font-mono">
                    emmanueladarikwu@gmail.com
                  </a>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-[#a9a69f]">WhatsApp VIP Concierge</span>
                  <a href="https://wa.me/2349132793670" target="_blank" rel="noopener noreferrer" className="text-[#1e7e34] hover:underline font-mono">
                    +234 913 279 3670
                  </a>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-[#a9a69f]">Bank Wire Orders</span>
                  <span className="text-[#121210] font-mono text-[11px]">GTBank: 1033269410</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-[#a9a69f]">Order Verification</span>
                  <span className="text-[#1e7e34] font-medium text-[11px]">Instant CEO Verification</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-[#e7e4de] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#77746d]">
            <div>
              © 2026 VANTÉRA. All rights reserved. All About Tech Finds.
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <a href="/privacy" onClick={(e) => { e.preventDefault(); onNavigate('/privacy'); }} className="hover:underline">Privacy Policy</a>
              <span>·</span>
              <a href="/terms" onClick={(e) => { e.preventDefault(); onNavigate('/terms'); }} className="hover:underline">Terms of Service</a>
              <span>·</span>
              <a href="/track" onClick={(e) => { e.preventDefault(); onNavigate('/track'); }} className="hover:underline">Track Order</a>
              <span>·</span>
              <button
                type="button"
                onClick={() => setIsAndroidModalOpen(true)}
                className="text-[#121210] hover:text-[#c4a66b] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                title="Install Android WebAPK or download native Android Studio project"
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
