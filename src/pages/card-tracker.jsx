import React from 'react';
import Layout from '@theme/Layout';
import SportsCardTracker from '@site/src/components/SportsCardTracker';

export default function CardTrackerPage() {
  return (
    <Layout
      title="Sports Card Sales Tracker"
      description="Track top-selling sports cards on eBay - Real-time market data for MLB, NFL, and NBA cards"
    >
      <SportsCardTracker />
    </Layout>
  );
}
