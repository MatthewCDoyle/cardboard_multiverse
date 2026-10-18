/**
 * src/dev-pages/dev-dashboard.js
 * ============================================================================
 * Developer Dashboard page, mounted only in dev (see docusaurus.config.js).
 * This file lives outside src/pages so production builds never register
 * the route.
 */

import React from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';

export default function DevDashboardPage() {
  return (
    <Layout
      title="Dev Dashboard"
      description="Developer dashboard — frontmatter schema coverage and content completeness."
    >
      {/* BrowserOnly ensures the dashboard (which fetches JSON) only runs in the browser */}
      <BrowserOnly fallback={<div style={{ padding: '2rem' }}>Loading dashboard...</div>}>
        {() => {
          // Dynamic import keeps the dashboard component out of the SSR bundle.
          const DevDashboard = require('@site/src/components/DevDashboard/index.jsx').default;
          return <DevDashboard />;
        }}
      </BrowserOnly>
    </Layout>
  );
}
