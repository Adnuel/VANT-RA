import React, { useState, useEffect } from 'react';
import { DeviceProvider } from './contexts/DeviceContext.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { CurrencyProvider } from './contexts/CurrencyContext.tsx';
import { CartProvider } from './contexts/CartContext.tsx';
import { useNavigation } from './hooks/useNavigation.ts';
import { INITIAL_PRODUCTS, Product } from './data/catalog.ts';

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

function MainRouter() {
  const { route, navigate } = useNavigation();
  const { adminToken } = useAuth();
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          setProducts(data.products);
        }
      })
      .catch(() => {
        // Default to INITIAL_PRODUCTS
      });
  }, []);

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
  } else if (['/about', '/contact', '/faq', '/shipping', '/returns', '/privacy', '/terms'].includes(route.path)) {
    pageContent = <InfoPage pageKey={route.path} onNavigate={navigate} />;
  } else if (route.path === '/account') {
    pageContent = <AccountPage onNavigate={navigate} />;
  } else if (route.path === '/track') {
    pageContent = <TrackOrderPage onNavigate={navigate} />;
  } else {
    pageContent = (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="font-serif text-3xl text-[#121210]">Page Not Found</h1>
        <p className="text-xs text-[#77746d]">The page you are looking for does not exist on VANTÉRA.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#121210] text-[#f8f7f4] px-6 py-2.5 text-xs uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210]"
        >
          Return to Storefront
        </button>
      </div>
    );
  }

  return (
    <StoreLayout activePath={route.path} onNavigate={navigate}>
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
            <MainRouter />
          </CartProvider>
        </CurrencyProvider>
      </AuthProvider>
    </DeviceProvider>
  );
}
