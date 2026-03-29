import React, { useState } from 'react';
import Layout from '@theme/Layout';
import { Search, FileText, Download, BookOpen, Video, Package } from 'lucide-react';
import styles from './howToStyles.module.css';

// Guide Categories
const CATEGORIES = [
  { id: 'all', name: 'All Guides', icon: BookOpen },
  { id: 'grading', name: 'Grading', icon: FileText },
  { id: 'buying', name: 'Buying & Selling', icon: Package },
  { id: 'storage', name: 'Storage & Protection', icon: Package },
  { id: 'valuation', name: 'Valuation', icon: FileText },
];

// Article content types that are relevant to a how-to guides page
const INCLUDED_CONTENT_TYPES = new Set([
  'how-to', 'guide', 'reference', 'checklist',
  'decision-tool', 'collecting-tips', 'investment-tips', 'analysis',
  'industry-news',
]);

// Map contentType → how-to category
const CONTENT_TYPE_TO_HOWTO_CATEGORY = {
  'decision-tool': 'grading',
  'industry-news': 'grading',
  'how-to': 'buying',
  'guide': 'buying',
  'collecting-tips': 'buying',
  'investment-tips': 'valuation',
  'reference': 'valuation',
  'checklist': 'storage',
  'analysis': 'valuation',
};

// Per-article category overrides keyed by the last segment of the docs ID
const SLUG_CATEGORY_OVERRIDE = {
  'cm-article-shipping-cards': 'storage',
  'cm-article-suggested-supplies': 'storage',
  'cm-article-inventory-management': 'buying',
};

// Docs article IDs to pin as featured on the how-to page
const FEATURED_GUIDE_IDS = new Set([
  'articles/CardboardMultiverse_QuickStart',
  'articles/cm-article-grading-services',
  'articles/cm-article-determining-card-value-and-comps',
  'articles/cm-article-beware-of-rogue-tactics',
]);

const docsArticlesContext = require.context(
  '@generated/docusaurus-plugin-content-docs/default',
  false,
  /^\.\/site-docs-articles-.*\.json$/,
);

const GUIDES = docsArticlesContext
  .keys()
  .map((key) => {
    const metadata = docsArticlesContext(key);
    const frontMatter = metadata.frontMatter || {};
    const contentType = (frontMatter.contentType || '').toLowerCase();
    const isFeatured = FEATURED_GUIDE_IDS.has(metadata.id);

    if (!INCLUDED_CONTENT_TYPES.has(contentType) && !isFeatured) {
      return null;
    }

    const idSlug = metadata.id.split('/').pop();
    const category =
      SLUG_CATEGORY_OVERRIDE[idSlug] ||
      CONTENT_TYPE_TO_HOWTO_CATEGORY[contentType] ||
      'buying';

    return {
      id: metadata.id,
      title: metadata.title,
      description: metadata.description || frontMatter.description || '',
      category,
      type: 'article',
      readTime: frontMatter.readTime || frontMatter.estimatedReadTime || '5 min read',
      lastUpdated: frontMatter.lastUpdated || frontMatter.publishDate || null,
      views: Number(frontMatter.views) || 0,
      featured: isFeatured,
      permalink: metadata.permalink,
    };
  })
  .filter(Boolean)
  .sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.views - a.views;
  });

// Templates Data
const TEMPLATES = [
  {
    id: 1,
    title: 'Card Inventory Spreadsheet',
    description: 'Excel template for tracking your card collection with values, conditions, and locations.',
    fileType: 'xlsx',
    downloadUrl: '/templates/inventory-template.xlsx'
  },
  {
    id: 2,
    title: 'PSA Submission Form',
    description: 'Pre-filled PSA submission form template to speed up your grading submissions.',
    fileType: 'pdf',
    downloadUrl: '/templates/psa-form.pdf'
  },
  {
    id: 3,
    title: 'Sales Tracking Sheet',
    description: 'Track all your card sales, profits, and buyer information in one place.',
    fileType: 'xlsx',
    downloadUrl: '/templates/sales-tracker.xlsx'
  },
];

const formatLastUpdated = (dateValue) => {
  if (!dateValue) return 'Recently updated';
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return 'Recently updated';
  return `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

export default function HowToPage() {
    const getTypeBadgeClass = (type) => {
      switch(type) {
        case 'pdf': return styles.typeBadgePdf;
        case 'video': return styles.typeBadgeVideo;
        case 'article': return styles.typeBadgeArticle;
        default: return styles.typeBadgeArticle;
      }
    };
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter guides
  const filteredGuides = GUIDES.filter(guide => {
    const matchesCategory = selectedCategory === 'all' || guide.category === selectedCategory;
    const matchesSearch = guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         guide.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredGuides = GUIDES.filter(g => g.featured).slice(0, 1);

  const getTypeIcon = (type) => {
    switch(type) {
      case 'pdf': return <Download size={16} />;
      case 'video': return <Video size={16} />;
      case 'article': return <FileText size={16} />;
      default: return <FileText size={16} />;
    }
  };

  return (
    <Layout
      title="How-To Guides"
      description="Complete collection of guides, templates, and resources for sports card collectors"
    >
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>How-To Guides & Resources</h1>
          <p className={styles.heroSubtitle}>
            Everything you need to know about collecting, grading, and selling sports cards
          </p>
          
          {/* Search Bar */}
          <div className={styles.searchContainer}>
            <Search className={styles.searchIcon} size={20} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search guides, templates, and resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* Featured Guides */}
        {searchQuery === '' && selectedCategory === 'all' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              <BookOpen size={24} />
              Featured Guides
            </h2>
            <div className={styles.featuredGrid}>
              {featuredGuides.map(guide => (
                <div key={guide.id} className={`${styles.guideCard} ${styles.featuredCard}`}>
                  <div className={styles.featuredBadge}>⭐ Featured</div>
                  <div className={`${styles.typeBadge} ${getTypeBadgeClass(guide.type)}`}>
                    {getTypeIcon(guide.type)}
                    <span>{guide.type.toUpperCase()}</span>
                  </div>
                  <h3 className={styles.guideTitle}>{guide.title}</h3>
                  <p className={styles.guideDescription}>{guide.description}</p>
                  <div className={styles.guideMeta}>
                    <span className={styles.metaItem}>
                      {guide.type === 'video' ? guide.duration : guide.readTime || 'Download'}
                    </span>
                    <span className={styles.metaItem}>{guide.views} views</span>
                  </div>
                  <a 
                    href={guide.permalink || guide.downloadUrl || guide.videoUrl}
                    className={styles.guideButton}
                    target={guide.type === 'pdf' || guide.type === 'video' ? '_blank' : undefined}
                    rel={guide.type === 'pdf' || guide.type === 'video' ? 'noopener noreferrer' : undefined}
                  >
                    {guide.type === 'pdf' ? 'Download PDF' : guide.type === 'video' ? 'Watch Video' : 'Read Guide'}
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category Filter */}
        <section className={styles.section}>
          <div className={styles.categoryFilter}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`${styles.categoryButton} ${selectedCategory === cat.id ? styles.categoryActive : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <Icon size={18} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* All Guides */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            All Guides
            <span className={styles.resultCount}>({filteredGuides.length} results)</span>
          </h2>
          
          {filteredGuides.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No guides found matching your search.</p>
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
            <div className={styles.guidesGrid}>
              {filteredGuides.map(guide => (
                <div key={guide.id} className={styles.guideCard}>
                  <div className={`${styles.typeBadge} ${getTypeBadgeClass(guide.type)}`}>
                    {getTypeIcon(guide.type)}
                    <span>{guide.type.toUpperCase()}</span>
                  </div>
                  <h3 className={styles.guideTitle}>{guide.title}</h3>
                  <p className={styles.guideDescription}>{guide.description}</p>
                  <div className={styles.guideMeta}>
                    <span className={styles.metaItem}>
                      {guide.type === 'video' ? guide.duration : guide.readTime || 'Download'}
                    </span>
                    <span className={styles.metaItem}>{guide.views} views</span>
                    <span className={styles.metaItem}>{formatLastUpdated(guide.lastUpdated)}</span>
                  </div>
                  <a 
                    href={guide.permalink || guide.downloadUrl || guide.videoUrl}
                    className={styles.guideButton}
                    target={guide.type === 'pdf' || guide.type === 'video' ? '_blank' : undefined}
                    rel={guide.type === 'pdf' || guide.type === 'video' ? 'noopener noreferrer' : undefined}
                  >
                    {guide.type === 'pdf' ? 'Download PDF' : guide.type === 'video' ? 'Watch Video' : 'Read Guide'}
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Templates Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Download size={24} />
            Downloadable Templates
          </h2>
          <p className={styles.sectionDescription}>
            Ready-to-use templates to help you organize and manage your collection
          </p>
          <div className={styles.templatesGrid}>
            {TEMPLATES.map(template => (
              <div key={template.id} className={styles.templateCard}>
                <div className={styles.templateIcon}>
                  <FileText size={32} />
                </div>
                <h3 className={styles.templateTitle}>{template.title}</h3>
                <p className={styles.templateDescription}>{template.description}</p>
                <div className={styles.templateMeta}>
                  <span className={styles.fileType}>{template.fileType.toUpperCase()}</span>
                </div>
                <a 
                  href={template.downloadUrl}
                  className={styles.templateButton}
                  download
                >
                  <Download size={16} />
                  Download Template
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>Can't Find What You're Looking For?</h2>
            <p className={styles.ctaDescription}>
              Request a guide or template and we'll create it for you
            </p>
            <a href="/contact" className={styles.ctaButton}>
              Request a Guide
            </a>
          </div>
        </section>
      </div>
    </Layout>
  );
}
