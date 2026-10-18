/**
 * dashboard.config.mjs
 * ============================================================================
 * Frontmatter fields tracked by the dev dashboard (dev server only).
 * Adapted from timeweave for the cardboard_multiverse article schema.
 *
 *   key       – exact YAML key in frontmatter
 *   label     – human-readable label for the dashboard
 *   required  – whether the field is required for a doc to be "complete"
 *   isArray   – whether the value is a YAML array (list of strings)
 *   chartType – 'donut' | 'bar' | 'progress'
 */

/** @type {{ fields: Array<{ key: string, label: string, required: boolean, isArray: boolean, chartType: string }> }} */
const dashboardConfig = {
  fields: [
    { key: 'title',         label: 'Title',          required: true,  isArray: false, chartType: 'progress' },
    { key: 'slug',          label: 'Slug',           required: true,  isArray: false, chartType: 'progress' },
    { key: 'excerpt',       label: 'Excerpt',        required: true,  isArray: false, chartType: 'progress' },
    { key: 'description',   label: 'Description',    required: false, isArray: false, chartType: 'progress' },
    { key: 'contentType',   label: 'Content Type',   required: true,  isArray: false, chartType: 'donut'    },
    { key: 'status',        label: 'Status',         required: true,  isArray: false, chartType: 'donut'    },
    { key: 'author',        label: 'Author',         required: true,  isArray: false, chartType: 'bar'      },
    { key: 'publishedAt',   label: 'Published At',   required: true,  isArray: false, chartType: 'progress' },
    { key: 'updatedAt',     label: 'Updated At',     required: false, isArray: false, chartType: 'progress' },
    { key: 'funnel',        label: 'Funnel',         required: false, isArray: false, chartType: 'donut'    },
    { key: 'sport',         label: 'Sport',          required: false, isArray: true,  chartType: 'bar'      },
    { key: 'cardEra',       label: 'Card Era',       required: false, isArray: true,  chartType: 'bar'      },
    { key: 'players',       label: 'Players',        required: false, isArray: true,  chartType: 'bar'      },
    { key: 'archetypes',    label: 'Archetypes',     required: false, isArray: true,  chartType: 'bar'      },
    { key: 'topics',        label: 'Topics',         required: false, isArray: true,  chartType: 'bar'      },
    { key: 'featuredImage', label: 'Featured Image', required: false, isArray: false, chartType: 'progress' },
    { key: 'seo',           label: 'SEO Block',      required: false, isArray: false, chartType: 'progress' },
  ],
};

export default dashboardConfig;
