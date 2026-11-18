import React, { useEffect, useRef, useState } from 'react';

interface LuxuryImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  wrapperClassName?: string;
}

export const LuxuryImage: React.FC<LuxuryImageProps> = ({
  src,
  fallbackSrc = '/products/charging-phone-stand.jpg',
  alt,
  className = '',
  wrapperClassName = '',
  loading = 'lazy',
  referrerPolicy = 'no-referrer',
  ...rest
}) => {
  const targetSrc = src || fallbackSrc;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const prevTargetRef = useRef<string>(targetSrc);
  const [currentSrc, setCurrentSrc] = useState<string>(targetSrc);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (prevTargetRef.current !== targetSrc) {
      prevTargetRef.current = targetSrc;
      setCurrentSrc(targetSrc);
      setLoaded(false);
    }
  }, [targetSrc]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [currentSrc]);

  return (
    <div className={`relative overflow-hidden ${wrapperClassName}`}>
      {!loaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 vantera-shimmer pointer-events-none"
        />
      )}
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy={referrerPolicy}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
            setLoaded(false);
          } else {
            setLoaded(true);
          }
        }}
        className={`${className} transition-opacity duration-500 ease-out ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...rest}
      />
    </div>
  );
};
