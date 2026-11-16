/**
 * VANTÉRA Core Storefront & Cart Engine (Vanilla JS Architecture)
 * Supports independent static hosting on Cloudflare Pages and dynamic API fetching.
 */

const VANTERA_INITIAL_PRODUCTS = [];

class VanteraCart {
  constructor() {
    this.storageKey = 'vantera_cart';
    this.cart = this.loadCart();
  }

  loadCart() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.cart));
      localStorage.setItem('vantera_cart_count', this.getItemCount().toString());
      this.syncCartBadges();
      window.dispatchEvent(new CustomEvent('vantera_cart_updated', { detail: { cart: this.cart } }));
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e);
    }
  }

  addItem(product, quantity = 1) {
    const existing = this.cart.find((i) => i.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.cart.push({
        id: product.id,
        title: product.title,
        price: parseFloat(product.price || product.retailPriceCents / 100 || 0),
        image: product.image,
        variantId: product.variantId || `zd_${product.id}`,
        quantity: quantity,
      });
    }
    this.saveCart();
  }

  removeItem(productId) {
    this.cart = this.cart.filter((i) => i.id !== productId);
    this.saveCart();
  }

  updateQuantity(productId, quantity) {
    const item = this.cart.find((i) => i.id === productId);
    if (item) {
      item.quantity = Math.max(1, quantity);
      this.saveCart();
    }
  }

  getItems() {
    return this.cart;
  }

  getItemCount() {
    return this.cart.reduce((acc, i) => acc + (i.quantity || 1), 0);
  }

  getTotal() {
    return this.cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  }

  clearCart() {
    this.cart = [];
    this.saveCart();
  }

  syncCartBadges() {
    const count = this.getItemCount();
    document.querySelectorAll('.vantera-cart-count').forEach((el) => {
      el.textContent = count.toString();
      el.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  }

  proceedToCheckout() {
    window.location.href = '/checkout.html';
  }
}

// Global Cart Instance
window.vanteraCart = new VanteraCart();

// Fetch products from serverless/backend API with fallback
async function vanteraFetchProducts() {
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const text = await res.text();
      let data = null;
      if (text && text.trim().startsWith('{')) {
        try {
          data = JSON.parse(text);
        } catch {}
      }
      if (data && data.products && Array.isArray(data.products) && data.products.length > 0) {
        return data.products.map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
          price: (p.retailPriceCents || 0) / 100,
          referencePrice: p.referencePriceCents ? p.referencePriceCents / 100 : null,
          image: p.image,
          description: p.description,
          variantId: `zd_${p.id}`,
          trending: Boolean(p.trending),
        }));
      }
    }
  } catch (err) {
    console.info('Using curated offline catalog.');
  }
  return VANTERA_INITIAL_PRODUCTS;
}

// Render dynamic product layout
function vanteraRenderProducts(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = products
    .map(
      (p) => `
    <article class="vantera-product-card" onclick="window.location.href='/product/${p.id}'">
      <div class="vantera-img-frame">
        <img src="${p.image}" alt="${p.title}" onerror="this.src='/products/charging-phone-stand.jpg'" loading="lazy" />
        ${p.trending ? '<span class="vantera-flagship-tag">★ Flagship</span>' : ''}
      </div>
      <div class="vantera-card-body">
        <div class="vantera-category-kicker">${p.category.toUpperCase().replace('-', ' ')}</div>
        <h3 class="vantera-card-title">${p.title}</h3>
        <p class="vantera-card-desc">${p.description}</p>
        <div class="vantera-card-action">
          <div>
            <span class="vantera-price">$${p.price.toFixed(2)}</span>
            ${p.referencePrice ? `<span class="vantera-ref-price">$${p.referencePrice.toFixed(2)}</span>` : ''}
          </div>
          <button type="button" class="vantera-acquire-btn" onclick="event.stopPropagation(); window.vanteraCart.addItem(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1); window.vanteraCart.proceedToCheckout();">
            Acquire ✦
          </button>
        </div>
      </div>
    </article>
  `
    )
    .join('');
}

// Expose globally
window.vanteraFetchProducts = vanteraFetchProducts;
window.vanteraRenderProducts = vanteraRenderProducts;

// Auto-sync badges on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.vanteraCart.syncCartBadges();
});
