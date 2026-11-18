import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { Product } from '../data/catalog.ts';
import { CURATED_CATEGORIES, CuratedCategoryId, mapLegacyCategoryToCurated } from '../lib/curatedCjCatalog.ts';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard.tsx';
import { TechSpecsModal } from '../components/TechSpecsModal.tsx';
import { FadeInSection } from '../components/FadeInSection.tsx';
import { LuxuryImage } from '../components/LuxuryImage.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { safeFetchJson } from '../lib/safeFetch.ts';

import heroShowcaseWebp from '../assets/images/hero_luxury_atelier_1795007780389.webp';
import lifestyleBandWebp from '../assets/images/lifestyle_band_studio_1795007780689.webp';
import brandStoryWebp from '../assets/images/brand_story_craft_1794563897087.webp';
import catTechWebp from '../assets/images/cat_tech_accessories_1795007779939.webp';
import catSmartHomeWebp from '../assets/images/cat_smart_home_1795007781074.webp';
import catWorkspaceWebp from '../assets/images/cat_laptop_workspace_1795007781582.webp';
import catLifestyleWebp from '../assets/images/cat_lifestyle_gadgets_1795007781671.webp';
import catEverydayWebp from '../assets/images/cat_everyday_carry_1795007783182.webp';

interface HomeProps {
  products: Product[];
  isLoading?: boolean;
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

const CATEGORY_TILES: Array<{
  id: CuratedCategoryId;
  title: string;
  subtitle: string;
  image: string;
}> = [
  {
    id: 'premium-tech-accessories',
    title: 'Premium Tech Accessories',
    subtitle: 'Charging docks, aramid cases & braided cables',
    image: catTechWebp,
  },
  {
    id: 'smart-home-technology',
    title: 'Smart Home Technology',
    subtitle: 'Ambient lighting & acoustic desk objects',
    image: catSmartHomeWebp,
  },
  {
    id: 'laptop-workspace',
    title: 'Laptop & Workstation Accessories',
    subtitle: 'Machined risers, hubs & wireless keyboards',
    image: catWorkspaceWebp,
  },
  {
    id: 'trending-lifestyle-gadgets',
    title: 'Trending Lifestyle Gadgets',
    subtitle: 'Portable cinema & precision travel gear',
    image: catLifestyleWebp,
  },
  {
    id: 'premium-everyday-accessories',
    title: 'Premium Everyday Accessories',
    subtitle: 'Slim wallets, organizers & daily carry',
    image: catEverydayWebp,
  },
];

export const Home: React.FC<HomeProps> = ({ products, isLoading = false, onNavigate }) => {
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

  // Passive GPU parallax on hero & lifestyle bands (zero React re-renders, disabled under reduced motion)
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const bandSectionRef = useRef<HTMLElement | null>(null);
  const bandImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const video = heroVideoRef.current;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cleanupVideoListeners: (() => void) | undefined;
    if (video) {
      video.defaultMuted = true;
      video.muted = true;
      video.playsInline = true;
      if (prefersReduced) {
        video.pause();
      } else {
        const attemptPlay = () => {
          video.play().catch(() => {});
        };
        attemptPlay();
        video.addEventListener('loadeddata', attemptPlay);
        video.addEventListener('canplay', attemptPlay);
        cleanupVideoListeners = () => {
          video.removeEventListener('loadeddata', attemptPlay);
          video.removeEventListener('canplay', attemptPlay);
        };
      }
    }

    if (prefersReduced) {
      return () => {
        cleanupVideoListeners?.();
      };
    }

    let rafId = 0;
    const updateParallax = () => {
      rafId = 0;
      if (bandSectionRef.current && bandImgRef.current) {
        const rect = bandSectionRef.current.getBoundingClientRect();
        const vh = window.innerHeight;
        if (rect.top < vh && rect.bottom > 0) {
          const progress = (vh - rect.top) / (vh + rect.height) - 0.5;
          const offset = Math.round(progress * 44);
          bandImgRef.current.style.transform = `translate3d(0, ${offset}px, 0) scale(1.08)`;
        }
      }
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateParallax);
      }
    };

    updateParallax();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cleanupVideoListeners?.();
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

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
    <div className="bg-[#F7F3EC] text-[#111111]">
      {/* 1. Cinematic Hero — exact 1920:1004 framing so 100% of the video and copy stay in view */}
      <section className="relative w-full bg-[#0B0B0B] overflow-hidden">
        <div className="relative w-full aspect-[1920/1004] lg:max-h-[calc(100svh-68px)] bg-[#0B0B0B] overflow-hidden">
          <video
            ref={heroVideoRef}
            src="/assets/aistudio/hero-showcase-faststart.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={heroShowcaseWebp}
            aria-label="VANTÉRA flagship tech showcase film"
            className="absolute inset-0 w-full h-full object-contain object-center"
          />
          <div
            aria-hidden="true"
            className="hidden lg:block pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/92 via-[#0B0B0B]/35 to-transparent"
          />
          <div
            aria-hidden="true"
            className="hidden lg:block pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0B0B]/85 via-[#0B0B0B]/35 to-transparent"
          />
        </div>

        <div className="relative lg:absolute lg:inset-x-0 lg:bottom-0 z-10 max-w-7xl mx-auto w-full px-5 sm:px-8 lg:px-12 pt-6 pb-10 sm:pt-8 sm:pb-12 lg:pt-8 lg:pb-12 xl:pb-16">
          <div className="max-w-xl lg:max-w-2xl space-y-3 sm:space-y-4">
            <p
              className="hero-line-reveal text-[11px] font-medium uppercase tracking-[0.28em] text-[#B89B5E]"
              style={{ animationDelay: '60ms' }}
            >
              VANTÉRA · Worldwide
            </p>
            <h1
              className="font-editorial font-medium text-[#F7F3EC] leading-[1.06] tracking-tight"
              style={{ fontSize: 'clamp(1.9rem, 3.8vw, 3.85rem)' }}
            >
              <span className="hero-line-reveal block sm:whitespace-nowrap" style={{ animationDelay: '160ms' }}>
                Precision objects for
              </span>
              <span className="hero-line-reveal block sm:whitespace-nowrap" style={{ animationDelay: '280ms' }}>
                <em className="italic font-normal text-[#F7F3EC]">modern</em> daily carry.
              </span>
            </h1>
            <p
              className="hero-line-reveal text-sm sm:text-base text-[#EAE3D5]/90 font-light leading-relaxed max-w-md"
              style={{ animationDelay: '400ms' }}
            >
              Architectural charging stations and refined desk hardware calibrated for quiet reliability.
            </p>
            <div className="hero-line-reveal pt-1 sm:pt-2" style={{ animationDelay: '520ms' }}>
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="gold-gradient-bg px-8 py-4 min-h-[48px] text-[11px] uppercase tracking-[0.22em] font-semibold rounded-xs cursor-pointer inline-flex items-center gap-3"
              >
                <span>Shop Collection</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Five Curated Category Tiles as Large Editorial Panels */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20 lg:py-28 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#111111]/10 pb-8">
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7A6230]">
                Curated Worlds
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#111111]">
                Objects by <em className="italic font-normal">discipline</em>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/shop')}
              className="text-[11px] uppercase tracking-[0.2em] text-[#111111] hover:text-[#7A6230] border-b border-[#B89B5E] pb-1 self-start md:self-auto cursor-pointer"
            >
              View All Categories
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5 lg:gap-6">
            {CATEGORY_TILES.map((tile, idx) => {
              const spanClass = idx < 2 ? 'md:col-span-3' : 'md:col-span-2';
              return (
                <a
                  key={tile.id}
                  href={`/category/${tile.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(`/category/${tile.id}`);
                  }}
                  className={`${spanClass} group relative aspect-[4/3] overflow-hidden bg-[#EFEAE0] border border-[#111111]/10 rounded-xs block cursor-pointer`}
                >
                  <LuxuryImage
                    src={tile.image}
                    alt={tile.title}
                    wrapperClassName="w-full h-full"
                    className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                    loading="lazy"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#111111]/82 via-[#111111]/20 to-transparent transition-opacity duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7 flex items-end justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-editorial text-xl sm:text-2xl font-medium text-[#F7F3EC] leading-snug">
                        {tile.title}
                      </h3>
                      <p className="text-xs text-[#E3DDD1] font-light">{tile.subtitle}</p>
                    </div>
                    <span className="w-9 h-9 rounded-full border border-[#F7F3EC]/30 group-hover:border-[#B89B5E] group-hover:bg-[#B89B5E] text-[#F7F3EC] group-hover:text-[#111111] inline-flex items-center justify-center shrink-0 transition-colors">
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      </FadeInSection>

      {/* 3. Featured Products Collection */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pb-20 lg:pb-28 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-t border-[#111111]/10 pt-16 lg:pt-20">
            <div className="space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7A6230]">
                Selected Pieces
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#111111]">
                The Core <em className="italic font-normal">Collection</em>
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
                  className={`px-4 py-2 min-h-[40px] text-[11px] uppercase tracking-[0.16em] rounded-xs transition-colors cursor-pointer whitespace-nowrap ${
                    curationTab === tab.id
                      ? 'bg-[#111111] text-[#F7F3EC] font-medium'
                      : 'bg-[#FAF7F2] text-[#5C574E] border border-[#111111]/12 hover:border-[#B89B5E] hover:text-[#111111]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {isLoading && products.length === 0 ? (
              Array.from({ length: 3 }).map((_, idx) => <ProductCardSkeleton key={idx} />)
            ) : curatedFinds.length === 0 ? (
              <div className="col-span-full border border-[#111111]/10 bg-[#FAF7F2] p-10 text-center space-y-3 rounded-xs">
                <p className="text-sm text-[#5C574E]">
                  No pieces currently match this filter.
                </p>
                <button
                  type="button"
                  onClick={() => setCurationTab('all')}
                  className="text-[11px] uppercase tracking-[0.2em] text-[#7A6230] underline cursor-pointer"
                >
                  Show All Finds
                </button>
              </div>
            ) : (
              curatedFinds.map((product, idx) => (
                <FadeInSection key={product.id} delayMs={Math.min(idx * 80, 320)}>
                  <ProductCard
                    product={product}
                    onNavigate={onNavigate}
                    onQuickView={(p) => setQuickViewProduct(p)}
                  />
                </FadeInSection>
              ))
            )}
          </div>

          <div className="flex justify-center pt-4">
            <button
              type="button"
              onClick={() => onNavigate('/shop')}
              className="px-8 py-3.5 min-h-[48px] text-[11px] uppercase tracking-[0.22em] font-semibold border border-[#111111]/20 hover:border-[#B89B5E] text-[#111111] hover:text-[#7A6230] rounded-xs transition-colors cursor-pointer"
            >
              View Full Collection →
            </button>
          </div>
        </section>
      </FadeInSection>

      {/* 4. Full-Width Lifestyle Editorial Image Band */}
      <section
        ref={bandSectionRef}
        className="relative w-full min-h-[54vh] sm:min-h-[62vh] flex items-center overflow-hidden bg-[#1B1B1B]"
      >
        <img
          ref={bandImgRef}
          src={lifestyleBandWebp}
          alt="Minimal architectural workspace on warm travertine stone and oatmeal linen in golden light"
          className="absolute inset-0 w-full h-full object-cover object-center will-change-transform scale-105"
          loading="lazy"
          decoding="async"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#111111]/45"
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 text-center space-y-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#B89B5E] font-semibold">
            Quiet Architecture
          </p>
          <p className="font-editorial text-2xl sm:text-4xl lg:text-5xl text-[#F7F3EC] font-medium leading-tight">
            Crafted for <em className="italic font-normal">quiet focus</em> — at your desk and in motion.
          </p>
        </div>
      </section>

      {/* 5. Brand Story Section */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <div className="bg-[#EFEAE0] border border-[#111111]/10 rounded-xs overflow-hidden">
                <LuxuryImage
                  src={brandStoryWebp}
                  alt="Machined aluminum stand, woven aramid case, and matte cable detail"
                  wrapperClassName="w-full aspect-[4/3]"
                  className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-700 ease-out"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="lg:col-span-6 space-y-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7A6230]">
                Our Standard
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#111111] leading-snug text-balance">
                Restraint in design. Provenance in <em className="italic font-normal">every</em> shipment.
              </h2>
              <p className="text-sm sm:text-base text-[#5C574E] font-light leading-relaxed max-w-xl">
                Every VANTÉRA accessory is individually inspected prior to dispatch for machining tolerances, connector integrity, and sustained thermal stability. Rather than flooding catalogs with disposable plastic, we stock hardware built to sit quietly on your desk and endure years of travel across Nigeria and beyond.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#111111] hover:text-[#7A6230] border-b border-[#B89B5E] pb-1 cursor-pointer"
                >
                  Read Our Philosophy →
                </button>
              </div>
            </div>
          </div>
        </section>
      </FadeInSection>

      {/* 6. Real Customer Reviews Section */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-20 lg:py-24 border-t border-[#111111]/10 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7A6230]">
                Client Feedback
              </p>
              <h2 className="font-editorial text-3xl sm:text-4xl font-medium text-[#111111]">
                Verified Client <em className="italic font-normal">Reviews</em>
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
                className="px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] border border-[#111111]/20 hover:border-[#B89B5E] text-[#111111] hover:text-[#7A6230] rounded-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                {isReviewFormOpen ? 'Close Form' : 'Write a Review'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/account?mode=login')}
                className="text-[11px] uppercase tracking-[0.2em] text-[#111111] hover:text-[#7A6230] border-b border-[#B89B5E] pb-0.5 cursor-pointer self-start sm:self-auto"
              >
                Sign in to share feedback →
              </button>
            )}
          </div>

          {reviewStatus === 'success' && (
            <div className="p-4 bg-[#FAF7F2] border border-[#B89B5E] text-xs text-[#111111] rounded-xs">
              Thank you — your review has been published.
            </div>
          )}

          {isReviewFormOpen && user && (
            <form
              onSubmit={handleReviewSubmit}
              className="bg-[#FAF7F2] border border-[#111111]/12 p-6 sm:p-8 rounded-xs space-y-4 max-w-2xl"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-editorial text-xl text-[#111111]">Share Your Experience</h3>
                <div className="flex items-center gap-1" role="group" aria-label="Star rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      aria-label={`${star} stars`}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          star <= reviewRating ? 'text-[#B89B5E] fill-[#B89B5E]' : 'text-[#111111]/20'
                        }`}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {reviewError && <p className="text-xs text-[#8E3A3A]">{reviewError}</p>}

              <div>
                <label htmlFor="review-title" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
                  Headline (optional)
                </label>
                <input
                  id="review-title"
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Summary of your order experience"
                  className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-4 py-2.5 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
                />
              </div>

              <div>
                <label htmlFor="review-comment" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
                  Review *
                </label>
                <textarea
                  id="review-comment"
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share honest impressions on build quality, delivery speed, and daily performance..."
                  className="w-full bg-[#F7F3EC] border border-[#111111]/15 px-4 py-2.5 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
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
            <div className="bg-[#FAF7F2] border border-[#111111]/10 p-10 sm:p-12 rounded-xs text-center space-y-2">
              <p className="font-editorial text-xl text-[#111111]">No client reviews published yet.</p>
              <p className="text-xs text-[#5C574E] max-w-md mx-auto leading-relaxed">
                We only display authentic feedback submitted by registered VANTÉRA clients — never fabricated quotes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {reviews.slice(0, 6).map((rev) => (
                <article
                  key={rev.id}
                  className="bg-[#FAF7F2] border border-[#111111]/10 p-6 sm:p-8 rounded-xs flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-1" aria-label={`${rev.rating} out of 5 stars`}>
                      {Array.from({ length: Math.max(1, Math.min(5, rev.rating)) }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-[#B89B5E] fill-[#B89B5E]" strokeWidth={1.5} />
                      ))}
                    </div>
                    {rev.title && (
                      <h3 className="font-editorial text-lg text-[#111111]">{rev.title}</h3>
                    )}
                    <p className="text-sm text-[#5C574E] font-light leading-relaxed">"{rev.comment}"</p>
                  </div>

                  <div className="pt-4 border-t border-[#111111]/8 flex items-center justify-between text-[11px] uppercase tracking-[0.16em]">
                    <span className="text-[#111111] font-medium">{rev.authorName}</span>
                    {rev.verifiedBuyer && (
                      <span className="text-[#7A6230] font-medium">Verified Buyer</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </FadeInSection>

      {/* 7. Minimal Service Standards */}
      <FadeInSection>
        <section className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 border-t border-[#111111]/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">Settlement</p>
              <h3 className="font-editorial text-xl text-[#111111]">Verified NGN & USD Checkout</h3>
              <p className="text-sm text-[#5C574E] font-light leading-relaxed">
                Webhook-verified online card settlement and direct GTBank transfer verification.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">Fulfillment</p>
              <h3 className="font-editorial text-xl text-[#111111]">Worldwide Dispatch</h3>
              <p className="text-sm text-[#5C574E] font-light leading-relaxed">
                Tracked delivery worldwide with destination-calculated regional shipping, complimentary domestically above ₦75,000 ($50).
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">Protection</p>
              <h3 className="font-editorial text-xl text-[#111111]">14-Day Return Window</h3>
              <p className="text-sm text-[#5C574E] font-light leading-relaxed">
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
