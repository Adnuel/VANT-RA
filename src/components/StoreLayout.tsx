import React, { useState } from 'react';
import { Menu, X, Search, User, Heart, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';
import { useWishlist } from '../contexts/WishlistContext.tsx';
import { getMobileActiveTab, shouldShowMobileBottomNav } from '../lib/storefrontHelpers.ts';
import { CartDrawer } from './CartDrawer.tsx';
import { AndroidInstallModal } from './AndroidInstallModal.tsx';
import { MobileBottomNav } from './MobileBottomNav.tsx';
import { FullScreenSearch } from './FullScreenSearch.tsx';

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
  const { itemCount, isCartOpen, setIsCartOpen, checkoutStep, cartBounceKey, addToCart } = useCart();
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

  const navItems = [
    { label: 'Shop', href: '/shop' },
    { label: 'Tech', href: '/category/premium-tech-accessories' },
    { label: 'Smart Home', href: '/category/smart-home-technology' },
    { label: 'Workspace', href: '/category/laptop-workspace' },
    { label: 'Lifestyle', href: '/category/trending-lifestyle-gadgets' },
    { label: 'Everyday', href: '/category/premium-everyday-accessories' },
  ];

  const wishlistedProducts = products.filter((p) => wishlistIds.includes(p.id));
  const showBottomNav = shouldShowMobileBottomNav(activePath, isCartOpen, checkoutStep);
  const activeMobileTab = getMobileActiveTab(activePath, isSearchOpen, isCartOpen);

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-[#111111] flex flex-col font-meta selection:bg-[#B89B5E]/25 selection:text-[#111111]">
      {/* Slim Sticky Luxury Header (Compact 56px mobile, 68px desktop) */}
      <header className="sticky top-0 z-40 bg-[#F7F3EC]/92 backdrop-blur-md border-b border-[#111111]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 h-14 lg:h-[68px] flex items-center justify-between gap-3">
          {/* Left: Minimal Navigation (Desktop) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-5 text-[11px] uppercase tracking-[0.16em] font-medium text-[#5C574E] lg:flex-1"
          >
            {navItems.map((item) => {
              const isActive = activePath === item.href || window.location.pathname === item.href;
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
                      ? 'text-[#111111] border-[#B89B5E]'
                      : 'border-transparent hover:text-[#111111]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Mobile Left Menu Toggle (Secondary Links: Track, Policies, Philosophy) */}
          <div className="flex lg:hidden items-center shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="min-w-[44px] min-h-[44px] -ml-2 inline-flex items-center justify-center text-[#111111] hover:text-[#7A6230] transition-colors cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" strokeWidth={1.5} />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.5} />
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
            className="font-editorial text-lg sm:text-2xl font-medium tracking-[0.24em] uppercase text-[#111111] hover:text-[#7A6230] transition-colors whitespace-nowrap shrink-0 cursor-pointer text-center"
          >
            VANTÉRA
          </a>

          {/* Right: Discreet Currency Switcher & Consistent Thin-Stroke Controls */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-3 lg:flex-1 shrink-0">
            <div
              role="group"
              aria-label="Select currency"
              className="flex items-center text-[11px] uppercase tracking-[0.12em] border border-[#111111]/15 rounded-xs overflow-hidden bg-[#FAF7F2]"
            >
              <button
                type="button"
                onClick={() => setCurrency('NGN')}
                aria-pressed={currency === 'NGN'}
                className={`px-2.5 py-1.5 min-h-[34px] transition-colors cursor-pointer ${
                  currency === 'NGN'
                    ? 'bg-[#B89B5E] text-[#111111] font-semibold'
                    : 'text-[#5C574E] hover:text-[#111111]'
                }`}
              >
                ₦
              </button>
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                aria-pressed={currency === 'USD'}
                className={`px-2.5 py-1.5 min-h-[34px] transition-colors cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-[#B89B5E] text-[#111111] font-semibold'
                    : 'text-[#5C574E] hover:text-[#111111]'
                }`}
              >
                $
              </button>
            </div>

            {/* Search Icon (Desktop — mobile uses bottom bar Search tab) */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search products"
              className="hidden lg:inline-flex items-center justify-center p-2 text-[#5C574E] hover:text-[#111111] transition-colors cursor-pointer"
            >
              <Search className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>

            {/* Account Icon (Desktop) */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate(user ? '/account' : '/account?mode=login');
              }}
              aria-label={user ? `Account: ${user.name}` : 'Sign in or open account'}
              className="hidden lg:inline-flex items-center justify-center p-2 text-[#5C574E] hover:text-[#111111] transition-colors cursor-pointer relative"
            >
              <User className="w-[18px] h-[18px]" strokeWidth={1.5} />
              {user && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#B89B5E] absolute top-1.5 right-1.5" />
              )}
            </button>

            {/* Wishlist Icon */}
            <button
              type="button"
              onClick={() => setIsWishlistOpen(true)}
              aria-label={`Open saved items (${wishlistIds.length})`}
              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-[#5C574E] hover:text-[#111111] transition-colors cursor-pointer relative"
            >
              <Heart className="w-[18px] h-[18px]" strokeWidth={1.5} />
              {wishlistIds.length > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#B89B5E] text-[#111111] text-[9px] font-semibold flex items-center justify-center tabular-nums">
                  {wishlistIds.length}
                </span>
              )}
            </button>

            {/* Bag Icon (Desktop — mobile uses bottom bar Cart tab) */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Open shopping bag (${itemCount} items)`}
              className="hidden lg:inline-flex p-2 text-[#111111] hover:text-[#7A6230] transition-colors cursor-pointer relative items-center gap-1.5"
            >
              <ShoppingBag className="w-[18px] h-[18px]" strokeWidth={1.5} />
              <span
                key={cartBounceKey}
                className="cart-badge-bounce text-[11px] font-semibold tabular-nums tracking-wider"
              >
                {itemCount}
              </span>
            </button>
          </div>
        </div>

        {/* Clean Mobile Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-[#F7F3EC] border-t border-[#111111]/10 px-6 py-6 space-y-6">
            <nav aria-label="Mobile Navigation" className="flex flex-col divide-y divide-[#111111]/8">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#111111] hover:text-[#7A6230]"
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
                  className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#111111] hover:text-[#7A6230]"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="/track"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/track');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#111111] hover:text-[#7A6230]"
              >
                Order Tracking
              </a>
              <a
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/about');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#5C574E] hover:text-[#111111]"
              >
                Philosophy & Craft
              </a>
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  setIsMobileMenuOpen(false);
                  onNavigate('/contact');
                }}
                className="min-h-[48px] flex items-center text-xs uppercase tracking-[0.2em] text-[#5C574E] hover:text-[#111111]"
              >
                Concierge
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* Smooth Full-Screen Search Overlay with Live Suggestions */}
      <FullScreenSearch
        isOpen={isSearchOpen}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onClose={() => setIsSearchOpen(false)}
        products={products}
        onNavigate={onNavigate}
      />

      {/* Saved Wishlist Slide-Over Drawer */}
      {isWishlistOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Saved Wishlist"
          className="vantera-overlay-fade fixed inset-0 z-50 flex justify-end bg-[#111111]/60 backdrop-blur-md"
        >
          <div className="vantera-slide-in-right flex h-full w-full max-w-md flex-col bg-[#F7F3EC] text-[#111111] border-l border-[#111111]/12">
            <div className="flex items-center justify-between border-b border-[#111111]/10 px-6 py-5 bg-[#FAF7F2]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-medium">VANTÉRA</p>
                <h2 className="font-editorial text-xl font-medium text-[#111111]">
                  Saved Selection ({wishlistedProducts.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsWishlistOpen(false)}
                aria-label="Close wishlist"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-[#5C574E] hover:text-[#111111] cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {wishlistedProducts.length === 0 ? (
                <div className="py-24 text-center space-y-4">
                  <span className="font-editorial text-3xl text-[#B89B5E] block">V</span>
                  <p className="font-editorial text-xl text-[#111111]">Your wishlist is empty.</p>
                  <p className="text-xs text-[#5C574E] max-w-xs mx-auto leading-relaxed">
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
                      className="flex gap-4 bg-[#FAF7F2] border border-[#111111]/10 p-4 rounded-xs items-center"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsWishlistOpen(false);
                          onNavigate(`/product/${product.slug}`);
                        }}
                        className="w-16 h-16 bg-[#EFEAE0] shrink-0 flex items-center justify-center cursor-pointer overflow-hidden"
                      >
                        <img
                          src={product.image || '/products/charging-phone-stand.jpg'}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsWishlistOpen(false);
                            onNavigate(`/product/${product.slug}`);
                          }}
                          className="text-left font-editorial text-sm font-medium text-[#111111] hover:text-[#7A6230] truncate block w-full cursor-pointer"
                        >
                          {product.title}
                        </button>
                        <div className="text-xs text-[#111111] font-medium tabular-nums">
                          {formatAmount(product.retailPriceCents)}
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                          {!out ? (
                            <button
                              type="button"
                              onClick={() => {
                                addToCart(product, 1);
                                removeFromWishlist(product.id);
                                setIsWishlistOpen(false);
                                setIsCartOpen(true);
                              }}
                              className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#7A6230] hover:underline cursor-pointer"
                            >
                              Move to Bag
                            </button>
                          ) : (
                            <span className="text-[10px] uppercase tracking-[0.18em] text-[#8E3A3A]">
                              Out of stock
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFromWishlist(product.id)}
                            className="text-[10px] uppercase tracking-[0.18em] text-[#5C574E] hover:text-[#111111] cursor-pointer"
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

      {/* Main Content with Smooth Route Transition */}
      <main key={activePath} className="flex-1 w-full vantera-page-enter">
        {children}
      </main>

      {/* Clean Editorial Luxury Footer */}
      <footer className="bg-[#111111] text-[#F7F3EC] border-t border-[#111111]/15 mt-20 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 lg:py-20 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
            {/* Brand + Newsletter */}
            <div className="md:col-span-5 space-y-5">
              <div className="space-y-3">
                <span className="font-editorial text-2xl font-medium tracking-[0.28em] uppercase text-[#F7F3EC] block">
                  VANTÉRA
                </span>
                <p className="text-sm text-[#C7C0B4] max-w-sm leading-relaxed font-light">
                  Refined smartphone protection, wireless charging architecture, and everyday desk hardware shipped worldwide.
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
                  className="flex-1 bg-[#1B1B1B] border border-[#F7F3EC]/15 px-4 py-2.5 text-sm text-[#F7F3EC] placeholder-[#C7C0B4]/60 focus:outline-hidden focus:border-[#B89B5E] rounded-xs"
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
                <p className="text-xs text-[#B89B5E]">You are subscribed to VANTÉRA restock alerts.</p>
              )}
              {newsletterStatus === 'error' && (
                <p className="text-xs text-[#E59B9B]">Unable to register that email right now.</p>
              )}
            </div>

            {/* Collections */}
            <div className="md:col-span-3 space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B89B5E]">
                Collections
              </h3>
              <ul className="space-y-2.5 text-sm text-[#C7C0B4] font-light">
                <li>
                  <button type="button" onClick={() => onNavigate('/shop')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    All Collections
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/premium-tech-accessories')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    Premium Tech Accessories
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/smart-home-technology')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    Smart Home Technology
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/laptop-workspace')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    Laptop & Workspace Accessories
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/trending-lifestyle-gadgets')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    Trending Lifestyle Gadgets
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/category/premium-everyday-accessories')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    Premium Everyday Accessories
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/track')} className="hover:text-[#F7F3EC] cursor-pointer text-left">
                    Order Tracking
                  </button>
                </li>
              </ul>
            </div>

            {/* Client Care & Policies */}
            <div className="md:col-span-4 space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#B89B5E]">
                Client Care & Policies
              </h3>
              <ul className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm text-[#C7C0B4] font-light">
                <li>
                  <button type="button" onClick={() => onNavigate('/about')} className="hover:text-[#F7F3EC] cursor-pointer">
                    About VANTÉRA
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/shipping')} className="hover:text-[#F7F3EC] cursor-pointer">
                    Shipping Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/returns')} className="hover:text-[#F7F3EC] cursor-pointer">
                    Returns Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/faq')} className="hover:text-[#F7F3EC] cursor-pointer">
                    FAQ
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/privacy')} className="hover:text-[#F7F3EC] cursor-pointer">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/terms')} className="hover:text-[#F7F3EC] cursor-pointer">
                    Terms of Sale
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/contact')} className="hover:text-[#F7F3EC] cursor-pointer">
                    Contact Us
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onNavigate('/account')} className="hover:text-[#F7F3EC] cursor-pointer">
                    Client Account
                  </button>
                </li>
              </ul>

              <div className="pt-4 border-t border-[#F7F3EC]/10 text-xs text-[#C7C0B4] space-y-1.5">
                <div>
                  WhatsApp Concierge:{' '}
                  <a
                    href="https://wa.me/2347015285932"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#B89B5E] hover:underline"
                  >
                    07015285932
                  </a>
                </div>
                <div>
                  Email:{' '}
                  <a href="mailto:vanteratechnologyelevated@gmail.com" className="hover:text-[#F7F3EC]">
                    vanteratechnologyelevated@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-5 pt-1 text-[11px] uppercase tracking-[0.16em]">
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#C7C0B4] hover:text-[#B89B5E]"
                  >
                    <span>Instagram</span>
                    <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
                  </a>
                  <a
                    href="https://wa.me/2347015285932"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#C7C0B4] hover:text-[#B89B5E]"
                  >
                    <span>WhatsApp</span>
                    <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-[#F7F3EC]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#C7C0B4]">
            <div>© {new Date().getFullYear()} VANTÉRA. All rights reserved.</div>
            <div className="flex flex-wrap items-center gap-6">
              {cookieConsent === null && (
                <button
                  type="button"
                  onClick={() => handleSaveCookieConsent('essential')}
                  className="text-[#B89B5E] hover:underline cursor-pointer"
                >
                  Essential Cookies Active · Dismiss
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAndroidModalOpen(true)}
                className="hover:text-[#F7F3EC] cursor-pointer"
              >
                Android App
              </button>
              <span>vantera.com.ng</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar (5 Tabs: Home, Products, Search, Profile, Cart) */}
      <MobileBottomNav
        visible={showBottomNav}
        activeTab={activeMobileTab}
        itemCount={itemCount}
        cartBounceKey={cartBounceKey}
        isLoggedIn={Boolean(user)}
        onSelectHome={() => {
          setIsSearchOpen(false);
          setIsCartOpen(false);
          onNavigate('/');
        }}
        onSelectProducts={() => {
          setIsSearchOpen(false);
          setIsCartOpen(false);
          onNavigate('/shop');
        }}
        onSelectSearch={() => {
          setIsCartOpen(false);
          setIsSearchOpen(true);
        }}
        onSelectProfile={() => {
          setIsSearchOpen(false);
          setIsCartOpen(false);
          onNavigate(user ? '/account' : '/account?mode=login');
        }}
        onSelectCart={() => {
          setIsSearchOpen(false);
          setIsCartOpen(true);
        }}
      />

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
