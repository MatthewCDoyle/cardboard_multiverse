import React, { useState } from 'react';
import Layout from '@theme/Layout';
import { Calendar, Clock, Tag, TrendingUp, Search, Mail } from 'lucide-react';
import styles from './articlesStyles.module.css';

const CATEGORY_COLORS = ['#6f2dbd', '#5a189a', '#b185db', '#7b2cbf', '#4a4e69', '#9d4edd'];

const toCategoryName = (categoryId) => {
  if (!categoryId) {
    return 'Uncategorized';
  }

  return categoryId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const docsArticlesContext = require.context(
  '@generated/docusaurus-plugin-content-docs/default',
  false,
  /^\.\/site-docs-articles-.*\.json$/,
);

const ARTICLES = docsArticlesContext
  .keys()
  .map((key) => {
    const metadata = docsArticlesContext(key);
    const frontMatter = metadata.frontMatter || {};
    const normalizedCategory = (frontMatter.category || frontMatter.contentType || 'uncategorized').toLowerCase();
    const metadataTags = Array.isArray(metadata.tags) ? metadata.tags.map((tag) => tag.label) : [];
    const tags = Array.isArray(frontMatter.tags) ? frontMatter.tags : metadataTags;
    const publishDate = frontMatter.publishDate || frontMatter.lastUpdated || null;
    const readTime = frontMatter.readTime || frontMatter.estimatedReadTime || '5 min read';

    return {
      id: metadata.id,
      title: metadata.title,
      excerpt: metadata.description || frontMatter.description || '',
      featured: Boolean(frontMatter.featured),
      imageUrl: frontMatter.imageUrl || 'https://via.placeholder.com/800x400/1e293b/60a5fa?text=Cardboard+Multiverse',
      views: Number(frontMatter.views) || 0,
      author: frontMatter.author || 'Cardboard Multiverse',
      publishDate,
      readTime,
      category: normalizedCategory,
      tags,
      permalink: metadata.permalink,
    };
  })
  .sort((a, b) => {
    const aDate = a.publishDate ? Date.parse(a.publishDate) : 0;
    const bDate = b.publishDate ? Date.parse(b.publishDate) : 0;

    if (aDate !== bDate) {
      return bDate - aDate;
    }

    return b.views - a.views;
  });

const categoriesFromArticles = Array.from(new Set(ARTICLES.map((article) => article.category))).map(
  (categoryId, index) => ({
    id: categoryId,
    name: toCategoryName(categoryId),
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }),
);

const CATEGORIES = [{ id: 'all', name: 'All Articles', color: '#6f2dbd' }, ...categoriesFromArticles];

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

  const explicitFeatured = ARTICLES.filter((article) => article.featured);
  const featuredArticles = (explicitFeatured.length > 0 ? explicitFeatured : ARTICLES).slice(0, 4);

  const getCategoryColor = (categoryId) => {
    return CATEGORIES.find(cat => cat.id === categoryId)?.color || '#6f2dbd';
  };

  const formatArticleDate = (dateValue, options) => {
    if (!dateValue) {
      return 'Date TBD';
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return 'Date TBD';
    }

    return parsedDate.toLocaleDateString('en-US', options);
  };

  return (
    <Layout
      title="Articles & Newsletters"
      description="Expert insights, market analysis, and collecting tips from industry professionals"
    >
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>Articles & Newsletters</h1>
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
                        {formatArticleDate(article.publishDate, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
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
                    <a href={article.permalink} className={styles.readMoreButton}>
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
                      <a href={article.permalink}>{article.title}</a>
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
                              {formatArticleDate(article.publishDate, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className={styles.metaItem}>
                              <Clock size={12} />
                              {article.readTime}
                            </span>
                          </div>
                        </div>
                      </div>
                      <a href={article.permalink} className={styles.readButton}>
                        Read →
                      </a>
                      <a href={article.permalink} className={styles.cardActionButton}>
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
