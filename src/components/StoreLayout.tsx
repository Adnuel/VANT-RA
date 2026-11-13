import React, { useState } from 'react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useWishlist } from '../contexts/WishlistContext.tsx';
import { CartDrawer } from './CartDrawer.tsx';
import { AndroidInstallModal } from './AndroidInstallModal.tsx';

interface StoreLayoutProps {
  children: React.ReactNode;
  activePath: string;
  products?: Product[];
  onNavigate: (url: string) => void;
}

export const StoreLayout: React.FC<StoreLayoutProps> = ({
  children,
  activePath,
  products = [],
  onNavigate,
}) => {
  const { itemCount, setIsCartOpen, addToCart } = useCart();
  const { user } = useAuth();
  const { currency, setCurrency, formatAmount } = useCurrency();
  const { wishlistIds, isWishlistOpen, setIsWishlistOpen, removeFromWishlist } = useWishlist();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [cookieConsent, setCookieConsent] = useState<'all' | 'essential' | null>(() => {
    try {
      const saved = localStorage.getItem('vantera_cookie_consent');
      if (saved === 'all' || saved === 'essential') return saved;
    } catch {}
    return null;
  });

  const handleSaveCookieConsent = (choice: 'all' | 'essential') => {
    setCookieConsent(choice);
    try {
      localStorage.setItem('vantera_cookie_consent', choice);
    } catch {}
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    onNavigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const navItems = [
    { label: 'Shop', href: '/shop' },
    { label: 'Charging', href: '/category/charging' },
    { label: 'Cases', href: '/category/phone-cases' },
    { label: 'Desk', href: '/category/room-desk' },
    { label: 'Track', href: '/track' },
  ];

  const wishlistedProducts = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <div className="min-h-screen bg-[#0B0B0C] text-[#F5F1E8] flex flex-col font-meta selection:bg-[#C8A96A]/30 selection:text-[#F5F1E8]">
      {/* Slim Sticky Luxury Header */}
      <header className="sticky top-0 z-40 bg-[#0B0B0C]/95 backdrop-blur-md border-b border-white/8">
        <div className="max-w-7xl mx-auto px-3 sm:px-8 lg:px-12 h-16 sm:h-[70px] flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Minimal Navigation (Desktop) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-[11px] uppercase tracking-[0.2em] font-medium text-[#A8A297] lg:flex-1"
          >
            {navItems.map((item) => {
              const isActive = activePath === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.href);
                  }}
                  className={`whitespace-nowrap shrink-0 transition-colors py-1 border-b ${
                    isActive
                      ? 'text-[#F5F1E8] border-[#C8A96A]'
                      : 'border-transparent hover:text-[#F5F1E8]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Mobile Left Hamburger */}
          <div className="flex lg:hidden items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="p-2 -ml-1 text-[#F5F1E8] hover:text-[#C8A96A] transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                </svg>
              )}
            </button>
          </div>

          {/* Center: Editorial Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setIsMobileMenuOpen(false);
              onNavigate('/');
            }}
            className="font-editorial text-lg sm:text-2xl font-medium tracking-[0.2em] sm:tracking-[0.28em] uppercase text-[#F5F1E8] hover:text-[#C8A96A] transition-colors whitespace-nowrap shrink-0 cursor-pointer text-center"
          >
            VANTÉRA
          </a>

          {/* Right: Subtle Currency Switcher & Thin-Stroke Icon Controls */}
          <div className="flex items-center justify-end gap-1 sm:gap-4 lg:flex-1 shrink-0">
            {/* Discreet ₦ / $ Switcher */}
            <div
              role="group"
              aria-label="Select currency"
              className="flex items-center text-[11px] uppercase tracking-[0.12em] border border-white/10 rounded-xs overflow-hidden bg-[#141416]"
            >
              <button
                type="button"
                onClick={() => setCurrency('NGN')}
                aria-pressed={currency === 'NGN'}
                className={`px-2 py-1 transition-colors cursor-pointer ${
                  currency === 'NGN'
                    ? 'bg-[#C8A96A] text-[#0B0B0C] font-semibold'
                    : 'text-[#A8A297] hover:text-[#F5F1E8]'
                }`}
              >
                ₦
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                aria-pressed={currency === 'USD'}
                className={`px-2 py-1 transition-colors cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-[#C8A96A] text-[#0B0B0C] font-semibold'
                    : 'text-[#A8A297] hover:text-[#F5F1E8]'
                }`}
              >
                $
              </button>
            </div>

            {/* Search Icon */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search products"
              className="p-2 text-[#A8A297] hover:text-[#F5F1E8] transition-colors cursor-pointer"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>

            {/* Account Icon */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate(user ? '/account' : '/account?mode=login');
              }}
              aria-label={user ? `Account: ${user.name}` : 'Sign in or open account'}
              className="hidden sm:inline-flex items-center justify-center p-2 text-[#A8A297] hover:text-[#F5F1E8] transition-colors cursor-pointer relative"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {user && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96A] absolute top-1.5 right-1.5" />
              )}
            </button>

            {/* Wishlist Icon */}
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              aria-label={`Open saved items (${wishlistIds.length})`}
              className="p-2 text-[#A8A297] hover:text-[#F5F1E8] transition-colors cursor-pointer relative"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {wishlistIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#C8A96A] text-[#0B0B0C] text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {wishlistIds.length}
                </span>
              )}
            </button>

            {/* Bag Icon */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Open shopping bag (${itemCount} items)`}
              className="p-1.5 sm:p-2 text-[#F5F1E8] hover:text-[#C8A96A] transition-colors cursor-pointer relative flex items-center gap-1"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
              <span className="text-[11px] font-medium tabular-nums tracking-wider">{itemCount}</span>
            </button>
          </div>
        </div>

        {/* Uncluttered Mobile Navigation Drawer with Large Tap Targets */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#141416] border-t border-white/8 px-6 py-6 space-y-6">
            <nav aria-label="Mobile Navigation" className="flex flex-col divide-y divide-white/6">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#F5F1E8] hover:text-[#C8A96A]"
              >
                Home
              </a>
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsMobileMenuOpen(false);
                    onNavigate(item.href);
                  }}
                  className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#F5F1E8] hover:text-[#C8A96A]"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/about');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#A8A297] hover:text-[#F5F1E8]"
              >
                About & Trust
              </a>
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/contact');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#A8A297] hover:text-[#F5F1E8]"
              >
                Concierge
              </a>
            </nav>

            <div className="pt-2 space-y-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onNavigate('/account');
                  }}
                  className="w-full min-h-[48px] px-4 text-xs uppercase tracking-[0.2em] font-semibold gold-gradient-bg rounded-xs cursor-pointer"
                >
                  Account · {user.name.split(' ')[0]}
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNavigate('/account?mode=login');
                    }}
                    className="min-h-[48px] px-4 text-xs uppercase tracking-[0.18em] border border-white/15 text-[#F5F1E8] rounded-xs cursor-pointer"
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onNavigate('/account?mode=register');
                    }}
                    className="min-h-[48px] px-4 text-xs uppercase tracking-[0.18em] font-semibold gold-gradient-bg rounded-xs cursor-pointer"
                  >
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search Catalog"
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 bg-black/85 backdrop-blur-md px-4"
        >
          <div className="bg-[#141416] w-full max-w-xl p-6 sm:p-8 rounded-xs border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-editorial text-2xl font-medium text-[#F5F1E8]">
                Search VANTÉRA
              </h2>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="text-[#A8A297] hover:text-[#F5F1E8] p-2 cursor-pointer"
                aria-label="Close search"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex gap-3">
              <label htmlFor="header-search-input" className="sr-only">
                Search catalog
              </label>
              <input
                id="header-search-input"
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chargers, cases, desk stands, earbuds..."
                className="flex-1 bg-[#0B0B0C] border border-white/12 rounded-xs py-3 px-4 text-sm text-[#F5F1E8] placeholder-[#A8A297]/60 focus:outline-hidden focus:border-[#C8A96A]"
              />
              <button
                type="submit"
                className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer whitespace-nowrap"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-1">
              {['MagSafe', 'Case', 'Desk Stand', 'Earbuds', 'Charging'].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    setIsSearchOpen(false);
                    onNavigate(`/shop?q=${encodeURIComponent(term)}`);
                  }}
                  className="text-[11px] uppercase tracking-[0.15em] bg-[#0B0B0C] border border-white/10 hover:border-[#C8A96A] hover:text-[#C8A96A] text-[#A8A297] px-3 py-1.5 rounded-xs transition-colors cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Saved Wishlist Slide-Over Drawer */}
      {isWishlistOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved Wishlist"
          className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-md"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-[#0B0B0C] text-[#F5F1E8] border-l border-white/8">
            <div className="flex items-center justify-between border-b border-white/8 px-6 py-5 bg-[#141416]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#C8A96A]">VANTÉRA</p>
                <h2 className="font-editorial text-xl font-medium text-[#F5F1E8]">
                  Saved Selection ({wishlistedProducts.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsWishlistOpen(false)}
                aria-label="Close wishlist"
                className="p-2 text-[#A8A297] hover:text-[#F5F1E8] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {wishlistedProducts.length === 0 ? (
                <div className="py-24 text-center space-y-4">
                  <span className="font-editorial text-3xl text-[#C8A96A] block">V</span>
                  <p className="font-editorial text-lg text-[#F5F1E8]">Your wishlist is empty.</p>
                  <p className="text-xs text-[#A8A297] max-w-xs mx-auto leading-relaxed">
                    Save hardware pieces as you browse to revisit or move them into your shopping bag anytime.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWishlistOpen(false);
                      onNavigate('/shop');
                    }}
                    className="mt-2 gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
                  >
                    Explore Collection
                  </button>
                </div>
              ) : (
                wishlistedProducts.map((product) => {
                  const out =
                    !product.isAvailable || product.stockQuantity === 0 || product.availability === 'out_of_stock';
                  return (
                    <div
                      key={product.id}
                      className="flex gap-4 bg-[#141416] border border-white/8 p-4 rounded-xs items-center"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsWishlistOpen(false);
                          onNavigate(`/product/${product.slug}`);
                        }}
                        className="w-16 h-16 bg-[#0B0B0C] border border-white/8 p-2 shrink-0 flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={product.image || '/products/charging-phone-stand.jpg'}
                          alt={product.title}
                          className="w-full h-full object-contain"
                        />
                      </button>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsWishlistOpen(false);
                            onNavigate(`/product/${product.slug}`);
                          }}
                          className="text-left text-sm font-medium text-[#F5F1E8] hover:text-[#C8A96A] truncate block w-full cursor-pointer"
                        >
                          {product.title}
                        </button>
                        <div className="text-xs text-[#C8A96A] font-medium tabular-nums">
                          {formatAmount(product.retailPriceCents)}
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          {!out ? (
                            <button
                              type="button"
                              onClick={() => {
                                addToCart(product, 1);
                                removeFromWishlist(product.id);
                                setIsWishlistOpen(false);
                                setIsCartOpen(true);
                              }}
                              className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#C8A96A] hover:underline cursor-pointer"
                            >
                              Move to Bag
                            </button>
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.18em] text-[#A8A297]">
                              Out of stock
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFromWishlist(product.id)}
                            className="text-[10px] uppercase tracking-[0.18em] text-[#A8A297] hover:text-[#F5F1E8] cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full">{children}</main>

      {/* Editorial Footer */}
      <footer className="bg-[#0B0B0C] border-t border-white/8 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 lg:py-20 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
            {/* Brand + Newsletter */}
            <div className="md:col-span-5 space-y-5">
              <div className="space-y-3">
                <span className="font-editorial text-2xl font-medium tracking-[0.28em] uppercase text-[#F5F1E8] block">
                  VANTÉRA
                </span>
                <p className="text-sm text-[#A8A297] max-w-sm leading-relaxed">
                  Refined smartphone protection, wireless charging architecture, and everyday desk hardware dispatched from Lagos worldwide.
                </p>
              </div>

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
                className="flex gap-2.5 max-w-sm"
              >
                <label htmlFor="footer-newsletter" className="sr-only">
                  Email for restock alerts
                </label>
                <input
                  id="footer-newsletter"
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Email for restock notifications"
                  className="flex-1 bg-[#141416] border border-white/10 px-4 py-2.5 text-sm text-[#F5F1E8] placeholder-[#A8A297]/60 focus:outline-hidden focus:border-[#C8A96A] rounded-xs"
                  required
                />
                <button
                  type="submit"
                  disabled={newsletterStatus === 'submitting'}
                  className="gold-gradient-bg px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer shrink-0"
                >
                  {newsletterStatus === 'submitting' ? '...' : 'Join'}
                </button>
              </form>
              {newsletterStatus === 'success' && (
                <p className="text-xs text-[#2E9B6B]">You are subscribed to VANTÉRA restock alerts.</p>
              )}
              {newsletterStatus === 'error' && (
                <p className="text-xs text-[#E57373]">Unable to register that email right now.</p>
              )}
            </div>

            {/* Collections */}
            <div className="md:col-span-3 space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8A96A]">
                Collection
              </h3>
              <ul className="space-y-3 text-sm text-[#A8A297]">
                <li>
                  <button type="button" onClick={() => onNavigate('/shop')} className="hover:text-[#F5F1E8] cursor-pointer">
                    All Hardware
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/charging')} className="hover:text-[#F5F1E8] cursor-pointer">
                    MagSafe & Charging
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/phone-cases')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Phone Cases
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/room-desk')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Desk & Audio
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/track')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Order Tracking
                  </button>
                </li>
              </ul>
            </div>

            {/* Client Care & Policies */}
            <div className="md:col-span-4 space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#C8A96A]">
                Client Care & Policies
              </h3>
              <ul className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm text-[#A8A297]">
                <li>
                  <button type="button" onClick={() => onNavigate('/about')} className="hover:text-[#F5F1E8] cursor-pointer">
                    About VANTÉRA
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/shipping')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Shipping Rates
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/returns')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Returns Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/faq')} className="hover:text-[#F5F1E8] cursor-pointer">
                    FAQ
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/privacy')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/terms')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Terms of Sale
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/contact')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Contact Us
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/account')} className="hover:text-[#F5F1E8] cursor-pointer">
                    Client Account
                  </button>
                </li>
              </ul>

              <div className="pt-3 border-t border-white/8 text-xs text-[#A8A297] space-y-1.5">
                <div>
                  WhatsApp Concierge:{' '}
                  <a
                    href="https://wa.me/2349132793670"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#C8A96A] hover:underline"
                  >
                    +234 913 279 3670
                  </a>
                </div>
                <div>
                  Email:{' '}
                  <a href="mailto:emmanueladarikwu@gmail.com" className="hover:text-[#F5F1E8]">
                    emmanueladarikwu@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-4 pt-1 text-[11px] uppercase tracking-[0.15em]">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#A8A297] hover:text-[#C8A96A]"
                  >
                    Instagram ↗
                  </a>
                  <a
                    href="https://wa.me/2349132793670"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#A8A297] hover:text-[#C8A96A]"
                  >
                    WhatsApp ↗
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A8A297]">
            <div>© {new Date().getFullYear()} VANTÉRA. All rights reserved.</div>
            <div className="flex flex-wrap items-center gap-6">
              {cookieConsent === null && (
                <button
                  type="button"
                  onClick={() => handleSaveCookieConsent('essential')}
                  className="text-[#C8A96A] hover:underline cursor-pointer"
                >
                  Essential Cookies Active · Dismiss
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAndroidModalOpen(true)}
                className="hover:text-[#F5F1E8] cursor-pointer"
              >
                Android App
              </button>
              <span>vantera.com.ng</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Shopping Bag Drawer */}
      <CartDrawer onNavigate={onNavigate} />

      {/* Android App Installation Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />
    </div>
  );
};
