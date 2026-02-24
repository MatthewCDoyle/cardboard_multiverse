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

// Sample Guides Data
const GUIDES = [
  {
    id: 1,
    title: 'Complete Guide to PSA Grading',
    description: 'Learn how to submit cards for PSA grading, understand grading criteria, and maximize your card values.',
    category: 'grading',
    type: 'pdf',
    downloadUrl: '/guides/psa-grading-guide.pdf',
    lastUpdated: '2024-01-15',
    views: 1243,
    featured: true
  },
  {
    id: 2,
    title: 'How to Identify Rookie Cards',
    description: 'Step-by-step guide to identifying authentic rookie cards and avoiding common counterfeits.',
    category: 'buying',
    type: 'article',
    readTime: '8 min',
    lastUpdated: '2024-02-10',
    views: 892,
    featured: true
  },
  {
    id: 3,
    title: 'Card Storage Best Practices',
    description: 'Protect your investment with proper storage techniques, humidity control, and organization systems.',
    category: 'storage',
    type: 'pdf',
    downloadUrl: '/guides/storage-guide.pdf',
    lastUpdated: '2024-01-20',
    views: 756
  },
  {
    id: 4,
    title: 'Using eBay Sold Listings for Valuation',
    description: 'Master the art of pricing your cards using eBay\'s completed listings and market trends.',
    category: 'valuation',
    type: 'video',
    videoUrl: 'https://youtube.com/watch?v=example',
    duration: '12:34',
    lastUpdated: '2024-02-01',
    views: 2103
  },
  {
    id: 5,
    title: 'BGS vs PSA: Which to Choose?',
    description: 'Compare grading services, costs, turnaround times, and which is best for different card types.',
    category: 'grading',
    type: 'article',
    readTime: '6 min',
    lastUpdated: '2024-01-28',
    views: 1456
  },
  {
    id: 6,
    title: 'Negotiating on Card Sales',
    description: 'Tips and templates for making offers, counteroffers, and closing deals on high-value cards.',
    category: 'buying',
    type: 'pdf',
    downloadUrl: '/guides/negotiation-templates.pdf',
    lastUpdated: '2024-02-05',
    views: 634,
    featured: true
  },
  {
    id: 7,
    title: 'Top Loader vs One Touch Holders',
    description: 'Which protection method is right for your cards? Complete comparison guide.',
    category: 'storage',
    type: 'article',
    readTime: '5 min',
    lastUpdated: '2024-01-18',
    views: 445
  },
  {
    id: 8,
    title: 'Vintage Card Valuation Checklist',
    description: 'Downloadable checklist for assessing condition and value of pre-1980 sports cards.',
    category: 'valuation',
    type: 'pdf',
    downloadUrl: '/guides/vintage-checklist.pdf',
    lastUpdated: '2024-01-12',
    views: 823
  },
];

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
                    href={guide.downloadUrl || guide.videoUrl || `/guides/${guide.id}`}
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
                    <span className={styles.metaItem}>Updated {new Date(guide.lastUpdated).toLocaleDateString()}</span>
                  </div>
                  <a 
                    href={guide.downloadUrl || guide.videoUrl || `/guides/${guide.id}`}
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
