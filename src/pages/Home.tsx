import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '../data/catalog.ts';
import { CURATED_CATEGORIES, CuratedCategoryId, mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { TechSpecsModal } from '../components/TechSpecsModal.tsx';
import { FadeInSection } from '../components/FadeInSection.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { safeFetchJson } from '../lib/safeFetch.ts';
import heroShowcaseImg from '../assets/images/hero_atelier_showcase_1794563896264.jpg';
import brandStoryImg from '../assets/images/brand_story_craft_1794563897087.jpg';

interface HomeProps {
  products: Product[];
  onNavigate: (url: string) => void;
}

interface StoreReview {
  id: string;
  authorName: string;
  rating: number;
  title?: string;
  comment: string;
  verifiedBuyer?: boolean;
  createdAt: string;
}

export const Home: React.FC<HomeProps> = ({ products, onNavigate }) => {
  const { user, token } = useAuth();
  const [curationTab, setCurationTab] = useState<'all' | CuratedCategoryId>('all');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    safeFetchJson<{ reviews?: StoreReview[] }>('/api/reviews')
      .then((res) => {
        if (res.ok && Array.isArray(res.data?.reviews)) {
          setReviews(res.data.reviews);
        }
      })
      .finally(() => setReviewsLoaded(true));
  }, []);

  const curatedFinds = useMemo(() => {
    const availableFirst = [...products].sort((a, b) => {
      const aAvail = a.isAvailable && a.stockQuantity > 0 ? 1 : 0;
      const bAvail = b.isAvailable && b.stockQuantity > 0 ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      return (b.trending ? 1 : 0) - (a.trending ? 1 : 0);
    });

    if (curationTab !== 'all') {
      return availableFirst
        .filter((p) => mapLegacyCategoryToCurated(p.category) === curationTab || p.category === curationTab)
        .slice(0, 6);
    }
    return availableFirst.slice(0, 6);
  }, [products, curationTab]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !reviewComment.trim()) return;
    setReviewStatus('submitting');
    setReviewError('');
    try {
      const res = await safeFetchJson<{ review?: StoreReview; error?: string }>('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle.trim(),
          comment: reviewComment.trim(),
        }),
      });
      if (res.ok && res.data?.review) {
        setReviews((prev) => [res.data!.review!, ...prev]);
        setReviewTitle('');
        setReviewComment('');
        setReviewStatus('success');
        setIsReviewFormOpen(false);
      } else {
        setReviewError(res.data?.error || res.error || 'Unable to submit review.');
        setReviewStatus('error');
      }
    } catch {
      setReviewError('Unable to submit review right now.');
      setReviewStatus('error');
    }
  };

  return (
    <div className="bg-[#0B0B0C] text-[#F5F1E8]">
      {/* 1. Full-Screen Atmospheric Luxury Hero */}
      <section className="relative min-h-[84vh] sm:min-h-[88vh] w-full flex items-end overflow-hidden border-b border-white/8">
        <img
          src={heroShowcaseImg}
          alt="VANTÉRA brushed aluminum MagSafe charging stand and matte black hardware on dark basalt stone"
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0B0B0C] via-[#0B0B0C]/65 to-[#0B0B0C]/25"
        />
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#0B0B0C]/90 via-[#0B0B0C]/45 to-transparent"
        />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-8 lg:px-12 pb-16 sm:pb-24 pt-28">
          <div className="max-w-xl space-y-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.26em] text-[#C8A96A]">
              VANTÉRA · Worldwide
            </p>
            <h1
              className="font-editorial font-medium text-[#F5F1E8] leading-[1.06] tracking-tight text-balance"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4.25rem)' }}
            >
              Precision objects for modern daily carry.
            </h1>
            <p className="text-sm sm:text-base text-[#A8A297] leading-relaxed max-w-md">
              Architectural charging stations, impact protection, and studio desk hardware calibrated for quiet reliability.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="gold-gradient-bg px-8 py-4 text-[11px] uppercase tracking-[0.22em] font-semibold rounded-xs cursor-pointer whitespace-nowrap"
              >
                Shop Collection
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Featured / Best-Selling Collection */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20 lg:py-28 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#C8A96A]">
                Selected Pieces
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F5F1E8] text-balance">
                The Core Collection
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'All Finds' },
                ...CURATED_CATEGORIES.map((c) => ({ id: c.id, label: c.shortLabel })),
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCurationTab(tab.id as any)}
                  className={`px-4 py-2 text-[11px] uppercase tracking-[0.18em] rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                    curationTab === tab.id
                      ? 'bg-[#C8A96A] text-[#0B0B0C] font-semibold'
                      : 'bg-[#141416] text-[#A8A297] border border-white/10 hover:text-[#F5F1E8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {curatedFinds.length === 0 ? (
              <div className="col-span-full border border-white/8 bg-[#141416] p-10 text-center space-y-3 rounded-xs">
                <p className="text-sm text-[#A8A297]">
                  No pieces currently match this filter.
                </p>
                <button
                  type="button"
                  onClick={() => setCurationTab('all')}
                  className="text-[11px] uppercase tracking-[0.2em] text-[#C8A96A] underline cursor-pointer"
                >
                  Show All Finds
                </button>
              </div>
            ) : (
              curatedFinds.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onNavigate={onNavigate}
                  onQuickView={(p) => setQuickViewProduct(p)}
                />
              ))
            )}
          </div>

          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => onNavigate('/shop')}
              className="px-8 py-3.5 text-[11px] uppercase tracking-[0.22em] font-semibold border border-white/15 hover:border-[#C8A96A] text-[#F5F1E8] hover:text-[#C8A96A] rounded-xs transition-colors cursor-pointer"
            >
              View Full Collection →
            </button>
          </div>
        </section>
      </FadeInSection>

      {/* 3. Brand Story Section */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20 lg:py-28 border-t border-white/8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <div className="bg-[#141416] border border-white/8 rounded-xs overflow-hidden">
                <img
                  src={brandStoryImg}
                  alt="Machined aluminum stand, woven aramid case, and matte cable detail on dark stone surface"
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#C8A96A]">
                Our Standard
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F5F1E8] leading-snug text-balance">
                Restraint in design. Provenance in every shipment.
              </h2>
              <p className="text-sm sm:text-base text-[#A8A297] leading-relaxed max-w-xl">
                Every VANTÉRA accessory is individually inspected prior to dispatch for machining tolerances, connector integrity, and sustained thermal stability. Rather than flooding catalogs with disposable plastic, we stock hardware built to sit quietly on your desk and endure years of travel across Nigeria and beyond.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#C8A96A] hover:underline cursor-pointer"
                >
                  Read Our Philosophy →
                </button>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 4. Customer Reviews Section (Real Reviews Only) */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20 lg:py-28 border-t border-white/8 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[#C8A96A]">
                Client Feedback
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#F5F1E8]">
                Verified Client Reviews
              </h2>
            </div>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  setIsReviewFormOpen(!isReviewFormOpen);
                  setReviewStatus('idle');
                  setReviewError('');
                }}
                className="px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] border border-white/15 hover:border-[#C8A96A] text-[#F5F1E8] hover:text-[#C8A96A] rounded-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                {isReviewFormOpen ? 'Close Form' : 'Write a Review'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/account?mode=login')}
                className="text-[11px] uppercase tracking-[0.2em] text-[#C8A96A] hover:underline cursor-pointer self-start sm:self-auto"
              >
                Sign in to share feedback →
              </button>
            )}
          </div>

          {reviewStatus === 'success' && (
            <div className="p-4 bg-[#0F2E22] border border-[#2E9B6B]/40 text-xs text-[#F5F1E8] rounded-xs">
              Thank you — your review has been published.
            </div>
          )}

          {isReviewFormOpen && user && (
            <form
              onSubmit={handleReviewSubmit}
              className="bg-[#141416] border border-white/10 p-6 sm:p-8 rounded-xs space-y-4 max-w-2xl"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-editorial text-xl text-[#F5F1E8]">Share Your Experience</h3>
                <div className="flex items-center gap-1.5" role="group" aria-label="Star rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      aria-label={`${star} stars`}
                      className={`text-lg cursor-pointer ${
                        star <= reviewRating ? 'text-[#C8A96A]' : 'text-white/20'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {reviewError && (
                <p className="text-xs text-[#E57373]">{reviewError}</p>
              )}

              <div>
                <label htmlFor="review-title" className="block text-[10px] uppercase tracking-[0.18em] text-[#A8A297] mb-1.5">
                  Headline (optional)
                </label>
                <input
                  id="review-title"
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Summary of your order experience"
                  className="w-full bg-[#0B0B0C] border border-white/12 px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C8A96A] focus:outline-hidden rounded-xs"
                />
              </div>

              <div>
                <label htmlFor="review-comment" className="block text-[10px] uppercase tracking-[0.18em] text-[#A8A297] mb-1.5">
                  Review *
                </label>
                <textarea
                  id="review-comment"
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share honest impressions on build quality, delivery speed, and daily performance..."
                  className="w-full bg-[#0B0B0C] border border-white/12 px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C8A96A] focus:outline-hidden rounded-xs"
                />
              </div>

              <button
                type="submit"
                disabled={reviewStatus === 'submitting' || reviewComment.trim().length < 5}
                className="gold-gradient-bg px-6 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer disabled:opacity-40"
              >
                {reviewStatus === 'submitting' ? 'Publishing...' : 'Publish Review'}
              </button>
            </form>
          )}

          {reviewsLoaded && reviews.length === 0 ? (
            <div className="bg-[#141416] border border-white/8 p-10 sm:p-12 rounded-xs text-center space-y-2">
              <p className="font-editorial text-xl text-[#F5F1E8]">No client reviews published yet.</p>
              <p className="text-xs text-[#A8A297] max-w-md mx-auto leading-relaxed">
                We only display authentic feedback submitted by registered VANTÉRA clients — never fabricated quotes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {reviews.slice(0, 6).map((rev) => (
                <article
                  key={rev.id}
                  className="bg-[#141416] border border-white/8 p-6 sm:p-8 rounded-xs flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="text-xs tracking-[0.15em] text-[#C8A96A]" aria-label={`${rev.rating} out of 5 stars`}>
                      {'★'.repeat(Math.max(1, Math.min(5, rev.rating)))}
                    </div>
                    {rev.title && (
                      <h3 className="font-editorial text-lg text-[#F5F1E8]">{rev.title}</h3>
                    )}
                    <p className="text-sm text-[#A8A297] leading-relaxed">"{rev.comment}"</p>
                  </div>

                  <div className="pt-4 border-t border-white/6 flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                    <span className="text-[#F5F1E8] font-medium">{rev.authorName}</span>
                    {rev.verifiedBuyer && (
                      <span className="text-[#C8A96A]">Verified Buyer</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </FadeInSection>

      {/* 5. Minimal Service Standards */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 border-t border-white/8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96A]">Settlement</p>
              <h3 className="font-editorial text-xl text-[#F5F1E8]">Verified NGN & USD Checkout</h3>
              <p className="text-sm text-[#A8A297] leading-relaxed">
                Webhook-verified online card settlement and direct GTBank transfer verification.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96A]">Fulfillment</p>
              <h3 className="font-editorial text-xl text-[#F5F1E8]">Nationwide & Global Dispatch</h3>
              <p className="text-sm text-[#A8A297] leading-relaxed">
                1–2 business days in Lagos, state-calculated delivery nationwide, free above ₦75,000 ($50).
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C8A96A]">Protection</p>
              <h3 className="font-editorial text-xl text-[#F5F1E8]">14-Day Return Window</h3>
              <p className="text-sm text-[#A8A297] leading-relaxed">
                Self-service tracking, saved Nigerian addresses, and return requests inside your account.
              </p>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* Quick View Modal */}
      <TechSpecsModal
        product={quickViewProduct}
        isOpen={Boolean(quickViewProduct)}
        onClose={() => setQuickViewProduct(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
};
