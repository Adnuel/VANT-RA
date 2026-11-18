import { Product } from '../data/catalog.ts';
import { CURATED_CATEGORIES, mapLegacyCategoryToCurated } from './curatedCjCatalog.ts';

export type MobileNavTab = 'home' | 'products' | 'search' | 'profile' | 'cart';

export type CheckoutStep =
  | 'cart'
  | 'auth_required'
  | 'shipping'
  | 'confirming_payment'
  | 'confirmed'
  | 'payment_failed';

export interface SearchSuggestionsResult {
  products: Product[];
  categories: Array<{ id: string; label: string; shortLabel: string; description: string }>;
}

/**
 * Computes live product and curated category suggestions for the full-screen search overlay.
 */
export function getSearchSuggestions(
  query: string,
  allProducts: Product[],
  limit = 6
): SearchSuggestionsResult {
  const clean = query.trim().toLowerCase();

  if (!clean) {
    const featured = [...allProducts]
      .sort((a, b) => {
        const aAvail = a.isAvailable && a.stockQuantity > 0 ? 1 : 0;
        const bAvail = b.isAvailable && b.stockQuantity > 0 ? 1 : 0;
        if (aAvail !== bAvail) return bAvail - aAvail;
        return (b.trending ? 1 : 0) - (a.trending ? 1 : 0);
      })
      .slice(0, limit);

    return {
      products: featured,
      categories: CURATED_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        shortLabel: c.shortLabel,
        description: c.description,
      })),
    };
  }

  const matchedProducts = allProducts
    .filter((p) => {
      const catLabel = mapLegacyCategoryToCurated(p.category);
      return (
        p.title.toLowerCase().includes(clean) ||
        p.description.toLowerCase().includes(clean) ||
        p.category.toLowerCase().includes(clean) ||
        String(catLabel).toLowerCase().includes(clean)
      );
    })
    .slice(0, limit);

  const matchedCategories = CURATED_CATEGORIES.filter(
    (c) =>
      c.label.toLowerCase().includes(clean) ||
      c.shortLabel.toLowerCase().includes(clean) ||
      c.description.toLowerCase().includes(clean)
  ).map((c) => ({
    id: c.id,
    label: c.label,
    shortLabel: c.shortLabel,
    description: c.description,
  }));

  return {
    products: matchedProducts,
    categories: matchedCategories,
  };
}

/**
 * Hides the mobile bottom bar on checkout, payment, and payment confirmation screens
 * so nothing distracts from paying.
 */
export function shouldShowMobileBottomNav(
  activePath: string,
  isCartOpen: boolean,
  checkoutStep: CheckoutStep = 'cart'
): boolean {
  if (activePath === '/order-confirmed' || activePath === '/checkout') {
    return false;
  }
  if (isCartOpen && checkoutStep !== 'cart') {
    return false;
  }
  return true;
}

/**
 * Resolves the active mobile navigation tab based on route and overlay states.
 */
export function getMobileActiveTab(
  activePath: string,
  isSearchOpen: boolean,
  isCartOpen: boolean
): MobileNavTab | null {
  if (isCartOpen) return 'cart';
  if (isSearchOpen) return 'search';
  if (activePath === '/') return 'home';
  if (
    activePath === '/shop' ||
    activePath === '/category' ||
    activePath.startsWith('/category/') ||
    activePath === '/product' ||
    activePath.startsWith('/product/')
  ) {
    return 'products';
  }
  if (activePath === '/account' || activePath === '/track') {
    return 'profile';
  }
  return null;
}

/**
 * Wraps a gallery slide index cleanly within [0, total - 1].
 */
export function wrapGalleryIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (((current + delta) % total) + total) % total;
}
