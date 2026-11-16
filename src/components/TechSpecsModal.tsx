import React, { useState, useEffect } from 'react';
import { Product } from '../data/catalog.ts';
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

  const finishes = [
    { name: 'Obsidian Noir', hex: '#141416' },
    { name: 'Champagne Gold', hex: '#C8A96A' },
    { name: 'Slate Gray', hex: '#4B5563' },
    { name: 'Brushed Silver', hex: '#E5E7EB' },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
    >
      <div className="bg-[#141416] text-[#F5F1E8] w-full max-w-3xl border border-white/10 rounded-xs overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Studio Image Stage */}
        <div className="md:w-1/2 bg-[#0B0B0C] p-8 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-white/8">
          <div className="w-full flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#A8A297]">
            <span>VANTÉRA</span>
            <span className="text-[#C8A96A] font-medium truncate max-w-[160px]">
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
            <div className="w-full pt-4 border-t border-white/8 flex flex-wrap items-center justify-center gap-2">
              {productVariants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setQuantity(1);
                  }}
                  className={`px-2.5 py-1 text-[10px] rounded-xs border cursor-pointer transition-colors ${
                    activeVariant?.id === v.id
                      ? 'border-[#C8A96A] text-[#F5F1E8] bg-[#C8A96A]/10'
                      : 'border-white/15 text-[#A8A297] hover:text-[#F5F1E8]'
                  } ${!v.isAvailable || v.stockQuantity <= 0 ? 'opacity-45' : ''}`}
                >
                  {v.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="w-full pt-4 border-t border-white/8 flex items-center justify-center gap-3">
              {finishes.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelectedFinish(f.name)}
                  aria-label={`Select ${f.name}`}
                  title={f.name}
                  className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                    selectedFinish === f.name
                      ? 'border-[#C8A96A] scale-115 ring-2 ring-[#C8A96A]/40 ring-offset-2 ring-offset-[#0B0B0C]'
                      : 'border-white/20 opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: f.hex }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Specs & Purchase Module */}
        <div className="md:w-1/2 p-6 sm:p-8 overflow-y-auto flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96A]">
                  {product.category.replace('-', ' ')}
                </p>
                <h2 id="tech-specs-title" className="font-editorial text-2xl font-medium text-[#F5F1E8] mt-1">
                  {product.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[#A8A297] hover:text-[#F5F1E8] p-1.5 cursor-pointer"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-[#A8A297] leading-relaxed">{product.description}</p>

            <div className="border-y border-white/8 py-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#A8A297] uppercase tracking-[0.12em] text-[10px]">Availability</span>
                <span className={isOutOfStock ? 'text-[#E57373]' : 'text-[#F5F1E8]'}>
                  {isOutOfStock ? 'Out of stock' : `${effectiveStock} units ready`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A8A297] uppercase tracking-[0.12em] text-[10px]">Warranty</span>
                <span className="text-[#F5F1E8]">12-Month Hardware Assurance</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#A8A297] block">
                  Price ({currency})
                </span>
                <div className="text-2xl font-medium text-[#C8A96A] tabular-nums mt-0.5">
                  {formatAmount(effectivePriceCents * quantity)}
                </div>
              </div>

              {!isOutOfStock && !isReservedPhone && (
                <div className="flex items-center border border-white/12 bg-[#0B0B0C] rounded-xs">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="px-3 py-1.5 text-sm text-[#A8A297] hover:text-[#F5F1E8] cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    disabled={quantity >= effectiveStock}
                    onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
                    aria-label="Increase quantity"
                    className="px-3 py-1.5 text-sm text-[#A8A297] hover:text-[#F5F1E8] disabled:opacity-40 cursor-pointer"
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
                className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
              >
                {addedNotice
                  ? 'Added to Bag'
                  : `Add to Cart · ${formatAmount(effectivePriceCents * quantity)}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigate(`/product/${product.slug}`);
                }}
                className="w-full border border-white/15 text-[#F5F1E8] py-3 px-4 text-[11px] uppercase tracking-[0.2em] rounded-xs cursor-pointer hover:border-[#C8A96A]"
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
