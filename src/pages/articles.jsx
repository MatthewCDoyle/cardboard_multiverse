import React, { useState } from 'react';
import Layout from '@theme/Layout';
import { Calendar, Clock, Tag, TrendingUp, Search, Mail } from 'lucide-react';
import styles from './articlesStyles.module.css';

// Article Categories
const CATEGORIES = [
  { id: 'all', name: 'All Articles', color: '#6f2dbd' },
  { id: 'market-trends', name: 'Market Trends', color: '#5a189a' },
  { id: 'player-analysis', name: 'Player Analysis', color: '#b185db' },
  { id: 'investment-tips', name: 'Investment Tips', color: '#7b2cbf' },
  { id: 'industry-news', name: 'Industry News', color: '#4a4e69' },
  { id: 'collecting-tips', name: 'Collecting Tips', color: '#9d4edd' },
];

// Sample Articles Data
// Placeholder articles now follow the MDX frontmatter schema
const ARTICLES = [
  {
    id: 101,
    title: 'Fresh eBay Inventory',
    subtitle: 'Fresh eBay Inventory',
    excerpt: 'Browse active listings from Cardboard Multiverse with pricing, bids, and direct links to each eBay item.',
    featured: true,
    imageUrl: 'https://via.placeholder.com/800x400/1e293b/60a5fa?text=Fresh+eBay+Inventory',
    views: 0,
    author: 'Cardboard Multiverse',
    publishDate: '2024-02-24',
    readTime: '1 min read',
    category: 'market-trends',
    tags: ['eBay', 'Inventory', 'Listings']
  },
  {
    id: 102,
    title: 'Collector Resources',
    subtitle: 'Collector Resources',
    excerpt: 'Use practical guides, templates, and articles focused on grading, valuation, and building stronger collections.',
    featured: true,
    imageUrl: 'https://via.placeholder.com/800x400/1e293b/8b5cf6?text=Collector+Resources',
    views: 0,
    author: 'Cardboard Multiverse',
    publishDate: '2024-02-24',
    readTime: '1 min read',
    category: 'collecting-tips',
    tags: ['Resources', 'Guides', 'Templates']
  },
  {
    id: 103,
    title: 'Market-Focused Tracking',
    subtitle: 'Market-Focused Tracking',
    excerpt: 'Follow trends and top sellers across major sports with tools built for card collectors and flippers.',
    featured: true,
    imageUrl: 'https://via.placeholder.com/800x400/1e293b/f59e0b?text=Market+Tracking',
    views: 0,
    author: 'Cardboard Multiverse',
    publishDate: '2024-02-24',
    readTime: '1 min read',
    category: 'market-trends',
    tags: ['Market', 'Tracking', 'Tools']
  },
  {
    title: 'How to Build a Championship Card Collection on a Budget',
    slug: 'how-to-build-a-championship-card-collection-on-a-budget',
    description: 'Smart strategies for collecting high-quality cards without breaking the bank.',
    contentType: 'collecting-tips',
    part: 'Collecting Tips',
    chapter: 'Championship Collection',
    chapterNumber: 7,
    sport: ['All'],
    topics: ['budget', 'strategy', 'beginners'],
    audience: 'all',
    status: 'published',
    author: 'Mike Thompson',
    publishDate: '2024-02-04',
    readTime: '10 min read',
    category: 'collecting-tips',
    tags: ['Budget', 'Strategy', 'Beginners'],
    views: 1543,
    imageUrl: 'https://via.placeholder.com/800x400/1e293b/3b82f6?text=Budget+Collecting'
  },
  {
    id: 8,
    title: 'January 2024 Newsletter: Top Sales & Market Insights',
    slug: 'january-2024-newsletter-top-sales-market-insights',
    description: 'Review of January\'s biggest auctions, price movements, and what to expect in February.',
    contentType: 'newsletter',
    part: 'Market Trends',
    chapter: 'January Recap',
    chapterNumber: 8,
    sport: ['All'],
    topics: ['newsletter', 'recap', 'sales'],
    audience: 'all',
    status: 'published',
    author: 'Sarah Chen',
    publishDate: '2024-01-31',
    readTime: '8 min read',
    category: 'market-trends',
    tags: ['Newsletter', 'Monthly Recap', 'Sales'],
    views: 1987,
    imageUrl: 'https://via.placeholder.com/800x400/1e293b/10b981?text=January+Recap'
  },
];

export default function ArticlesPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter articles
  const filteredArticles = ARTICLES.filter(article => {
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory;
    const matchesSearch = 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const featuredArticles = ARTICLES.filter(a => a.featured).slice(0, 4);
  const latestArticles = filteredArticles.slice(0, 6);

  const getCategoryColor = (categoryId) => {
    return CATEGORIES.find(cat => cat.id === categoryId)?.color || '#6f2dbd';
  };

  return (
    <Layout
      title="Articles & Newsletter"
      description="Expert insights, market analysis, and collecting tips from industry professionals"
    >
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Articles & Newsletter</h1>
          <p className={styles.heroSubtitle}>
            Expert insights, market analysis, and the latest trends in sports card collecting
          </p>
          
          {/* Newsletter Signup */}
          <div className={styles.newsletterBox}>
            <Mail size={24} className={styles.newsletterIcon} />
            <div className={styles.newsletterContent}>
              <h3 className={styles.newsletterTitle}>Subscribe to Our Newsletter</h3>
              <p className={styles.newsletterText}>Get weekly market updates and exclusive insights</p>
            </div>
            <button className={styles.newsletterButton}>Subscribe</button>
          </div>

          {/* Search Bar */}
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search articles by title, topic, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* Featured Articles */}
        {searchQuery === '' && selectedCategory === 'all' && featuredArticles.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <TrendingUp size={24} />
              Featured Articles
            </h2>
            <div className={styles.featuredGrid}>
              {featuredArticles.map(article => (
                <article key={article.id} className={styles.featuredCard}>
                  <div 
                    className={styles.featuredImage}
                    style={{ backgroundImage: `url(${article.imageUrl})` }}
                  >
                    <div className={styles.featuredBadge}>⭐ Featured</div>
                  </div>
                  <div className={styles.featuredContent}>
                    <div 
                      className={styles.categoryBadge}
                      style={{ backgroundColor: getCategoryColor(article.category) }}
                    >
                      {CATEGORIES.find(c => c.id === article.category)?.name}
                    </div>
                    <h3 className={styles.featuredTitle}>{article.title}</h3>
                    <p className={styles.featuredExcerpt}>{article.excerpt}</p>
                    <div className={styles.articleMeta}>
                      <div className={styles.metaItem}>
                        <Calendar size={14} />
                        {new Date(article.publishDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </div>
                      <div className={styles.metaItem}>
                        <Clock size={14} />
                        {article.readTime}
                      </div>
                      <div className={styles.metaItem}>
                        {article.views.toLocaleString()} views
                      </div>
                    </div>
                    <a href={`/articles/${article.id}`} className={styles.readMoreButton}>
                      Read Full Article
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Category Filter */}
        <section className={styles.section}>
          <div className={styles.categoryFilter}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`${styles.categoryButton} ${selectedCategory === cat.id ? styles.categoryActive : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
                style={selectedCategory === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </section>

        {/* Articles Grid */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Latest Articles
            <span className={styles.resultCount}>({filteredArticles.length} articles)</span>
          </h2>
          
          {filteredArticles.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No articles found matching your search.</p>
              <button 
                className={styles.clearButton}
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className={styles.articlesGrid}>
              {filteredArticles.map(article => (
                <article key={article.id} className={styles.articleCard}>
                  <div 
                    className={styles.articleImage}
                    style={{ backgroundImage: `url(${article.imageUrl})` }}
                  >
                    <div 
                      className={styles.categoryBadge}
                      style={{ backgroundColor: getCategoryColor(article.category) }}
                    >
                      {CATEGORIES.find(c => c.id === article.category)?.name}
                    </div>
                  </div>
                  <div className={styles.articleContent}>
                    <h3 className={styles.articleTitle}>
                      <a href={`/articles/${article.id}`}>{article.title}</a>
                    </h3>
                    <p className={styles.articleExcerpt}>{article.excerpt}</p>
                    <div className={styles.articleTags}>
                      {article.tags.slice(0, 3).map(tag => (
                        <span key={tag} className={styles.tag}>
                          <Tag size={12} />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className={styles.articleFooter}>
                      <div className={styles.articleAuthor}>
                        <div className={styles.authorAvatar}>
                          {article.author.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className={styles.authorInfo}>
                          <div className={styles.authorName}>{article.author}</div>
                          <div className={styles.articleMeta}>
                            <span className={styles.metaItem}>
                              <Calendar size={12} />
                              {new Date(article.publishDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </span>
                            <span className={styles.metaItem}>
                              <Clock size={12} />
                              {article.readTime}
                            </span>
                          </div>
                        </div>
                      </div>
                      <a href={`/articles/${article.id}`} className={styles.readButton}>
                        Read →
                      </a>
                      <a href={`/articles/${article.id}`} className={styles.cardActionButton}>
                        Go to Page
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Newsletter Archive CTA */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaContent}>
            <Mail size={48} className={styles.ctaIcon} />
            <h2 className={styles.ctaTitle}>Never Miss an Update</h2>
            <p className={styles.ctaDescription}>
              Join 10,000+ collectors getting weekly market insights, investment tips, and exclusive content
            </p>
            <div className={styles.ctaButtons}>
              <button className={styles.primaryButton}>
                Subscribe to Newsletter
              </button>
              <a href="/newsletter-archive" className={styles.secondaryButton}>
                View Archive
              </a>
            </div>
            <p className={styles.ctaNote}>
              📧 Weekly newsletter • 🎁 Subscriber-only deals • 🔒 Unsubscribe anytime
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
