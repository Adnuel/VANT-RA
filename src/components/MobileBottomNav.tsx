import React from 'react';
import { Home, LayoutGrid, Search, User, ShoppingBag } from 'lucide-react';
import { MobileNavTab } from '../lib/storefrontHelpers.ts';

interface MobileBottomNavProps {
  visible: boolean;
  activeTab: MobileNavTab | null;
  itemCount: number;
  cartBounceKey: number;
  isLoggedIn: boolean;
  onSelectHome: () => void;
  onSelectProducts: () => void;
  onSelectSearch: () => void;
  onSelectProfile: () => void;
  onSelectCart: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  visible,
  activeTab,
  itemCount,
  cartBounceKey,
  isLoggedIn,
  onSelectHome,
  onSelectProducts,
  onSelectSearch,
  onSelectProfile,
  onSelectCart,
}) => {
  if (!visible) return null;

  const tabs: Array<{
    id: MobileNavTab;
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'home',
      label: 'Home',
      onClick: onSelectHome,
      icon: <Home className="w-[19px] h-[19px]" strokeWidth={1.5} aria-hidden="true" />,
    },
    {
      id: 'products',
      label: 'Products',
      onClick: onSelectProducts,
      icon: <LayoutGrid className="w-[19px] h-[19px]" strokeWidth={1.5} aria-hidden="true" />,
    },
    {
      id: 'search',
      label: 'Search',
      onClick: onSelectSearch,
      icon: <Search className="w-[19px] h-[19px]" strokeWidth={1.5} aria-hidden="true" />,
    },
    {
      id: 'profile',
      label: 'Profile',
      onClick: onSelectProfile,
      icon: <User className="w-[19px] h-[19px]" strokeWidth={1.5} aria-hidden="true" />,
    },
    {
      id: 'cart',
      label: 'Cart',
      onClick: onSelectCart,
      icon: <ShoppingBag className="w-[19px] h-[19px]" strokeWidth={1.5} aria-hidden="true" />,
      badge: itemCount,
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      data-testid="mobile-bottom-nav"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#F7F3EC]/90 backdrop-blur-md border-t border-[#111111]/10 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 h-[60px] max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={tab.onClick}
              aria-current={isActive ? 'page' : undefined}
              aria-label={
                tab.id === 'cart'
                  ? `Cart (${itemCount} items)`
                  : tab.id === 'profile'
                  ? isLoggedIn
                    ? 'Profile (Account)'
                    : 'Profile (Sign in or sign up)'
                  : tab.label
              }
              className="relative flex flex-col items-center justify-center gap-1 min-w-[48px] min-h-[48px] px-1 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[#B89B5E] focus-visible:-outline-offset-2"
            >
              {/* Top Active Gold Hairline */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 w-7 h-[2px] bg-[#B89B5E]"
                />
              )}

              <span
                className={`relative transition-colors ${
                  isActive ? 'text-[#B89B5E]' : 'text-[#5C574E]'
                }`}
              >
                {tab.icon}
                {tab.id === 'cart' && itemCount > 0 && (
                  <span
                    key={cartBounceKey}
                    data-testid="mobile-cart-badge"
                    className="cart-badge-bounce absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#B89B5E] text-[#111111] text-[9px] font-semibold flex items-center justify-center tabular-nums"
                  >
                    {itemCount}
                  </span>
                )}
              </span>

              <span
                className={`text-[10px] tracking-[0.06em] leading-none transition-colors ${
                  isActive ? 'text-[#111111] font-semibold' : 'text-[#5C574E] font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
