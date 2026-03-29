import React, {useEffect} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

export default function LegacyRouteRedirect({to, title = 'Page Moved'}) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return (
    <Layout title={title}>
      <main
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div>
          <h1>{title}</h1>
          <p>This route has moved to a current page.</p>
          <p>
            <Link to={to}>Continue to the updated location</Link>
          </p>
        </div>
      </main>
    </Layout>
  );
}