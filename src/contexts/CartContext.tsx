import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Product, ProductVariant } from '../data/catalog.ts';
import { useAuth } from './AuthContext.tsx';
import { trackEvent, syncCartWithServer, getOrCreateSessionId } from '../lib/tracker.ts';
import { appNavigate } from '../hooks/useNavigation.ts';
import { formatUSD } from '../lib/commerceLogic.ts';
import { safeFetchJson } from '../lib/safeFetch.ts';

export interface CartItem {
  product: Product;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  unitPriceCents?: number;
}

interface PendingCartProduct {
  product: Product;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  unitPriceCents?: number;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number, selectedVariant?: ProductVariant) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  clearCart: () => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  pendingProduct: PendingCartProduct | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const PENDING_CART_ITEM_KEY = 'vantera_pending_cart_item';

function getCartStorageKey(userId?: string | null): string {
  return userId ? `vantera_cart_user_${userId}` : 'vantera_cart_guest';
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PendingCartProduct | null>(() => {
    try {
      const saved = localStorage.getItem(PENDING_CART_ITEM_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Track cart session ID
  const cartSessionId = useRef<string>(getOrCreateSessionId());
  const isInitialSyncDone = useRef<boolean>(false);

  // Synchronize cart with backend on login / user change
  useEffect(() => {
    if (!user) {
      // Guest or logged out: reset memory items so no cross-customer leakage occurs
      setItems([]);
      isInitialSyncDone.current = false;
      return;
    }

    const storageKey = getCartStorageKey(user.id);
    let localItems: CartItem[] = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) localItems = JSON.parse(saved);
    } catch {}

    // Fetch authoritative persistent cart from backend database
    if (token) {
      safeFetchJson<{ cart?: { items?: any[] } }>('/api/customer/cart', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok && res.data?.cart?.items && Array.isArray(res.data.cart.items) && res.data.cart.items.length > 0) {
          setItems(res.data.cart.items);
          try {
            localStorage.setItem(storageKey, JSON.stringify(res.data.cart.items));
          } catch {}
        } else if (localItems.length > 0) {
          // If server had no cart but user had local items, sync local to server
          setItems(localItems);
          safeFetchJson('/api/customer/cart', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              items: localItems,
              subtotalCents: localItems.reduce(
                (s, i) => s + (i.unitPriceCents ?? i.product?.retailPriceCents ?? 0) * i.quantity,
                0
              ),
            }),
          });
        } else {
          setItems([]);
        }
        isInitialSyncDone.current = true;
      });
    } else {
      setItems(localItems);
      isInitialSyncDone.current = true;
    }
  }, [user?.id, token]);

  // Save items and sync with server whenever items change
  useEffect(() => {
    if (!user) return;

    const storageKey = getCartStorageKey(user.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {}

    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce(
      (sum, item) => sum + (item.unitPriceCents ?? item.product.retailPriceCents) * item.quantity,
      0
    );

    // Sync to abandonment tracker
    syncCartWithServer(cartSessionId.current, items, count, subtotal);

    // Sync to persistent customer cart in database
    if (token && isInitialSyncDone.current) {
      safeFetchJson('/api/customer/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items, subtotalCents: subtotal }),
      });
    }
  }, [items, user?.id, token]);

  // When user signs in, if they had a pending product waiting, add it now!
  useEffect(() => {
    if (user && pendingProduct) {
      const { product, quantity, variantId, variantLabel, unitPriceCents } = pendingProduct;
      localStorage.removeItem(PENDING_CART_ITEM_KEY);
      setPendingProduct(null);

      // Add to cart now that authenticated
      setItems((prev) => {
        const existingIdx = prev.findIndex(
          (i) => i.product.id === product.id && (i.variantId || null) === (variantId || null)
        );
        if (existingIdx > -1) {
          const copy = [...prev];
          copy[existingIdx] = {
            ...copy[existingIdx],
            quantity: copy[existingIdx].quantity + quantity,
          };
          return copy;
        } else {
          return [...prev, { product, quantity, variantId, variantLabel, unitPriceCents }];
        }
      });

      trackEvent('cart_item_added', {
        productId: product.id,
        productTitle: product.title,
        variantId,
        variantLabel,
        quantity,
        retailPriceCents: unitPriceCents ?? product.retailPriceCents,
        resumedAfterLogin: true,
      });

      setIsCartOpen(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('openCart') === '1' || params.get('checkout') === '1') {
        setIsCartOpen(true);
        params.delete('openCart');
        params.delete('checkout');
        const nextQuery = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (nextQuery ? `?${nextQuery}` : ''));
      }
    } catch {}
  }, [user]);

  /**
   * STRICT REQUIREMENT:
   * Require every customer to register or log in before they can add products to their shopping cart.
   */
  const addToCart = (product: Product, quantity = 1, selectedVariant?: ProductVariant) => {
    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    const resolvedVariant = selectedVariant
      ? selectedVariant
      : hasVariants
      ? product.variants!.find((v) => v.isAvailable && v.stockQuantity > 0)
      : undefined;

    if (hasVariants && !resolvedVariant) {
      return;
    }

    const effectiveAvailable = resolvedVariant
      ? product.isAvailable && resolvedVariant.isAvailable && resolvedVariant.stockQuantity > 0
      : product.isAvailable && product.stockQuantity > 0;

    const stockLimit = resolvedVariant
      ? resolvedVariant.stockQuantity
      : typeof product.stockQuantity === 'number'
      ? product.stockQuantity
      : 99;

    if (!effectiveAvailable || stockLimit <= 0) {
      return;
    }

    const safeQty = Math.max(1, Math.min(quantity, stockLimit));
    const unitPriceCents = resolvedVariant?.retailPriceCents ?? product.retailPriceCents;
    const itemSnapshotProduct = resolvedVariant?.image
      ? { ...product, image: resolvedVariant.image }
      : product;

    if (!user) {
      // Customer is NOT logged in: save pending selection and prompt for registration/login
      const pending: PendingCartProduct = {
        product: itemSnapshotProduct,
        quantity: safeQty,
        variantId: resolvedVariant?.id,
        variantLabel: resolvedVariant?.name,
        unitPriceCents,
      };
      setPendingProduct(pending);
      try {
        localStorage.setItem(PENDING_CART_ITEM_KEY, JSON.stringify(pending));
      } catch {}
      setIsAuthModalOpen(true);
      return;
    }

    // Customer is authenticated: proceed with adding while respecting stock cap
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.product.id === product.id && (i.variantId || null) === (resolvedVariant?.id || null)
      );
      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: Math.min(stockLimit, copy[existingIdx].quantity + safeQty),
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            product: itemSnapshotProduct,
            quantity: safeQty,
            variantId: resolvedVariant?.id,
            variantLabel: resolvedVariant?.name,
            unitPriceCents,
          },
        ];
      }
    });

    trackEvent('cart_item_added', {
      productId: product.id,
      productTitle: product.title,
      variantId: resolvedVariant?.id,
      variantLabel: resolvedVariant?.name,
      quantity: safeQty,
      retailPriceCents: unitPriceCents,
    });

    setIsCartOpen(true);
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        const matches =
          item.product.id === productId &&
          (variantId === undefined || (item.variantId || null) === (variantId || null));
        if (!matches) return item;
        const matchedVariant = item.variantId
          ? item.product.variants?.find((v) => v.id === item.variantId)
          : undefined;
        const stockSource = matchedVariant ? matchedVariant.stockQuantity : item.product.stockQuantity;
        const maxStock = typeof stockSource === 'number' ? Math.max(1, stockSource) : 99;
        return { ...item, quantity: Math.min(quantity, maxStock, 99) };
      })
    );
    trackEvent('cart_quantity_changed', {
      productId,
      variantId,
      quantity,
    });
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    const item = items.find(
      (i) =>
        i.product.id === productId &&
        (variantId === undefined || (i.variantId || null) === (variantId || null))
    );
    setItems((prev) =>
      prev.filter(
        (i) =>
          !(
            i.product.id === productId &&
            (variantId === undefined || (i.variantId || null) === (variantId || null))
          )
      )
    );
    if (item) {
      trackEvent('cart_item_removed', {
        productId,
        variantId,
        productTitle: item.product.title,
      });
    }
  };

  const clearCart = () => {
    setItems([]);
    if (user) {
      try {
        localStorage.removeItem(getCartStorageKey(user.id));
      } catch {}
      if (token) {
        safeFetchJson('/api/customer/cart', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalCents = items.reduce(
    (sum, item) => sum + (item.unitPriceCents ?? item.product.retailPriceCents) * item.quantity,
    0
  );

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

              <p className="text-xs text-[#77746d] leading-relaxed">
                VANTÉRA curates high-end tech objects with limited reservation allocations. Please create an account or sign in to reserve items in your shopping bag.
              </p>

              {pendingProduct && (
                <div className="flex items-center gap-3 p-3 bg-[#fdfdfc] border border-[#e7e4de] text-xs">
                  {pendingProduct.product.image && (
                    <img
                      src={pendingProduct.product.image}
                      alt={pendingProduct.product.title}
                      className="w-10 h-10 object-cover border border-[#e7e4de]"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#121210] truncate">{pendingProduct.product.title}</p>
                    {pendingProduct.variantLabel && (
                      <p className="text-[10px] text-[#77746d] truncate">{pendingProduct.variantLabel}</p>
                    )}
                    <p className="text-[11px] text-[#77746d]">
                      Qty: {pendingProduct.quantity} •{' '}
                      {formatUSD((pendingProduct.unitPriceCents ?? pendingProduct.product.retailPriceCents) * pendingProduct.quantity)}
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    appNavigate('/account?mode=register&returnTo=cart');
                  }}
                  className="w-full bg-[#121210] hover:bg-[#252521] text-white py-3 text-xs uppercase font-mono tracking-wider transition-colors cursor-pointer text-center"
                >
                  Create Client Account →
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAuthModalOpen(false);
                    appNavigate('/account?mode=login&returnTo=cart');
                  }}
                  className="w-full border border-[#121210] text-[#121210] hover:bg-[#f5f5f4] py-2.5 text-xs uppercase font-mono tracking-wider transition-colors cursor-pointer text-center"
                >
                  Sign In to Existing Account
                </button>
              </div>

              <p className="text-[10px] text-center text-[#a9a69f]">
                Your selection will be held while you sign in.
              </p>
            </div>
          </div>
        </div>
      )}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
