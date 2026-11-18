import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Product, CATEGORIES } from '../data/catalog.ts';
import { mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';

interface TechSpecsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

export const TechSpecsModal: React.FC<TechSpecsModalProps> = ({
  product,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();
  const [selectedFinish, setSelectedFinish] = useState<string>('Obsidian Noir');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [addedNotice, setAddedNotice] = useState<boolean>(false);

  useEffect(() => {
    setQuantity(1);
    setAddedNotice(false);
    if (product?.variants && product.variants.length > 0) {
      const firstAvail =
        product.variants.find((v) => v.isAvailable && v.stockQuantity > 0) || product.variants[0];
      setSelectedVariantId(firstAvail?.id || null);
    } else {
      setSelectedVariantId(null);
    }
  }, [product?.id]);

  if (!isOpen || !product) return null;

  const productVariants = Array.isArray(product.variants) && product.variants.length > 0 ? product.variants : null;
  const activeVariant = productVariants
    ? productVariants.find((v) => v.id === selectedVariantId) || productVariants[0]
    : null;
  const effectiveStock = activeVariant ? activeVariant.stockQuantity : product.stockQuantity;
  const effectivePriceCents = activeVariant ? activeVariant.retailPriceCents : product.retailPriceCents;
  const displayImage = activeVariant?.image || product.image || '/products/charging-phone-stand.jpg';

  const isOutOfStock =
    !product.isAvailable ||
    effectiveStock <= 0 ||
    product.availability === 'out_of_stock' ||
    (activeVariant ? !activeVariant.isAvailable : false);
  const isReservedPhone = product.category === 'phones';
  const mappedCatId = mapLegacyCategoryToCurated(product.category);
  const categoryObj = CATEGORIES.find((c) => c.id === mappedCatId || c.id === product.category);
  const categoryLabel = categoryObj?.label || product.category.replace(/-/g, ' ');

  const finishes = [
    { name: 'Obsidian Noir', hex: '#1B1B1B' },
    { name: 'Champagne Gold', hex: '#B89B5E' },
    { name: 'Warm Stone', hex: '#A69F94' },
    { name: 'Brushed Silver', hex: '#D8D4CC' },
  ];

  const handleAddToCart = () => {
    if (isOutOfStock || isReservedPhone) return;
    addToCart(product, quantity, activeVariant || undefined);
    setAddedNotice(true);
    setTimeout(() => {
      setAddedNotice(false);
      onClose();
      setIsCartOpen(true);
    }, 550);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tech-specs-title"
      className="vantera-overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/65 backdrop-blur-md p-4 font-meta"
    >
      <div className="bg-[#F7F3EC] text-[#111111] w-full max-w-3xl border border-[#111111]/15 rounded-xs overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Studio Image Stage */}
        <div className="md:w-1/2 bg-[#EFEAE0] p-8 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-[#111111]/10">
          <div className="w-full flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#5C574E]">
            <span>VANTÉRA</span>
            <span className="text-[#7A6230] font-medium truncate max-w-[160px]">
              {activeVariant ? activeVariant.name : selectedFinish}
            </span>
          </div>

          <div className="relative my-6 aspect-square w-full max-w-[260px] flex items-center justify-center">
            <img
              src={displayImage}
              alt={product.imageAlt || product.title}
              className="max-h-full max-w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          {productVariants ? (
            <div className="w-full pt-4 border-t border-[#111111]/10 flex flex-wrap items-center justify-center gap-2">
              {productVariants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setQuantity(1);
                  }}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] rounded-xs border cursor-pointer transition-colors ${
                    activeVariant?.id === v.id
                      ? 'border-[#B89B5E] text-[#111111] bg-[#B89B5E]/20 font-semibold'
                      : 'border-[#111111]/15 text-[#5C574E] hover:text-[#111111]'
                  } ${!v.isAvailable || v.stockQuantity <= 0 ? 'opacity-45' : ''}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="w-full pt-4 border-t border-[#111111]/10 flex items-center justify-center gap-3">
              {finishes.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelectedFinish(f.name)}
                  aria-label={`Select ${f.name}`}
                  title={f.name}
                  className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                    selectedFinish === f.name
                      ? 'border-[#B89B5E] scale-115 ring-2 ring-[#B89B5E]/40 ring-offset-2 ring-offset-[#EFEAE0]'
                      : 'border-[#111111]/20 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: f.hex }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Specs & Purchase Module */}
        <div className="md:w-1/2 p-6 sm:p-8 overflow-y-auto flex flex-col justify-between space-y-6 bg-[#FAF7F2]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#7A6230] font-medium">
                  {categoryLabel}
                </p>
                <h2 id="tech-specs-title" className="font-editorial text-2xl font-medium text-[#111111] mt-1">
                  {product.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[#5C574E] hover:text-[#111111] min-w-[40px] min-h-[40px] inline-flex items-center justify-center cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <p className="text-sm text-[#5C574E] leading-relaxed">{product.description}</p>

            <div className="border-y border-[#111111]/10 py-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5C574E] uppercase tracking-[0.14em] text-[10px]">Availability</span>
                <span className={isOutOfStock ? 'text-[#8E3A3A] font-medium' : 'text-[#111111] font-medium'}>
                  {isOutOfStock ? 'Out of stock' : effectiveStock <= 5 ? 'Low stock' : 'In stock'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5C574E] uppercase tracking-[0.14em] text-[10px]">Warranty</span>
                <span className="text-[#111111]">12-Month Hardware Assurance</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#5C574E] block">
                  Price ({currency})
                </span>
                <div className="text-2xl font-medium text-[#111111] tabular-nums mt-0.5">
                  {formatAmount(effectivePriceCents * quantity)}
                </div>
              </div>

              {!isOutOfStock && !isReservedPhone && (
                <div className="flex items-center border border-[#111111]/15 bg-[#F7F3EC] rounded-xs">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="px-3 py-1.5 text-sm text-[#5C574E] hover:text-[#111111] cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium tabular-nums text-[#111111]">{quantity}</span>
                  <button
                    type="button"
                    disabled={quantity >= effectiveStock}
                    onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
                    aria-label="Increase quantity"
                    className="px-3 py-1.5 text-sm text-[#5C574E] hover:text-[#111111] disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            {!isOutOfStock && !isReservedPhone ? (
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer inline-flex items-center justify-center gap-2"
              >
                {addedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <span>Add to Cart · {formatAmount(effectivePriceCents * quantity)}</span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate(`/product/${product.slug}`);
                }}
                className="w-full border border-[#111111]/20 text-[#111111] py-3 px-4 text-[11px] uppercase tracking-[0.2em] rounded-xs cursor-pointer hover:border-[#B89B5E]"
              >
                View Product Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
