import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Clock, DollarSign, Eye, Heart } from 'lucide-react';
import styles from './styles.module.css';

/**
 * eBay Store Carousel Component
 * Displays active auctions from your eBay store in an interactive carousel
 * 
 * Props:
 * - ebayUsername: Your eBay store username (required)
 * - storeUrl: Public URL for your eBay store (optional)
 * - itemsPerPage: Number of items to show at once (default: 3)
 * - autoRotate: Auto-rotate carousel (default: true)
 * - rotateInterval: Auto-rotate interval in ms (default: 5000)
 */

export default function EbayStoreCarousel({ 
  ebayUsername,
  storeUrl,
  itemsPerPage = 3,
  autoRotate = true,
  rotateInterval = 5000,
  categoryId = null
}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const resolvedStoreUrl = storeUrl || `https://www.ebay.com/usr/${ebayUsername}`;
  const unavailableMessage = 'Live eBay listings are temporarily unavailable. Browse the full store directly on eBay.';

  const dedupe = (values) => [...new Set(values.filter((value) => typeof value === 'string'))];

  const normalizeBaseUrl = (value) => (typeof value === 'string' && value.trim()
    ? value.trim().replace(/\/$/, '')
    : '');

  const getCodespaceRoot = (host) => (typeof host === 'string'
    ? host.replace(/-\d+\.app\.github\.dev$/, '')
    : '');

  const deriveCurrentProxyBaseUrl = () => {
    if (typeof window === 'undefined') {
      if (typeof process !== 'undefined' && process.env?.EBAY_PROXY_URL) {
        return normalizeBaseUrl(process.env.EBAY_PROXY_URL);
      }

      return 'http://localhost:8787';
    }

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8787';
    }

    if (window.location.hostname.endsWith('.app.github.dev')) {
      const forwardedHost = window.location.hostname.replace(/-\d+\.app\.github\.dev$/, '-8787.app.github.dev');
      return `${window.location.protocol}//${forwardedHost}`;
    }

    return '';
  };

  const canReuseSavedProxyBaseUrl = (value) => {
    const normalizedValue = normalizeBaseUrl(value);

    if (!normalizedValue || typeof window === 'undefined') {
      return false;
    }

    try {
      const parsed = new URL(normalizedValue);
      const savedHost = parsed.hostname;
      const currentHost = window.location.hostname;

      if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
        return savedHost === 'localhost' || savedHost === '127.0.0.1';
      }

      if (currentHost.endsWith('.app.github.dev')) {
        return savedHost.endsWith('.app.github.dev') && getCodespaceRoot(savedHost) === getCodespaceRoot(currentHost);
      }
    } catch {
      return false;
    }

    return false;
  };

  const resolveProxyBaseUrls = () => {
    const values = [];

    const derivedBaseUrl = deriveCurrentProxyBaseUrl();

    if (typeof window === 'undefined') {
      if (derivedBaseUrl) {
        values.push(derivedBaseUrl);
      }

      return dedupe(values);
    }

    if (derivedBaseUrl) {
      values.push(derivedBaseUrl);
    }

    if (canReuseSavedProxyBaseUrl(window.__EBAY_PROXY_URL__)) {
      values.push(normalizeBaseUrl(window.__EBAY_PROXY_URL__));
    }

    values.push('');

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      values.push('http://localhost:8787');
      return dedupe(values);
    }

    values.push('http://localhost:8787');
    return dedupe(values);
  };

  // Fetch active listings from your eBay store
  useEffect(() => {
    const fetchListings = async () => {
      if (!ebayUsername) {
        setError('eBay username is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const bases = resolveProxyBaseUrls();
        const attemptErrors = [];
        let loadedListings = null;

        for (const base of bases) {
          if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) {
            attemptErrors.push(`${base || 'same-origin'} blocked on HTTPS page`);
            continue;
          }

          const params = new URLSearchParams({ username: ebayUsername });
          if (categoryId) {
            params.set('categoryId', String(categoryId));
          }

          const url = `${base}/api/ebay-listings?${params.toString()}`;

          try {
            const response = await fetch(url, { credentials: 'include' });
            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            const body = isJson ? await response.json() : null;

            if (!isJson) {
              attemptErrors.push(`${url} returned non-JSON response`);
              continue;
            }

            if (!response.ok) {
              if (response.status === 401) {
                attemptErrors.push(`${url} responded with 401 (forwarded port requires auth/public visibility)`);
                continue;
              }

              attemptErrors.push(body?.error || `${url} responded with ${response.status}`);
              continue;
            }

            loadedListings = body?.listings || [];
            break;
          } catch (requestError) {
            attemptErrors.push(`${url} failed: ${requestError instanceof Error ? requestError.message : 'network error'}`);
          }
        }

        if (loadedListings === null) {
          console.warn('Unable to load eBay listings:', attemptErrors);
          setError(unavailableMessage);
          setListings([]);
        } else {
          setListings(loadedListings);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch eBay listings:', err instanceof Error ? err.message : err);
        setError(unavailableMessage);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [ebayUsername, categoryId]);

  // Auto-rotate carousel
  useEffect(() => {
    if (!autoRotate || isPaused || listings.length <= itemsPerPage) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => 
        prev + itemsPerPage >= listings.length ? 0 : prev + 1
      );
    }, rotateInterval);

    return () => clearInterval(interval);
  }, [autoRotate, isPaused, listings.length, itemsPerPage, rotateInterval]);

  const totalPages = Math.ceil(listings.length / itemsPerPage);
  const currentPage = Math.floor(currentIndex / itemsPerPage);

  const nextSlide = () => {
    setCurrentIndex(prev => 
      prev + itemsPerPage >= listings.length ? 0 : prev + itemsPerPage
    );
  };

  const prevSlide = () => {
    setCurrentIndex(prev => 
      prev === 0 ? Math.max(0, listings.length - itemsPerPage) : prev - itemsPerPage
    );
  };

  const goToPage = (pageIndex) => {
    setCurrentIndex(pageIndex * itemsPerPage);
  };

  const formatTimeLeft = (timeStr) => {
    if (!timeStr) return '';
    const end = new Date(timeStr);
    const now = new Date();
    const diffMs = end - now;
    if (diffMs <= 0) return 'Ended';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ${diffMins % 60}m`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ${diffHours % 24}h`;
  };

  const getHigherResEbayImageUrl = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return imageUrl;
    }

    // eBay CDN images commonly include size tokens like s-l225; request a larger variant.
    return imageUrl.replace(/\/s-l\d+\.(jpg|jpeg|png|webp)(\?.*)?$/i, '/s-l1600.$1$2');
  };

  if (loading) {
    return (
      <div className={styles.carouselContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading your eBay listings...</p>
        </div>
      </div>
    );
  }

  if (error && listings.length === 0) {
    return (
      <div className={styles.carouselContainer}>
        <div className={styles.errorState}>
          <p>Live feed temporarily unavailable</p>
          <p className={styles.errorMessage}>{error}</p>
          <a
            href={resolvedStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.storeLink}
          >
            Visit eBay Store <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className={styles.carouselContainer}>
        <div className={styles.emptyState}>
          <p>No active listings found</p>
          <a 
            href={resolvedStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.storeLink}
          >
            Visit eBay Store <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  const visibleListings = listings.slice(currentIndex, currentIndex + itemsPerPage);

  return (
    <div 
      className={styles.carouselContainer}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header */}
      <div className={styles.carouselHeader}>
        <div>
          <h2 className={styles.carouselTitle}>Live Auctions</h2>
          <p className={styles.carouselSubtitle}>
            {listings.length} active listing{listings.length !== 1 ? 's' : ''} from{' '}
            <a 
              href={resolvedStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.usernameLink}
            >
              {ebayUsername}
            </a>
          </p>
        </div>
        <a 
          href={resolvedStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.viewAllBtn}
        >
          View All <ExternalLink size={16} />
        </a>
      </div>

      {/* Carousel */}
      <div className={styles.carouselWrapper}>
        {/* Previous Button */}
        {listings.length > itemsPerPage && (
          <button 
            className={`${styles.navButton} ${styles.navButtonPrev}`}
            onClick={prevSlide}
            aria-label="Previous"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Cards Container */}
        <div className={styles.cardsContainer}>
          <div 
            className={styles.cardsTrack}
            style={{
              gridTemplateColumns: `repeat(${itemsPerPage}, 1fr)`
            }}
          >
            {visibleListings.map((listing, idx) => (
              <div key={currentIndex + idx} className={styles.card}>
                {/* Image */}
                <a 
                  href={listing.itemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.cardImageLink}
                >
                  <div className={styles.cardImage}>
                    <img 
                      src={getHigherResEbayImageUrl(listing.imageUrl)} 
                      alt={listing.title}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className={styles.imageOverlay}>
                      <span className={styles.viewDetailsBtn}>
                        View Details <ExternalLink size={14} />
                      </span>
                    </div>
                  </div>
                </a>

                {/* Content */}
                <div className={styles.cardContent}>
                  {/* Title */}
                  <a 
                    href={listing.itemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.cardTitle}
                  >
                    {listing.title}
                  </a>

                  {/* Stats */}
                  <div className={styles.cardStats}>
                    <div className={styles.stat}>
                      <DollarSign size={16} />
                      <span className={styles.price}>${listing.price.toFixed(2)}</span>
                    </div>
                    {listing.bids > 0 && (
                      <div className={styles.stat}>
                        <span className={styles.bids}>{listing.bids} bid{listing.bids !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Meta Info */}
                  <div className={styles.cardMeta}>
                    <div className={styles.metaItem}>
                      <Clock size={14} />
                      <span>{formatTimeLeft(listing.timeLeft)}</span>
                    </div>
                    {listing.watching && (
                      <div className={styles.metaItem}>
                        <Eye size={14} />
                        <span>{listing.watching}</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <a 
                    href={listing.itemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.bidButton}
                  >
                    {listing.bids > 0 ? 'Place Bid' : 'Buy Now'}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Button */}
        {listings.length > itemsPerPage && (
          <button 
            className={`${styles.navButton} ${styles.navButtonNext}`}
            onClick={nextSlide}
            aria-label="Next"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Pagination Dots */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              className={`${styles.paginationDot} ${currentPage === idx ? styles.active : ''}`}
              onClick={() => goToPage(idx)}
              aria-label={`Go to page ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Demo Notice */}
      {listings[0]?.imageUrl?.includes('placeholder') && (
        <div className={styles.demoNotice}>
          <p>
            📌 Demo Mode: Showing sample listings. Connect to eBay API to display your real auctions.
          </p>
        </div>
      )}
    </div>
  );
}
