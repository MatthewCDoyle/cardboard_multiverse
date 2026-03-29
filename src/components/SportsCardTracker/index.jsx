import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Calendar, Users, RefreshCw, Filter, Download, ExternalLink } from 'lucide-react';

const HISTORY_STORAGE_KEY = 'sports-card-tracker-history-v1';
const PROXY_URL_STORAGE_KEY = 'sports-card-tracker-proxy-url';
const PROXY_HEALTH_CACHE_TTL_MS = 30 * 1000;

let proxyHealthCache = {
  expiresAt: 0,
  bases: []
};

const dedupe = (values) => [...new Set(values.filter((value) => typeof value === 'string'))];

const normalizeBaseUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const trimmed = value.trim().replace(/\/$/, '');

  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.replace(/\/$/, '').toLowerCase();

    if (path === '/api') {
      return `${parsed.origin}/api`;
    }

    return parsed.origin;
  } catch {
    return trimmed;
  }
};

const getCodespaceRoot = (host) => (typeof host === 'string'
  ? host.replace(/-\d+\.app\.github\.dev$/, '')
  : '');

const deriveCurrentProxyBaseUrl = () => {
  if (typeof window === 'undefined') {
    if (typeof process !== 'undefined' && process.env?.EBAY_PROXY_URL) {
      return normalizeBaseUrl(process.env.EBAY_PROXY_URL);
    }

    return '';
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8787';
  }

  if (window.location.hostname.endsWith('.app.github.dev')) {
    const forwardedHost = window.location.hostname.replace(/-\d+\.app\.github\.dev$/, '-8787.app.github.dev');
    return `${window.location.protocol}//${forwardedHost}`;
  }

  return '';
};

const canReuseSavedProxyBaseUrl = (value) => {
  const normalizedValue = normalizeBaseUrl(value);

  if (!normalizedValue || typeof window === 'undefined') {
    return false;
  }

  try {
    const parsed = new URL(normalizedValue);
    const savedHost = parsed.hostname;
    const currentHost = window.location.hostname;

    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      return savedHost === 'localhost' || savedHost === '127.0.0.1';
    }

    if (currentHost.endsWith('.app.github.dev')) {
      return savedHost.endsWith('.app.github.dev') && getCodespaceRoot(savedHost) === getCodespaceRoot(currentHost);
    }
  } catch {
    return false;
  }

  return false;
};

const resolveProxyBaseUrls = () => {
  const values = [];
  const derivedBaseUrl = deriveCurrentProxyBaseUrl();

  if (typeof window === 'undefined') {
    if (derivedBaseUrl) {
      values.push(derivedBaseUrl);
    }

    return dedupe(values);
  }

  const isCodespacesHost = window.location.hostname.endsWith('.app.github.dev');

  // In Codespaces with static serve, same-origin /api usually resolves to HTML.
  // Prefer forwarded proxy first there, but keep same-origin as a fallback.
  if (!isCodespacesHost) {
    values.push('');
  }

  if (derivedBaseUrl) {
    values.push(derivedBaseUrl);
  }

  if (isCodespacesHost) {
    values.push('');
  }

  if (canReuseSavedProxyBaseUrl(window.__EBAY_PROXY_URL__)) {
    const manualUrl = normalizeBaseUrl(window.__EBAY_PROXY_URL__);
    values.push(manualUrl);
    try {
      window.localStorage.setItem(PROXY_URL_STORAGE_KEY, manualUrl);
    } catch {
      // Ignore localStorage write errors.
    }
  }

  try {
    const storedUrl = window.localStorage.getItem(PROXY_URL_STORAGE_KEY);
    if (canReuseSavedProxyBaseUrl(storedUrl)) {
      values.push(normalizeBaseUrl(storedUrl));
    }
  } catch {
    // Ignore localStorage read errors.
  }

  if (typeof process !== 'undefined' && process.env?.EBAY_PROXY_URL) {
    values.push(normalizeBaseUrl(process.env.EBAY_PROXY_URL));
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    values.push('http://localhost:8787');
    return dedupe(values);
  }

  if (window.location.hostname.endsWith('.app.github.dev') === false && window.location.port !== '8787') {
    values.push(`${window.location.protocol}//${window.location.hostname}:8787`);
  }

  if (derivedBaseUrl) {
    values.push(derivedBaseUrl);
  }

  values.push('http://localhost:8787');

  return dedupe(values);
};

const buildProxyPathUrl = (baseUrl, path) => {
  const normalizedPath = (() => {
    if (baseUrl.endsWith('/api') && path.startsWith('/api/')) {
      return path.replace(/^\/api/, '');
    }

    return path;
  })();

  return `${baseUrl}${normalizedPath}`;
};

const fetchJson = async (url, timeoutMs = 2500) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal
    });
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();

    if (!contentType.includes('application/json')) {
      return { ok: false, status: response.status, body: null, nonJson: true, preview: responseText.slice(0, 120) };
    }

    const body = JSON.parse(responseText || '{}');
    return { ok: response.ok, status: response.status, body, nonJson: false, preview: '' };
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const getReachableProxyBaseUrls = async () => {
  const now = Date.now();
  if (proxyHealthCache.expiresAt > now && proxyHealthCache.bases.length > 0) {
    return proxyHealthCache.bases;
  }

  const candidates = resolveProxyBaseUrls();
  const reachable = [];

  for (const base of candidates) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) {
      continue;
    }

    const healthUrl = buildProxyPathUrl(base, '/api/health');
    try {
      const result = await fetchJson(healthUrl);
      if (result.ok && result.body?.ok) {
        reachable.push(base);
      }
    } catch {
      // Ignore probe failures and continue trying next base.
    }
  }

  const finalBases = reachable.length > 0 ? reachable : candidates;
  proxyHealthCache = {
    bases: finalBases,
    expiresAt: now + PROXY_HEALTH_CACHE_TTL_MS
  };

  return finalBases;
};

const buildProxyUrl = (baseUrl, path, params) => {
  const normalizedPath = (() => {
    if (baseUrl.endsWith('/api') && path.startsWith('/api/')) {
      return path.replace(/^\/api/, '');
    }

    return path;
  })();

  const query = new URLSearchParams(params).toString();
  return `${baseUrl}${normalizedPath}?${query}`;
};

const readHistoryStore = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeHistoryStore = (store) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(store));
};

const appendSnapshot = (store, key, salesData) => {
  const existing = store[key] || [];
  const next = [...existing, { timestamp: new Date().toISOString(), salesData }].slice(-365);
  const updated = {
    ...store,
    [key]: next
  };

  writeHistoryStore(updated);
  return updated;
};

const buildHistoricalSeries = (snapshots, players, days) => {
  const topPlayers = players.slice(0, 5);
  const points = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - dayOffset);

    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const snapshot = [...snapshots]
      .reverse()
      .find(({ timestamp }) => {
        const snapshotTime = new Date(timestamp);
        return snapshotTime >= day && snapshotTime <= dayEnd;
      });

    const row = {
      date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };

    topPlayers.forEach((player) => {
      row[player] = snapshot?.salesData?.[player]?.salesVolume || 0;
    });

    points.push(row);
  }

  return points;
};

const buildGoogleTrendsTimeframe = (days) => {
  if (days <= 1) {
    return 'now 1-d';
  }

  if (days <= 7) {
    return 'now 7-d';
  }

  if (days <= 14) {
    return 'today 1-m';
  }

  if (days <= 30) {
    return 'today 3-m';
  }

  return 'today 12-m';
};

const buildGoogleTrendsUrl = ({ terms, days, geo = 'US' }) => {
  const query = terms.filter(Boolean).join(',');
  const params = new URLSearchParams({
    q: query,
    date: buildGoogleTrendsTimeframe(days),
    geo
  });

  return `https://trends.google.com/trends/explore?${params.toString()}`;
};

const fetchTopTrendingAthletes = async ({ limit = 5 }) => {
  const bases = await getReachableProxyBaseUrls();
  const attemptErrors = [];

  for (const base of bases) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) {
      attemptErrors.push(`${base || 'same-origin'} blocked on HTTPS page`);
      continue;
    }

    const url = buildProxyUrl(base, '/api/trends/top-athletes', {
      limit: String(limit)
    });

    try {
      const result = await fetchJson(url, 4000);

      if (result.nonJson) {
        const bodyPreview = result.preview.replace(/\s+/g, ' ').trim().slice(0, 120);
        attemptErrors.push(
          `${url} returned non-JSON response (${result.status})`
          + `${bodyPreview ? `: ${bodyPreview}` : ''}`,
        );
        continue;
      }

      if (!result.ok) {
        attemptErrors.push(result.body?.error || `${url} responded with ${result.status}`);
        continue;
      }

      return Array.isArray(result.body?.athletes) ? result.body.athletes : [];
    } catch (error) {
      attemptErrors.push(`${url} failed: ${error instanceof Error ? error.message : 'network error'}`);
    }
  }

  const attemptsSummary = attemptErrors.slice(0, 4).join(' | ');
  throw new Error(
    `Failed to fetch top trending athletes. ${attemptsSummary || 'No reachable proxy endpoint.'}`
  );
};

const fetchCompletedItems = async ({ player, sport, days }) => {
  const bases = await getReachableProxyBaseUrls();
  const attemptErrors = [];

  for (const base of bases) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) {
      attemptErrors.push(`${base || 'same-origin'} blocked on HTTPS page`);
      continue;
    }

    const url = buildProxyUrl(base, '/api/ebay/completed-items', {
      player,
      sport,
      days: String(days)
    });

    try {
      const result = await fetchJson(url, 5000);

      if (result.nonJson) {
        const bodyPreview = result.preview
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120);
        attemptErrors.push(
          `${url} returned non-JSON response (${result.status})`
          + `${bodyPreview ? `: ${bodyPreview}` : ''}`,
        );
        continue;
      }

      if (!result.ok) {
        if (result.status === 401) {
          attemptErrors.push(`${url} responded with 401 (tunnel auth). Set forwarded port 8787 visibility to Public or use authenticated tunnel cookies.`);
          continue;
        }

        attemptErrors.push(result.body?.error || `${url} responded with ${result.status}`);
        continue;
      }

      return result.body;
    } catch (error) {
      attemptErrors.push(`${url} failed: ${error instanceof Error ? error.message : 'network error'}`);
    }
  }

  const sameOriginHtmlFallback = attemptErrors.some(
    (error) => error.includes('/api/ebay/completed-items') && error.includes('non-JSON response'),
  );
  const attemptsSummary = attemptErrors.slice(0, 4).join(' | ');

  throw new Error(
    `Failed to fetch sold listings through proxy. ${attemptsSummary || 'No reachable proxy endpoint.'} `
    + (sameOriginHtmlFallback
      ? 'Same-origin `/api` returned HTML, which usually means the site is running with `npm run serve` (no dev proxy). Use `npm run start` together with `npm run api`, or set `window.__EBAY_PROXY_URL__` to your forwarded proxy URL. '
      : '')
    + 'For Codespaces, ensure `npm run api` is running, use `https://<name>-8787.app.github.dev`, and set port 8787 visibility to Public if needed.'
  );
};

// Player Lists
const PLAYERS = {
  MLB: {
    current: ['Shohei Ohtani', 'Aaron Judge', 'Paul Skenes', 'Elly De La Cruz', 'Pete Crow-Armstrong', 
              'Nick Kurtz', 'Mike Trout', 'Cal Raleigh', 'Jackson Holliday', 'Wyatt Langford'],
    legends: ['Mickey Mantle', 'Babe Ruth', 'Jackie Robinson', 'Willie Mays', 'Hank Aaron',
              'Ted Williams', 'Roberto Clemente', 'Derek Jeter', 'Ken Griffey Jr', 'Cal Ripken Jr']
  },
  NFL: {
    current: ['Jayden Daniels', 'Patrick Mahomes', 'Joe Burrow', 'Bo Nix', 'Caleb Williams',
              'Trevor Lawrence', 'Josh Allen', 'Justin Herbert', 'Drake Maye', 'C.J. Stroud'],
    legends: ['Tom Brady', 'Joe Montana', 'Jerry Rice', 'Walter Payton', 'Lawrence Taylor',
              'Brett Favre', 'Peyton Manning', 'Emmitt Smith', 'Dan Marino', 'Barry Sanders']
  },
  NBA: {
    current: ['Victor Wembanyama', 'Cooper Flagg', 'Stephen Curry', 'Luka Dončić', 'Ja Morant',
              'Nikola Jokić', 'Giannis Antetokounmpo', 'Jayson Tatum', 'Joel Embiid', 'Anthony Edwards'],
    legends: ['Michael Jordan', 'LeBron James', 'Kobe Bryant', 'Magic Johnson', 'Larry Bird',
              'Kareem Abdul-Jabbar', 'Shaquille O\'Neal', 'Tim Duncan', 'Bill Russell', 'Wilt Chamberlain']
  }
};

const DEFAULT_GOOGLE_TRENDS_ATHLETES = [
  'Michael Jordan',
  'Tom Brady',
  'Shohei Ohtani',
  'LeBron James',
  'Patrick Mahomes'
];

const TRENDS_REFRESH_MS = 60 * 1000;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getSentimentTone = (score) => {
  if (score >= 75) {
    return {
      label: 'Very Bullish',
      color: '#047857',
      background: '#ecfdf5'
    };
  }

  if (score >= 60) {
    return {
      label: 'Bullish',
      color: '#065f46',
      background: '#f0fdf4'
    };
  }

  if (score >= 45) {
    return {
      label: 'Neutral',
      color: '#92400e',
      background: '#fffbeb'
    };
  }

  if (score >= 30) {
    return {
      label: 'Bearish',
      color: '#991b1b',
      background: '#fef2f2'
    };
  }

  return {
    label: 'Very Bearish',
    color: '#7f1d1d',
    background: '#fef2f2'
  };
};

const computeMarketSentiment = ({ salesData, trendsBySport, sport }) => {
  const trackedPlayers = Object.values(salesData);
  const trackedCount = trackedPlayers.length;

  if (trackedCount === 0) {
    const neutralTone = getSentimentTone(50);
    return {
      score: 50,
      tone: neutralTone,
      summary: `No ${sport} sales snapshots yet. Run a refresh to generate sentiment from live sold listings.`,
      drivers: [
        'Sales momentum unavailable',
        'Trend feed available once athlete data loads'
      ]
    };
  }

  const signedTrendPercents = trackedPlayers.map((player) => {
    const direction = player.trend === 'up' ? 1 : -1;
    return direction * Number(player.trendPercent || 0);
  });

  const averageSignedTrend = signedTrendPercents.reduce((sum, value) => sum + value, 0) / trackedCount;
  const upCount = trackedPlayers.filter((player) => player.trend === 'up').length;
  const upRatio = upCount / trackedCount;

  const sportTrendScores = trendsBySport.map((athlete) => athlete.score);
  const trendSignal = sportTrendScores.length > 0
    ? sportTrendScores.reduce((sum, value) => sum + value, 0) / sportTrendScores.length
    : 0;
  const trendBoost = sportTrendScores.length > 0
    ? clamp((trendSignal - 20) / 4, -10, 15)
    : 0;

  const momentumComponent = clamp(averageSignedTrend, -20, 20);
  const breadthComponent = (upRatio - 0.5) * 30;
  const score = Math.round(clamp(50 + momentumComponent + breadthComponent + trendBoost, 0, 100));
  const tone = getSentimentTone(score);
  const summary = `${upCount}/${trackedCount} tracked ${sport} players are trending up in sold volume. Avg momentum: ${averageSignedTrend.toFixed(1)}%.`;

  const drivers = [
    `Breadth: ${Math.round(upRatio * 100)}% of players showing upward sold-volume trend`,
    `Momentum: ${averageSignedTrend >= 0 ? '+' : ''}${averageSignedTrend.toFixed(1)}% average change`,
    sportTrendScores.length > 0
      ? `Google Trends: ${trendsBySport[0].name} leads ${sport} attention`
      : `Google Trends: no strong ${sport} athlete signal in current sample`
  ];

  return {
    score,
    tone,
    summary,
    drivers
  };
};

const SportsCardTracker = () => {
  const [selectedSport, setSelectedSport] = useState('MLB');
  const [selectedCategory, setSelectedCategory] = useState('current');
  const [dateRange, setDateRange] = useState(7); // days
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [trendingAthletes, setTrendingAthletes] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState('');
  const [trendsLastUpdate, setTrendsLastUpdate] = useState(null);

  const fetchEbayData = async (sport, category, days) => {
    setLoading(true);
    setErrorMessage('');

    const players = PLAYERS[sport][category];
    const historyKey = `${sport}:${category}:${days}`;

    try {
      const historyStore = readHistoryStore();
      const existingSnapshots = historyStore[historyKey] || [];
      const previousSales = existingSnapshots.length > 0
        ? existingSnapshots[existingSnapshots.length - 1].salesData
        : {};

      const playerResults = await Promise.all(
        players.map((player) => fetchCompletedItems({ player, sport, days }))
      );

      // Diagnostic log: inspect fetched player results and sales data
      console.log('Player Results:', playerResults);

      const nextSalesData = {};
      playerResults.forEach(({ player, salesVolume, avgPrice, totalValue }) => {
        const previousVolume = previousSales?.[player]?.salesVolume || salesVolume;
        const delta = previousVolume > 0
          ? Math.round((Math.abs(salesVolume - previousVolume) / previousVolume) * 100)
          : 0;

        nextSalesData[player] = {
          salesVolume,
          avgPrice,
          totalValue,
          trend: salesVolume >= previousVolume ? 'up' : 'down',
          trendPercent: delta
        };
      });

      const updatedStore = appendSnapshot(historyStore, historyKey, nextSalesData);
      const snapshots = updatedStore[historyKey] || [];

      setSalesData(nextSalesData);
      setHistoricalData(buildHistoricalSeries(snapshots, players, days));
      setLastUpdate(new Date());
    } catch (error) {
      const historyStore = readHistoryStore();
      const fallbackSnapshots = historyStore[historyKey] || [];
      const latestSnapshot = fallbackSnapshots[fallbackSnapshots.length - 1];

      if (latestSnapshot) {
        setSalesData(latestSnapshot.salesData);
        setHistoricalData(buildHistoricalSeries(fallbackSnapshots, players, days));
        setLastUpdate(new Date(latestSnapshot.timestamp));
      } else {
        setSalesData({});
        setHistoricalData([]);
      }

      setErrorMessage(error instanceof Error ? error.message : 'Unable to fetch live eBay data right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEbayData(selectedSport, selectedCategory, dateRange);
  }, [selectedSport, selectedCategory, dateRange]);

  const fetchTrends = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError('');

    try {
      const athletes = await fetchTopTrendingAthletes({ limit: 10 });
      setTrendingAthletes(athletes);
      setTrendsLastUpdate(new Date());
    } catch (error) {
      setTrendingAthletes([]);
      setTrendingError(error instanceof Error ? error.message : 'Unable to fetch Google Trends data right now.');
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
    const timer = window.setInterval(fetchTrends, TRENDS_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [fetchTrends]);

  // Get sorted players by sales volume
  const sortedPlayers = Object.entries(salesData)
    .sort(([, a], [, b]) => b.salesVolume - a.salesVolume)
    .slice(0, 10);

  const totalSales = sortedPlayers.reduce((sum, [, data]) => sum + data.totalValue, 0);
  const avgSales = sortedPlayers.length > 0 ? Math.floor(totalSales / sortedPlayers.length) : 0;
  const selectedSportTrendingAthletes = trendingAthletes
    .filter((athlete) => athlete.sport === selectedSport)
    .slice(0, 5);
  const marketSentiment = computeMarketSentiment({
    salesData,
    trendsBySport: selectedSportTrendingAthletes,
    sport: selectedSport
  });
  const googleTrendsTerms = (trendingAthletes.length > 0
    ? trendingAthletes.map((athlete) => athlete.name)
    : DEFAULT_GOOGLE_TRENDS_ATHLETES
  ).slice(0, 5);
  const googleTrendsUrl = buildGoogleTrendsUrl({ terms: googleTrendsTerms, days: dateRange });

  const exportData = () => {
    const csv = [
      ['Rank', 'Player', 'Sales Volume', 'Avg Price', 'Total Value', 'Trend', 'Trend %'],
      ...sortedPlayers.map(([player, data], idx) => [
        idx + 1,
        player,
        data.salesVolume,
        `$${data.avgPrice}`,
        `$${data.totalValue.toLocaleString()}`,
        data.trend,
        `${data.trendPercent}%`
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sports-cards-${selectedSport}-${selectedCategory}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="trackerRoot" style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f7f8fa 0%, #ffffff 100%)',
      fontFamily: '"Space Grotesk", -apple-system, system-ui, sans-serif',
      color: '#191919',
      padding: '2rem'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        
        .trackerRoot * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        
        .trackerRoot .animate-in {
          animation: slideUp 0.6s ease-out forwards;
        }
        
        .trackerRoot .pulse {
          animation: pulse 2s ease-in-out infinite;
        }
        
        .trackerRoot .card {
          background: #ffffff;
          border: 1px solid #d9d9d9;
          border-radius: 16px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }
        
        .trackerRoot .card:hover {
          background: #ffffff;
          border-color: #bfc3c7;
          transform: translateY(-2px);
          box-shadow: 0 16px 30px rgba(25, 25, 25, 0.08);
        }
        
        .trackerRoot .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-family: 'Space Grotesk', sans-serif;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .trackerRoot .btn-primary {
          background: linear-gradient(135deg, #6f2dbd 0%, #5a189a 100%);
          color: white;
        }
        
        .trackerRoot .btn-primary:hover {
          background: linear-gradient(135deg, #5a189a 0%, #461272 100%);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(54, 101, 243, 0.3);
        }
        
        .trackerRoot .btn-secondary {
          background: #f7f8fa;
          color: #191919;
          border: 1px solid #d9d9d9;
        }
        
        .trackerRoot .btn-secondary:hover {
          background: #f3ecff;
          border-color: #6f2dbd;
          color: #5a189a;
        }
        
        .trackerRoot .btn-secondary.active {
          background: linear-gradient(135deg, #6f2dbd 0%, #5a189a 100%);
          color: white;
          border-color: transparent;
        }
        
        .trackerRoot .stat-card {
          background: linear-gradient(135deg, rgba(54, 101, 243, 0.08) 0%, rgba(54, 101, 243, 0.03) 100%);
          border: 1px solid rgba(54, 101, 243, 0.2);
        }
        
        .trackerRoot .loading-skeleton {
          background: linear-gradient(90deg, rgba(148, 163, 184, 0.1) 25%, rgba(148, 163, 184, 0.2) 50%, rgba(148, 163, 184, 0.1) 75%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite linear;
          border-radius: 8px;
          height: 60px;
          margin-bottom: 1rem;
        }
        
        .trackerRoot .rank-badge {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
        }
        
        .trackerRoot .rank-1 {
          background: linear-gradient(135deg, #f6d365 0%, #d4a017 100%);
          color: #4a2f08;
          box-shadow: 0 4px 12px rgba(212, 160, 23, 0.35);
        }
        
        .trackerRoot .rank-2 {
          background: linear-gradient(135deg, #e5e7eb 0%, #b7bec8 100%);
          color: #2f3540;
        }
        
        .trackerRoot .rank-3 {
          background: linear-gradient(135deg, #cd7f32 0%, #8c4f1d 100%);
          color: #fff4e6;
        }
        
        .trackerRoot .rank-other {
          background: linear-gradient(135deg, #7b2cbf 0%, #5a189a 100%);
          color: #ffffff;
          border: 1px solid #6f2dbd;
        }
        
        .trackerRoot .trend-up {
          color: #10b981;
        }
        
        .trackerRoot .trend-down {
          color: #ef4444;
        }
        
        .trackerRoot select {
          background: #ffffff;
          color: #191919;
          border: 1px solid #d9d9d9;
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .trackerRoot select:focus {
          outline: none;
          border-color: #6f2dbd;
          box-shadow: 0 0 0 3px rgba(54, 101, 243, 0.12);
        }
        
        .trackerRoot .metric-value {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
        }
      `}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div className="animate-in" style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: '700',
            color: '#000000',
            marginBottom: '0.5rem'
          }}>
            Sports Card Sales Tracker
          </h1>
          <p style={{ color: '#5c5f62', fontSize: '1.1rem' }}>
            Live eBay market data • Updated {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Loading...'}
          </p>
        </div>

        {/* Controls */}
        <div className="card animate-in" style={{ 
          marginBottom: '2rem',
          animationDelay: '0.1s',
          opacity: 0
        }}>
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            gap: '1rem',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Sport Selection */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  color: '#5c5f62',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Sport
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['MLB', 'NFL', 'NBA'].map(sport => (
                    <button
                      key={sport}
                      className={`btn btn-secondary ${selectedSport === sport ? 'active' : ''}`}
                      onClick={() => setSelectedSport(sport)}
                    >
                      {sport}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  color: '#5c5f62',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Category
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn btn-secondary ${selectedCategory === 'current' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('current')}
                  >
                    <Users size={18} />
                    Current Players
                  </button>
                  <button
                    className={`btn btn-secondary ${selectedCategory === 'legends' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('legends')}
                  >
                    <TrendingUp size={18} />
                    Hall of Fame
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  color: '#5c5f62',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                  Time Period
                </label>
                <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(Number(e.target.value))}
                >
                  <option value={1}>Last 24 Hours</option>
                  <option value={7}>Last 7 Days</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={90}>Last 90 Days</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  fetchEbayData(selectedSport, selectedCategory, dateRange);
                  fetchTrends();
                }}
                disabled={loading}
              >
                <RefreshCw size={18} className={loading ? 'pulse' : ''} />
                Refresh
              </button>
              <button 
                className="btn btn-primary"
                onClick={exportData}
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="card animate-in" style={{
            marginBottom: '2rem',
            borderColor: '#ef4444',
            background: '#fff5f5',
            color: '#7f1d1d',
            animationDelay: '0.15s',
            opacity: 0
          }}>
            {errorMessage} Showing latest saved snapshot from local history when available.
          </div>
        )}

        {/* Stats Overview */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div className="card stat-card animate-in" style={{ animationDelay: '0.2s', opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #6f2dbd 0%, #5a189a 100%)',
                padding: '1rem',
                borderRadius: '12px'
              }}>
                <DollarSign size={24} />
              </div>
              <div>
                <p style={{ color: '#5c5f62', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Total Market Value</p>
                <p className="metric-value" style={{ fontSize: '1.5rem', color: '#191919' }}>
                  ${totalSales.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card stat-card animate-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '1rem',
                borderRadius: '12px'
              }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <p style={{ color: '#5c5f62', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Avg Player Value</p>
                <p className="metric-value" style={{ fontSize: '1.5rem', color: '#191919' }}>
                  ${avgSales.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="card stat-card animate-in" style={{ animationDelay: '0.4s', opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #b185db 0%, #8f5ad6 100%)',
                padding: '1rem',
                borderRadius: '12px'
              }}>
                <Users size={24} />
              </div>
              <div>
                <p style={{ color: '#5c5f62', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Players Tracked</p>
                <p className="metric-value" style={{ fontSize: '1.5rem', color: '#191919' }}>
                  {sortedPlayers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="card stat-card animate-in" style={{ animationDelay: '0.5s', opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                padding: '1rem',
                borderRadius: '12px'
              }}>
                <TrendingUp size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#5c5f62', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Real-Time Market Sentiment</p>
                <p className="metric-value" style={{ fontSize: '1.4rem', color: marketSentiment.tone.color, marginBottom: '0.35rem' }}>
                  {marketSentiment.score}/100 • {marketSentiment.tone.label}
                </p>
                <p style={{ color: '#5c5f62', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                  {marketSentiment.summary}
                </p>
                <div style={{
                  width: '100%',
                  background: '#eceff2',
                  height: '8px',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{
                    width: `${marketSentiment.score}%`,
                    background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 45%, #10b981 100%)',
                    height: '100%'
                  }} />
                </div>
                {trendingError && (
                  <p style={{ color: '#9f1239', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    Live trend refresh unavailable. Sentiment is using fallback athlete list.
                  </p>
                )}
                <p style={{ color: '#5c5f62', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Trend feed refreshes every 60s.
                  {trendsLastUpdate ? ` Last trend sync: ${trendsLastUpdate.toLocaleTimeString()}` : ''}
                </p>
                <a
                  href={googleTrendsUrl}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: '#5a189a',
                    fontWeight: '600',
                    textDecoration: 'none',
                    fontSize: '0.9rem'
                  }}
                >
                  Open Live Trends
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Trends + Sentiment Detail */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div className="card animate-in" style={{ animationDelay: '0.55s', opacity: 0 }}>
            <h2 style={{
              fontSize: '1.2rem',
              marginBottom: '1rem',
              color: '#191919',
              fontWeight: '600'
            }}>
              Trending Players ({selectedSport})
            </h2>

            {trendingLoading ? (
              <div className="loading-skeleton" style={{ height: '220px' }} />
            ) : selectedSportTrendingAthletes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedSportTrendingAthletes.map((athlete, index) => (
                  <div key={athlete.name} style={{
                    display: 'flex',
                    gap: '0.8rem',
                    padding: '0.75rem',
                    border: '1px solid #d9d9d9',
                    borderRadius: '10px',
                    background: '#fcfcfd'
                  }}>
                    <div className={`rank-badge rank-${index < 3 ? index + 1 : 'other'}`} style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '600', color: '#191919' }}>{athlete.name}</p>
                      <p style={{ fontSize: '0.8rem', color: '#5c5f62' }}>
                        Trend score: {athlete.score}
                        {athlete.sampleMentions?.[0] ? ` • ${athlete.sampleMentions[0]}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#5c5f62', fontSize: '0.9rem' }}>
                No live trending players detected for {selectedSport} yet. Try refresh.
              </p>
            )}
          </div>

          <div className="card animate-in" style={{ animationDelay: '0.58s', opacity: 0 }}>
            <h2 style={{
              fontSize: '1.2rem',
              marginBottom: '1rem',
              color: '#191919',
              fontWeight: '600'
            }}>
              Sentiment Drivers
            </h2>
            <div style={{
              background: marketSentiment.tone.background,
              border: `1px solid ${marketSentiment.tone.color}22`,
              borderRadius: '12px',
              padding: '0.9rem',
              marginBottom: '0.9rem'
            }}>
              <p style={{ color: marketSentiment.tone.color, fontWeight: '700', marginBottom: '0.25rem' }}>
                {marketSentiment.tone.label}
              </p>
              <p style={{ color: '#3d3f42', fontSize: '0.9rem' }}>{marketSentiment.summary}</p>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.15rem', color: '#3d3f42', lineHeight: '1.7' }}>
              {marketSentiment.drivers.map((driver) => (
                <li key={driver}>{driver}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {/* Rankings Table */}
          <div className="card animate-in" style={{ animationDelay: '0.5s', opacity: 0 }}>
            <h2 style={{ 
              fontSize: '1.5rem',
              marginBottom: '1.5rem',
              color: '#191919',
              fontWeight: '600'
            }}>
              Top 10 Rankings
            </h2>
            
            {loading ? (
              <>
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="loading-skeleton" />
                ))}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sortedPlayers.map(([player, data], idx) => (
                  <div
                    key={player}
                    style={{
                      background: '#f7f8fa',
                      padding: '1rem',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      border: '1px solid #d9d9d9',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3ecff';
                      e.currentTarget.style.borderColor = '#6f2dbd';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f7f8fa';
                      e.currentTarget.style.borderColor = '#d9d9d9';
                    }}
                  >
                    <div className={`rank-badge rank-${idx < 3 ? idx + 1 : 'other'}`}>
                      {idx + 1}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', color: '#191919' }}>
                        {player}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#5c5f62' }}>
                        {data.salesVolume} sales • Avg ${data.avgPrice}
                      </p>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <p className="metric-value" style={{ fontSize: '1.2rem', color: '#191919', marginBottom: '0.25rem' }}>
                        ${data.totalValue.toLocaleString()}
                      </p>
                      <p className={data.trend === 'up' ? 'trend-up' : 'trend-down'} style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                        {data.trend === 'up' ? '↑' : '↓'} {data.trendPercent}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sales Trend Chart */}
          <div className="card animate-in" style={{ animationDelay: '0.6s', opacity: 0 }}>
            <h2 style={{ 
              fontSize: '1.5rem',
              marginBottom: '1.5rem',
              color: '#191919',
              fontWeight: '600'
            }}>
              Sales Volume Trend (Top 5)
            </h2>
            
            {loading ? (
              <div className="loading-skeleton" style={{ height: '300px' }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#5c5f62"
                    style={{ fontSize: '0.85rem' }}
                  />
                  <YAxis 
                    stroke="#5c5f62"
                    style={{ fontSize: '0.85rem' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #d9d9d9',
                      borderRadius: '8px',
                      color: '#191919'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '0.85rem' }}
                  />
                  {sortedPlayers.slice(0, 5).map(([player], idx) => (
                    <Line 
                      key={player}
                      type="monotone"
                      dataKey={player}
                      stroke={['#6f2dbd', '#5a189a', '#7b2cbf', '#8f5ad6', '#b185db'][idx]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart Comparison */}
        <div className="card animate-in" style={{ animationDelay: '0.7s', opacity: 0 }}>
          <h2 style={{ 
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            color: '#191919',
            fontWeight: '600'
          }}>
            Market Value Comparison
          </h2>
          
          {loading ? (
            <div className="loading-skeleton" style={{ height: '400px' }} />
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={sortedPlayers.map(([player, data]) => ({
                player: player.split(' ').pop(), // Last name only for space
                value: data.totalValue,
                sales: data.salesVolume
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis 
                  dataKey="player" 
                  stroke="#5c5f62"
                  style={{ fontSize: '0.85rem' }}
                />
                <YAxis 
                  stroke="#5c5f62"
                  style={{ fontSize: '0.85rem' }}
                />
                <Tooltip 
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #d9d9d9',
                    borderRadius: '8px',
                    color: '#191919'
                  }}
                  formatter={(value) => `$${value.toLocaleString()}`}
                />
                <Legend />
                <Bar 
                  dataKey="value" 
                  fill="url(#colorGradient)" 
                  radius={[8, 8, 0, 0]}
                  name="Total Value"
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6f2dbd" />
                    <stop offset="100%" stopColor="#5a189a" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Footer Info */}
        <div className="card animate-in" style={{ 
          marginTop: '2rem',
          animationDelay: '0.8s',
          opacity: 0,
          background: '#f7f8fa',
          border: '1px solid #d9d9d9'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #6f2dbd 0%, #5a189a 100%)',
              padding: '0.75rem',
              borderRadius: '10px'
            }}>
              <Filter size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#191919' }}>
                eBay API Status
              </h3>
              <p style={{ color: '#5c5f62', lineHeight: '1.6', marginBottom: '1rem' }}>
                Live sold listings are pulled through a backend proxy using
                <span style={{
                  background: 'rgba(54, 101, 243, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.9rem',
                  marginLeft: '0.4rem',
                  marginRight: '0.4rem'
                }}>findCompletedItems</span>
                and stored in localStorage for persistent trend tracking without exposing credentials in browser code.
              </p>
              <ol style={{ color: '#191919', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
                <li>Proxy endpoint: <code style={{ 
                  background: 'rgba(54, 101, 243, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.9rem'
                }}>/api/ebay/completed-items</code></li>
                <li>Default local proxy URL: <code style={{ 
                  background: 'rgba(54, 101, 243, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.9rem'
                }}>http://localhost:8787</code></li>
                <li>Backend env vars required: <code style={{ 
                  background: 'rgba(54, 101, 243, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.9rem'
                }}>EBAY_APP_ID, EBAY_DEV_ID, EBAY_CERT_ID</code></li>
                <li>Historical snapshots are persisted in localStorage key <code style={{
                  background: 'rgba(54, 101, 243, 0.12)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.9rem'
                }}>{HISTORY_STORAGE_KEY}</code></li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SportsCardTracker;