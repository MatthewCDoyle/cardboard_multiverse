import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Clock, DollarSign, Eye, Heart } from 'lucide-react';
import styles from './styles.module.css';

/**
 * eBay Store Carousel Component
 * Displays active auctions from your eBay store in an interactive carousel
 * 
 * Props:
 * - ebayUsername: Your eBay store username (required)
 * - itemsPerPage: Number of items to show at once (default: 3)
 * - autoRotate: Auto-rotate carousel (default: true)
 * - rotateInterval: Auto-rotate interval in ms (default: 5000)
 */

export default function EbayStoreCarousel({ 
  ebayUsername,
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

  // Get API URL from window global or fallback
  const API_URL = (typeof window !== 'undefined' && window.__EBAY_PROXY_URL__) || 'http://localhost:3001';

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
        
        // Try to fetch from your backend API
        const response = await fetch(`${API_URL}/api/ebay-listings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: ebayUsername,
            categoryId: categoryId
          })
        });

        if (response.ok) {
          const data = await response.json();
          setListings(data.listings || []);
          setError(null);
        } else {
          // Fallback to demo data
          setListings(generateDemoListings(ebayUsername));
        }
      } catch (err) {
        console.log('Using demo data:', err.message);
        // Use demo data for demonstration
        setListings(generateDemoListings(ebayUsername));
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [ebayUsername, categoryId, API_URL]);

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

  // Generate demo listings for preview
  const generateDemoListings = (username) => {
    const demoItems = [
      {
        title: '2024 Topps Chrome Shohei Ohtani Base #1 PSA 10',
        price: 45.99,
        bids: 12,
        timeLeft: '2d 14h',
        imageUrl: 'https://via.placeholder.com/300x400/1e293b/60a5fa?text=Baseball+Card',
        itemUrl: `https://www.ebay.com/usr/${username}`,
        watching: 34
      },
      {
        title: '2023 Panini Prizm Victor Wembanyama Rookie RC Silver',
        price: 125.00,
        bids: 8,
        timeLeft: '1d 8h',
        imageUrl: 'https://via.placeholder.com/300x400/1e293b/10b981?text=Basketball+Card',
        itemUrl: `https://www.ebay.com/usr/${username}`,
        watching: 56
      },
      {
        title: 'Patrick Mahomes II 2017 Prizm Rookie Card #247',
        price: 299.99,
        bids: 23,
        timeLeft: '3d 2h',
        imageUrl: 'https://via.placeholder.com/300x400/1e293b/f59e0b?text=Football+Card',
        itemUrl: `https://www.ebay.com/usr/${username}`,
        watching: 89
      },
      {
        title: 'Mike Trout 2011 Topps Update Rookie Card #US175',
        price: 875.00,
        bids: 31,
        timeLeft: '4h 23m',
        imageUrl: 'https://via.placeholder.com/300x400/1e293b/ef4444?text=Baseball+Card',
        itemUrl: `https://www.ebay.com/usr/${username}`,
        watching: 127
      },
      {
        title: 'LeBron James 2003-04 Upper Deck Rookie Exclusives',
        price: 1250.00,
        bids: 45,
        timeLeft: '6h 15m',
        imageUrl: 'https://via.placeholder.com/300x400/1e293b/8b5cf6?text=Basketball+Card',
        itemUrl: `https://www.ebay.com/usr/${username}`,
        watching: 203
      },
      {
        title: 'Tom Brady 2000 Playoff Contenders Championship Ticket Auto',
        price: 3500.00,
        bids: 67,
        timeLeft: '12h 45m',
        imageUrl: 'https://via.placeholder.com/300x400/1e293b/06b6d4?text=Football+Card',
        itemUrl: `https://www.ebay.com/usr/${username}`,
        watching: 412
      }
    ];

    return demoItems;
  };

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
    // Parse time left string and return formatted version
    return timeStr;
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
          <p>Unable to load eBay listings</p>
          <p className={styles.errorMessage}>{error}</p>
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
            href={`https://www.ebay.com/usr/${ebayUsername}`}
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
              href={`https://www.ebay.com/usr/${ebayUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.usernameLink}
            >
              {ebayUsername}
            </a>
          </p>
        </div>
        <a 
          href={`https://www.ebay.com/usr/${ebayUsername}`}
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
                      src={listing.imageUrl} 
                      alt={listing.title}
                      loading="lazy"
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
