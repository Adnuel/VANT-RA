import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product } from '../data/catalog.ts';
import { useAuth } from './AuthContext.tsx';
import { trackEvent, syncCartWithServer, getOrCreateSessionId } from '../lib/tracker.ts';
import { appNavigate } from '../hooks/useNavigation.ts';
import { formatUSD } from '../lib/commerceLogic.ts';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  pendingProduct: { product: Product; quantity: number } | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'vantera_cart_v1';
const PENDING_CART_ITEM_KEY = 'vantera_pending_cart_item';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<{ product: Product; quantity: number } | null>(() => {
    try {
      const saved = localStorage.getItem(PENDING_CART_ITEM_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Track cart session ID
  const cartSessionId = useRef<string>(getOrCreateSessionId());

  // Save items and sync with server
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage quota or private browsing
    }

    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.product.retailPriceCents * item.quantity, 0);
    syncCartWithServer(cartSessionId.current, items, count, subtotal);
  }, [items]);

  // When user signs in, if they had a pending product waiting, add it now!
  useEffect(() => {
    if (user && pendingProduct) {
      const { product, quantity } = pendingProduct;
      localStorage.removeItem(PENDING_CART_ITEM_KEY);
      setPendingProduct(null);

      // Add to cart now that authenticated
      setItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.product.id === product.id);
        if (existingIdx > -1) {
          const copy = [...prev];
          copy[existingIdx].quantity += quantity;
          return copy;
        } else {
          return [...prev, { product, quantity }];
        }
      });

      trackEvent('cart_item_added', {
        productId: product.id,
        productTitle: product.title,
        quantity,
        retailPriceCents: product.retailPriceCents,
        resumedAfterLogin: true,
      });

      setIsCartOpen(true);
    }
  }, [user]);

  /**
   * STRICT REQUIREMENT:
   * Require every customer to register or log in before they can add products to their shopping cart.
   */
  const addToCart = (product: Product, quantity = 1) => {
    if (!user) {
      // Customer is NOT logged in: block addition and prompt for registration/login
      const pending = { product, quantity };
      setPendingProduct(pending);
      try {
        localStorage.setItem(PENDING_CART_ITEM_KEY, JSON.stringify(pending));
      } catch {}
      setIsAuthModalOpen(true);
      return;
    }

    // Customer is authenticated: proceed with adding
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === product.id);
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += quantity;
        return copy;
      } else {
        return [...prev, { product, quantity }];
      }
    });

    trackEvent('cart_item_added', {
      productId: product.id,
      productTitle: product.title,
      quantity,
      retailPriceCents: product.retailPriceCents,
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: Math.min(quantity, 99) } : item))
    );
    trackEvent('cart_quantity_changed', {
      productId,
      quantity,
    });
  };

  const removeFromCart = (productId: string) => {
    const item = items.find((i) => i.product.id === productId);
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
    if (item) {
      trackEvent('cart_item_removed', {
        productId,
        productTitle: item.product.title,
      });
    }
  };

  const clearCart = () => {
    setItems([]);
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = items.reduce((sum, item) => sum + item.product.retailPriceCents * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotalCents,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        isAuthModalOpen,
        setIsAuthModalOpen,
        pendingProduct,
      }}
    >
      {children}

      {/* Mandatory Client Authentication Modal */}
      {isAuthModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#121210]/70 p-4 backdrop-blur-xs animate-fadeIn"
        >
          <div className="relative w-full max-w-md bg-white border border-[#121210] p-6 sm:p-8 shadow-2xl text-left">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute top-4 right-4 text-[#77746d] hover:text-[#121210] p-1.5 transition-colors cursor-pointer rounded-xs"
              aria-label="Close modal"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg font-bold tracking-widest text-[#121210]">VANTÉRA</span>
                <span className="text-[10px] uppercase font-mono tracking-wider bg-[#fff8e6] text-[#856404] px-2 py-0.5 border border-[#ffeeba]">
                  Client Access
                </span>
              </div>

              <h2 id="auth-modal-title" className="font-serif text-xl sm:text-2xl text-[#121210] font-normal leading-tight">
                Account Required to Add Products
              </h2>

              <p className="text-xs sm:text-sm text-[#77746d] leading-relaxed">
                To guarantee authenticated order tracking and personal bank transfer verification by CEO Adnuel, VANTÉRA requires all clients to be registered and signed in before reserving items in the review cart.
              </p>

              {pendingProduct && (
                <div className="bg-[#fbfaf7] border border-[#e7e4de] p-3 flex items-center gap-3">
                  {pendingProduct.product.image ? (
                    <img
                      src={pendingProduct.product.image}
                      alt={pendingProduct.product.title}
                      className="w-12 h-12 object-contain bg-white border border-[#e7e4de] p-1"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-[#eae7e0] flex items-center justify-center font-serif text-xs text-[#77746d]">
                      V
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#121210] truncate">
                      {pendingProduct.product.title}
                    </p>
                    <p className="text-[11px] text-[#c4a66b] font-mono">
                      {formatUSD(pendingProduct.product.retailPriceCents)}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    appNavigate('/account');
                  }}
                  className="flex-1 bg-[#121210] text-[#f8f7f4] py-3 px-4 text-xs font-semibold uppercase tracking-widest hover:bg-[#c4a66b] hover:text-[#121210] transition-colors text-center"
                >
                  Sign In / Register Account
                </button>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  className="border border-[#e7e4de] text-[#77746d] py-3 px-4 text-xs font-semibold uppercase tracking-wider hover:text-[#121210] hover:border-[#121210] transition-colors"
                >
                  Continue Browsing
                </button>
              </div>

              <p className="text-[10px] text-[#a9a69f] text-center pt-2 border-t border-[#e7e4de]">
                Registration takes under 30 seconds · No credit card required
              </p>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
