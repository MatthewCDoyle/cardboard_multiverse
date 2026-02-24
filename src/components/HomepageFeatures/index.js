import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Fresh eBay Inventory',
    Svg: (props) => (
      <img
        src={require('@site/static/img/cm-new-inventory.png').default}
        alt="Fresh eBay inventory"
        {...props}
      />
    ),
    description: (
      <>
        Browse active listings from Cardboard Multiverse with pricing, bids, and
        direct links to each eBay item.
      </>
    ),
  },
  {
    title: 'Collector Resources',
    Svg: (props) => (
      <img
        src={require('@site/static/img/cm-resources.png').default}
        alt="Collector resources"
        {...props}
      />
    ),
    description: (
      <>
        Use practical guides, templates, and articles focused on grading,
        valuation, and building stronger collections.
      </>
    ),
  },
  {
    title: 'Market-Focused Tracking',
    Svg: (props) => (
      <img
        src={require('@site/static/img/cm-cardboard-tracking.png').default}
        alt="Market-focused tracking"
        {...props}
      />
    ),
    description: (
      <>
        Follow trends and top sellers across major sports with tools built for
        card collectors and flippers.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
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
