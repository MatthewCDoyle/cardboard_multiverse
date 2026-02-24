import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Calendar, Users, RefreshCw, Filter, Download } from 'lucide-react';

const HISTORY_STORAGE_KEY = 'sports-card-tracker-history-v1';
const PROXY_URL_STORAGE_KEY = 'sports-card-tracker-proxy-url';

const dedupe = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];

const resolveProxyBaseUrls = () => {
  const values = [];

  if (typeof window === 'undefined') {
    if (typeof process !== 'undefined' && process.env?.EBAY_PROXY_URL) {
      values.push(process.env.EBAY_PROXY_URL.replace(/\/$/, ''));
    }

    return dedupe(values);
  }

  if (typeof window.__EBAY_PROXY_URL__ === 'string' && window.__EBAY_PROXY_URL__.trim()) {
    const manualUrl = window.__EBAY_PROXY_URL__.trim().replace(/\/$/, '');
    values.push(manualUrl);
    try {
      window.localStorage.setItem(PROXY_URL_STORAGE_KEY, manualUrl);
    } catch {
      // Ignore localStorage write errors.
    }
  }

  try {
    const storedUrl = window.localStorage.getItem(PROXY_URL_STORAGE_KEY);
    if (typeof storedUrl === 'string' && storedUrl.trim()) {
      values.push(storedUrl.trim().replace(/\/$/, ''));
    }
  } catch {
    // Ignore localStorage read errors.
  }

  if (typeof process !== 'undefined' && process.env?.EBAY_PROXY_URL) {
    values.push(process.env.EBAY_PROXY_URL.replace(/\/$/, ''));
  }

  values.push('');

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    values.push('http://localhost:8787');
    return dedupe(values);
  }

  if (window.location.hostname.endsWith('.app.github.dev') === false && window.location.port !== '8787') {
    values.push(`${window.location.protocol}//${window.location.hostname}:8787`);
  }

  const forwardedHost = window.location.hostname.replace(/-\d+\.app\.github\.dev$/, '-8787.app.github.dev');
  if (forwardedHost !== window.location.hostname) {
    values.push(`${window.location.protocol}//${forwardedHost}`);
  }

  values.push('http://localhost:8787');

  return dedupe(values);
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

const fetchCompletedItems = async ({ player, sport, days }) => {
  const bases = resolveProxyBaseUrls();
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
      const response = await fetch(url, { credentials: 'include' });
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      const isJson = contentType.includes('application/json');
      const body = isJson
        ? JSON.parse(responseText || '{}')
        : null;

      if (!isJson) {
        attemptErrors.push(`${url} returned non-JSON response`);
        continue;
      }

      if (!response.ok) {
        if (response.status === 401) {
          attemptErrors.push(`${url} responded with 401 (tunnel auth). Set forwarded port 8787 visibility to Public or use authenticated tunnel cookies.`);
          continue;
        }

        attemptErrors.push(body?.error || `${url} responded with ${response.status}`);
        continue;
      }

      return body;
    } catch (error) {
      attemptErrors.push(`${url} failed: ${error instanceof Error ? error.message : 'network error'}`);
    }
  }

  throw new Error(
    `Failed to fetch sold listings through proxy. ${attemptErrors[0] || 'No reachable proxy endpoint.'} `
    + 'Set `window.__EBAY_PROXY_URL__` to your forwarded proxy URL (for Codespaces: `https://<name>-8787.app.github.dev`), set port 8787 visibility to Public if needed, and ensure `npm run api` is running.'
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

const SportsCardTracker = () => {
  const [selectedSport, setSelectedSport] = useState('MLB');
  const [selectedCategory, setSelectedCategory] = useState('current');
  const [dateRange, setDateRange] = useState(7); // days
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

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

  // Get sorted players by sales volume
  const sortedPlayers = Object.entries(salesData)
    .sort(([, a], [, b]) => b.salesVolume - a.salesVolume)
    .slice(0, 10);

  const totalSales = sortedPlayers.reduce((sum, [, data]) => sum + data.totalValue, 0);
  const avgSales = sortedPlayers.length > 0 ? Math.floor(totalSales / sortedPlayers.length) : 0;

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
          background: linear-gradient(135deg, #b185db 0%, #8f5ad6 100%);
          color: #191919;
          box-shadow: 0 4px 12px rgba(245, 175, 2, 0.35);
        }
        
        .trackerRoot .rank-2 {
          background: linear-gradient(135deg, #d9d9d9 0%, #bfc3c7 100%);
          color: #191919;
        }
        
        .trackerRoot .rank-3 {
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: #7c2d12;
        }
        
        .trackerRoot .rank-other {
          background: #f7f8fa;
          color: #5c5f62;
          border: 1px solid #d9d9d9;
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
                onClick={() => fetchEbayData(selectedSport, selectedCategory, dateRange)}
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