import React from 'react';
import Layout from '@theme/Layout';
import EbayStoreCarousel from '@site/src/components/EbayStoreCarousel';

export default function StorePage() {
  return (
    <Layout
      title="Our eBay Store"
      description="Shop our active auctions and buy-it-now listings"
    >
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #f7f8fa 0%, #ffffff 100%)',
        padding: '4rem 2rem',
        textAlign: 'center',
        color: '#191919',
        borderBottom: '1px solid #d9d9d9'
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          Our eBay Store
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#5c5f62', maxWidth: '600px', margin: '0 auto' }}>
          Browse our latest sports card auctions and find your next addition
        </p>
        <a
          href="https://www.ebay.com/usr/cardboardmult1verse"
          target="_blank"
          rel="noopener noreferrer"
          className="button button--lg"
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 2rem',
            background: 'rebeccapurple',
            color: 'white',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '1.1rem',
            textDecoration: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: 'none',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#7c3fa7'}
          onMouseOut={e => e.currentTarget.style.background = 'rebeccapurple'}
        >
          Visit Our eBay Store
        </a>
      </div>

      {/* Carousel Section */}
      <div style={{ padding: '2rem 0' }}>
        <EbayStoreCarousel 
          ebayUsername="cardboardmult1verse"
          itemsPerPage={3}
          autoRotate={true}
          rotateInterval={5000}
        />
      </div>

      {/* Additional Content */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 2rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem'
        }}>
          <div style={{
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '12px',
            boxShadow: 'var(--ifm-global-shadow-lw)',
            border: '1px solid #d9d9d9'
          }}>
            <h3>🎯 Best Prices</h3>
            <p>Competitive pricing on all sports cards with frequent auctions and buy-it-now options.</p>
          </div>
          
          <div style={{
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '12px',
            boxShadow: 'var(--ifm-global-shadow-lw)',
            border: '1px solid #d9d9d9'
          }}>
            <h3>📦 Fast Shipping</h3>
            <p>All cards shipped securely within 24 hours of payment in protective sleeves and toploaders.</p>
          </div>
          
          <div style={{
            padding: '2rem',
            background: 'var(--ifm-background-surface-color)',
            borderRadius: '12px',
            boxShadow: 'var(--ifm-global-shadow-lw)',
            border: '1px solid #d9d9d9'
          }}>
            <h3>⭐ Top Rated</h3>
            <p>100% positive feedback with thousands of satisfied customers. Buy with confidence.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
