import clsx from 'clsx';
import Heading from '@theme/Heading';

import styles from './styles.module.css';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

const FeatureList = [
  {
    title: 'Fresh eBay Inventory',
    image: '/img/cm-new-inventory.png',
    alt: 'Fresh eBay inventory',
    description: (
      <>
        Browse active listings from Cardboard Multiverse with pricing, bids, and
        direct links to each eBay item.
      </>
    ),
    cta: {
      label: 'Visit Our eBay Store!',
      to: 'https://www.ebay.com/str/cardboardmult1verse',
    },
  },
  {
    title: 'Collector Resources',
    image: '/img/cm-resources.png',
    alt: 'Collector resources',
    description: (
      <>
        Use practical guides, templates, and articles focused on grading,
        valuation, and building stronger collections.
      </>
    ),
    cta: {
      label: 'Check out our Resources!',
      to: '/articles',
    },
  },
  {
    title: 'Market-Focused Tracking',
    image: '/img/cm-cardboard-tracking.png',
    alt: 'Market-focused tracking',
    description: (
      <>
        Follow trends and top sellers across major sports with tools built for
        card collectors and flippers.
      </>
    ),
    cta: {
      label: 'Track Your Cards!',
      to: '/card-tracker',
    },
  },
];

function Feature({image, alt, title, description, cta}) {
  const imgUrl = useBaseUrl(image);
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <img className={styles.featureSvg} src={imgUrl} alt={alt} />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        <div style={{ marginTop: '1rem' }}>
          <Link
            className="button button--lg"
            style={{ background: 'rebeccapurple', color: 'white', border: 'none' }}
            to={cta.to}
            target={cta.to.startsWith('http') ? '_blank' : undefined}
            rel={cta.to.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
