import React, { useState, useEffect } from 'react';
import { DeviceProvider } from './contexts/DeviceContext.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { CurrencyProvider } from './contexts/CurrencyContext.tsx';
import { CartProvider } from './contexts/CartContext.tsx';
import { WishlistProvider } from './contexts/WishlistContext.tsx';
import { useNavigation } from './hooks/useNavigation.ts';
import { Product } from './data/catalog.ts';
import { safeFetchJson } from './lib/safeFetch.ts';

import { StoreLayout } from './components/StoreLayout.tsx';
import { Home } from './pages/Home.tsx';
import { ShopPage } from './pages/ShopPage.tsx';
import { ProductPage } from './pages/ProductPage.tsx';
import { InfoPage } from './pages/InfoPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { TrackOrderPage } from './pages/TrackOrderPage.tsx';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { DeveloperPortalPage } from './pages/DeveloperPortalPage.tsx';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage.tsx';

function MainRouter() {
  const { route, navigate } = useNavigation();
  const { adminToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = React.useCallback(() => {
    safeFetchJson<{ products: Product[] }>('/api/products', { cache: 'no-store' }).then((res) => {
      if (res.ok && res.data && Array.isArray(res.data.products)) {
        setProducts(res.data.products);
      }
    });
  }, []);

  useEffect(() => {
    refreshProducts();
    const handleCatalogUpdate = () => refreshProducts();
    window.addEventListener('vantera:catalog-updated', handleCatalogUpdate);
    return () => window.removeEventListener('vantera:catalog-updated', handleCatalogUpdate);
  }, [refreshProducts, route.path]);

  // Separate interface: CEO Admin Login
  if (route.path === '/admin/login' || route.path === '/ceo/login') {
    return <AdminLoginPage onNavigate={navigate} />;
  }

  // Separate interface: CEO Admin Dashboard
  if (['/admin/dashboard', '/admin', '/ceo', '/ceo/dashboard'].includes(route.path)) {
    if (!adminToken) {
      return <AdminLoginPage onNavigate={navigate} />;
    }
    return <AdminDashboardPage onNavigate={navigate} />;
  }

  // Separate interface: Developer & Technical Operations Portal & Domain Setup
  if (['/dev', '/developer', '/domain', '/custom-domain', '/dns'].includes(route.path)) {
    return <DeveloperPortalPage onNavigate={navigate} />;
  }

  // Public Storefront Interface
  let pageContent: React.ReactNode = null;

  if (route.path === '/') {
    pageContent = <Home products={products} onNavigate={navigate} />;
  } else if (route.path === '/shop') {
    pageContent = (
      <ShopPage
        products={products}
        initialFilter={route.filter}
        initialSearchQuery={route.searchQuery}
        onNavigate={navigate}
      />
    );
  } else if (route.path === '/category') {
    pageContent = (
      <ShopPage
        products={products}
        activeCategory={route.category}
        initialFilter={route.filter}
        initialSearchQuery={route.searchQuery}
        onNavigate={navigate}
      />
    );
  } else if (route.path === '/product') {
    pageContent = <ProductPage productSlug={route.productSlug || ''} products={products} onNavigate={navigate} />;
  } else if (['/about', '/contact', '/faq', '/shipping', '/shipping-policy', '/returns', '/refund-policy', '/privacy', '/privacy-policy', '/terms'].includes(route.path)) {
    pageContent = <InfoPage pageKey={route.path} onNavigate={navigate} />;
  } else if (route.path === '/order-confirmed') {
    pageContent = <OrderConfirmationPage onNavigate={navigate} />;
  } else if (route.path === '/account') {
    pageContent = <AccountPage initialMode={route.mode as any} onNavigate={navigate} />;
  } else if (route.path === '/track') {
    pageContent = <TrackOrderPage initialReference={route.trackReference} onNavigate={navigate} />;
  } else {
    pageContent = (
      <div className="max-w-3xl mx-auto px-6 py-28 text-center space-y-6">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#C8A96A] font-medium">
          Error 404
        </p>
        <h1 className="font-editorial text-4xl sm:text-5xl font-medium text-[#F5F1E8]">
          This Page Could Not Be Found
        </h1>
        <p className="text-sm sm:text-base text-[#A8A297] max-w-md mx-auto leading-relaxed">
          The link may be outdated or the item has moved. Return to our collection or view your client account below.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="gold-gradient-bg px-7 py-3.5 text-xs uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
          >
            Return Home
          </button>
          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="border border-white/15 hover:border-[#C8A96A] text-[#F5F1E8] hover:text-[#C8A96A] px-7 py-3.5 text-xs uppercase tracking-[0.2em] font-medium rounded-xs transition-colors cursor-pointer"
          >
            Browse Collection
          </button>
        </div>
      </div>
    );
  }

  return (
    <StoreLayout activePath={route.path} products={products} onNavigate={navigate}>
      {pageContent}
    </StoreLayout>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <AuthProvider>
        <CurrencyProvider>
          <CartProvider>
            <WishlistProvider>
              <MainRouter />
            </WishlistProvider>
          </CartProvider>
        </CurrencyProvider>
      </AuthProvider>
    </DeviceProvider>
  );
}
