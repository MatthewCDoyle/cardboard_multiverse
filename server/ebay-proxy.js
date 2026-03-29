const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.EBAY_PROXY_PORT || 8787);
// Use live eBay Finding API endpoint for real data
const EBAY_FINDING_ENDPOINT = process.env.EBAY_FINDING_ENDPOINT || 'https://svcs.ebay.com/services/search/FindingService/v1';
const EBAY_BROWSE_ENDPOINT = process.env.EBAY_BROWSE_ENDPOINT || 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const TRADING_CARDS_CATEGORY_ID = '261328';
const GOOGLE_TRENDS_RSS_URL = 'https://trends.google.com/trending/rss?geo=US';

const ATHLETE_CANDIDATES = {
  NBA: [
    'Michael Jordan', 'LeBron James', 'Kobe Bryant', 'Magic Johnson', 'Larry Bird',
    'Shaquille O\'Neal', 'Tim Duncan', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo',
    'Nikola Jokic', 'Luka Doncic', 'Victor Wembanyama', 'Jayson Tatum', 'Anthony Edwards',
    'Ja Morant', 'Joel Embiid', 'Kareem Abdul-Jabbar', 'Wilt Chamberlain', 'Bill Russell',
    'Allen Iverson', 'Dirk Nowitzki', 'Dwyane Wade', 'Kevin Garnett', 'Charles Barkley',
    'Scottie Pippen', 'Steve Nash', 'Chris Paul', 'Kawhi Leonard', 'James Harden'
  ],
  NFL: [
    'Tom Brady', 'Patrick Mahomes', 'Joe Burrow', 'Josh Allen', 'Lamar Jackson',
    'Caleb Williams', 'Jayden Daniels', 'Bo Nix', 'C.J. Stroud', 'Trevor Lawrence',
    'Peyton Manning', 'Eli Manning', 'Aaron Rodgers', 'Brett Favre', 'Joe Montana',
    'Jerry Rice', 'Emmitt Smith', 'Barry Sanders', 'Walter Payton', 'Lawrence Taylor',
    'Randy Moss', 'Terrell Owens', 'Deion Sanders', 'Travis Kelce', 'Rob Gronkowski',
    'Justin Jefferson', 'Tyreek Hill', 'Saquon Barkley', 'Micah Parsons', 'Cooper Kupp'
  ],
  MLB: [
    'Shohei Ohtani', 'Aaron Judge', 'Mike Trout', 'Mookie Betts', 'Ronald Acuna Jr',
    'Bobby Witt Jr', 'Paul Skenes', 'Elly De La Cruz', 'Juan Soto', 'Freddie Freeman',
    'Derek Jeter', 'Ken Griffey Jr', 'Mickey Mantle', 'Babe Ruth', 'Willie Mays',
    'Hank Aaron', 'Jackie Robinson', 'Ted Williams', 'Roberto Clemente', 'Cal Ripken Jr',
    'Nolan Ryan', 'Sandy Koufax', 'Ichiro Suzuki', 'David Ortiz', 'Albert Pujols',
    'Pedro Martinez', 'Randy Johnson', 'Chipper Jones', 'Mariano Rivera', 'Ozzie Smith'
  ]
};

const ATHLETE_SPORT_LOOKUP = Object.entries(ATHLETE_CANDIDATES).reduce((lookup, [sport, names]) => {
  names.forEach((name) => {
    lookup.set(name, sport);
  });

  return lookup;
}, new Map());

const ATHLETE_POOL = [...new Set(Object.values(ATHLETE_CANDIDATES).flat())];
const PERSON_NAME_STOPWORDS = new Set([
  'and', 'cf', 'coach', 'draft', 'game', 'games', 'highlights', 'injuries', 'injury', 'live', 'mlb', 'nba',
  'news', 'nfl', 'odds', 'playoff', 'playoffs', 'results', 'rumor', 'rumors', 'schedule', 'score', 'scores',
  'stats', 'team', 'today', 'tonight', 'trade', 'update', 'updates', 'vs'
]);

const loadEnvFile = (fileName) => {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['\"]|['\"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
};

loadEnvFile('.env.local');
loadEnvFile('.env');

const APP_ID = process.env.EBAY_APP_ID;
const DEV_ID = process.env.EBAY_DEV_ID;
const CERT_ID = process.env.EBAY_CERT_ID;
const BROWSE_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
let browseTokenCache = {
  token: '',
  expiresAt: 0
};

console.log('[eBay Proxy] Loaded credentials:');
console.log('  EBAY_APP_ID:', APP_ID);
console.log('  EBAY_DEV_ID:', DEV_ID);
console.log('  EBAY_CERT_ID:', CERT_ID);

const writeJson = (req, res, statusCode, payload) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = typeof requestOrigin === 'string' && requestOrigin.length > 0
    ? requestOrigin
    : '*';

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

const fetchGoogleTrendsRss = async () => {
  const response = await fetch(GOOGLE_TRENDS_RSS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CardboardMultiverse/1.0)'
    }
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Google Trends request failed (${response.status}).`);
  }

  return text;
};

const decodeXmlEntities = (value) => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractXmlBlocks = (xml, tagName) => {
  const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, 'gi');
  return [...String(xml || '').matchAll(pattern)].map((match) => match[1]);
};

const extractXmlValue = (xml, tagName) => {
  const pattern = new RegExp(`<${escapeRegex(tagName)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tagName)}>`, 'i');
  const match = String(xml || '').match(pattern);
  return decodeXmlEntities(match?.[1] || '');
};

const parseApproxTraffic = (value) => {
  const match = String(value || '').match(/([\d.]+)\s*([KM]?)/i);
  if (!match) {
    return 0;
  }

  const base = Number(match[1]);
  if (!Number.isFinite(base)) {
    return 0;
  }

  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'M') {
    return Math.round(base * 1000000);
  }

  if (suffix === 'K') {
    return Math.round(base * 1000);
  }

  return Math.round(base);
};

const toTitleCase = (value) => String(value || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word
    .split(/([\-'])/)
    .map((part) => {
      if (part === '-' || part === "'") {
        return part;
      }

      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(''))
  .join(' ');

const toCanonicalAthleteName = (value) => {
  const normalized = normalizeText(value);
  return NORMALIZED_ATHLETE_LOOKUP.get(normalized) || '';
};

const isLikelyPersonName = (value) => {
  if (!looksLikeAthleteName(value)) {
    return false;
  }

  const tokens = String(value || '').toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => !PERSON_NAME_STOPWORDS.has(token.replace(/[^a-z]/g, '')));
};

const toAthleteEntityCandidate = (value) => {
  const canonical = toCanonicalAthleteName(value);
  if (canonical) {
    return canonical;
  }

  const titled = toTitleCase(value);
  return isLikelyPersonName(titled) ? titled : '';
};

const buildTrendEntriesFromRss = (xml) => {
  const items = extractXmlBlocks(xml, 'item');
  const entries = [];

  items.forEach((itemXml, itemIndex) => {
    const title = extractXmlValue(itemXml, 'title');
    const approxTraffic = parseApproxTraffic(extractXmlValue(itemXml, 'ht:approx_traffic'));
    const newsItems = extractXmlBlocks(itemXml, 'ht:news_item');
    const articleTitles = newsItems
      .map((newsItem) => extractXmlValue(newsItem, 'ht:news_item_title'))
      .filter(Boolean);
    const articleSources = newsItems
      .map((newsItem) => extractXmlValue(newsItem, 'ht:news_item_source'))
      .filter(Boolean);
    const articleUrls = newsItems
      .map((newsItem) => extractXmlValue(newsItem, 'ht:news_item_url'))
      .filter(Boolean);
    const text = [title, ...articleTitles, ...articleSources, ...articleUrls]
      .filter(Boolean)
      .join(' | ');
    const trafficWeight = clamp(Math.round(Math.log10(Math.max(approxTraffic, 10)) * 20), 10, 120);
    const weight = Math.max(5, trafficWeight - itemIndex);
    const sportHint = detectLeagueFromText(text);
    const candidate = toAthleteEntityCandidate(title);

    if (!text) {
      return;
    }

    entries.push({
      text,
      weight,
      sportHint,
      entities: candidate ? [candidate] : []
    });
  });

  return entries;
};

const fetchGoogleTrendsJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CardboardMultiverse/1.0)'
    }
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Google Trends request failed (${response.status}).`);
  }

  const normalized = stripGoogleTrendsPrefix(text);
  return JSON.parse(normalized);
};

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '');

const NORMALIZED_ATHLETE_LOOKUP = ATHLETE_POOL.reduce((lookup, name) => {
  lookup.set(normalizeText(name), name);
  return lookup;
}, new Map());

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const looksLikeAthleteName = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/[^a-zA-Z.'\-\s]/.test(trimmed)) {
    return false;
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) {
    return false;
  }

  return parts.every((part) => /^[A-Z][a-zA-Z.'\-]*$/.test(part));
};

const detectLeagueFromText = (value) => {
  const text = normalizeText(value);

  if (/(\bnba\b|basketball|playoffs|finals|celtics|lakers|warriors|knicks|bucks|spurs|mavericks|timberwolves|thunder|nuggets|76ers|sixers|heat|bulls|nets|hawks|pelicans|pistons|hornets|magic|rockets|grizzlies|pacers|clippers|kings|jazz|trail blazers|blazers|cavaliers|cavs|raptors|wizards|suns)/.test(text)) {
    return 'NBA';
  }

  if (/(\bnfl\b|football|super bowl|quarterback|draft|chiefs|bills|ravens|bengals|cowboys|49ers|eagles|packers|vikings|lions|steelers|patriots|jets|giants|saints|falcons|bears|raiders|chargers|rams|seahawks|cardinals|texans|colts|titans|jaguars|panthers|buccaneers|broncos|commanders)/.test(text)) {
    return 'NFL';
  }

  if (/(\bmlb\b|baseball|world series|pitcher|homerun|home run|yankees|mets|red sox|dodgers|cubs|braves|mariners|guardians|astros|phillies|padres|giants|angels|cardinals|rangers|brewers|twins|reds|pirates|orioles|blue jays|diamondbacks|dbacks|rays|athletics|rockies|royals|white sox|tigers|nationals|marlins)/.test(text)) {
    return 'MLB';
  }

  return '';
};

const addScore = (scores, examples, sports, { name, score, text, sport }) => {
  const current = scores.get(name) || 0;
  scores.set(name, current + score);

  if (sport) {
    sports.set(name, sport);
  }

  const athleteExamples = examples.get(name) || [];
  if (text && athleteExamples.length < 3) {
    athleteExamples.push(text.slice(0, 140));
  }
  examples.set(name, athleteExamples);
};

const scoreAthleteMentions = (entries) => {
  const scores = new Map();
  const examples = new Map();
  const sports = new Map();

  ATHLETE_POOL.forEach((name) => {
    scores.set(name, 0);
    examples.set(name, []);
    sports.set(name, ATHLETE_SPORT_LOOKUP.get(name) || '');
  });

  entries.forEach(({ text, weight, sportHint, entities = [] }) => {
    const haystack = normalizeText(text);

    if (sportHint && sportHint !== 'NBA' && sportHint !== 'NFL' && sportHint !== 'MLB') {
      return;
    }

    ATHLETE_POOL.forEach((name) => {
      const needle = normalizeText(name);
      if (!needle || !haystack.includes(needle)) {
        return;
      }

      addScore(scores, examples, sports, {
        name,
        score: weight,
        text,
        sport: ATHLETE_SPORT_LOOKUP.get(name) || sportHint || ''
      });
    });

    entities
      .filter(looksLikeAthleteName)
      .forEach((entityName) => {
        const inferredSport = ATHLETE_SPORT_LOOKUP.get(entityName) || sportHint || '';
        if (!inferredSport || (inferredSport !== 'NBA' && inferredSport !== 'NFL' && inferredSport !== 'MLB')) {
          return;
        }

        addScore(scores, examples, sports, {
          name: entityName,
          score: weight,
          text,
          sport: inferredSport
        });
      });
  });

  return { scores, examples, sports };
};

const buildTrendEntriesFromDaily = (payload) => {
  const days = payload?.default?.trendingSearchesDays || [];
  const entries = [];

  days.forEach((day, dayIndex) => {
    const searches = day?.trendingSearches || [];
    searches.forEach((search, searchIndex) => {
      const title = search?.title?.query || '';
      const related = (search?.relatedQueries || [])
        .map((query) => query?.query)
        .filter(Boolean)
        .join(' | ');
      const articles = (search?.articles || [])
        .map((article) => article?.title)
        .filter(Boolean)
        .join(' | ');
      const text = [title, related, articles].filter(Boolean).join(' | ');
      const weight = Math.max(1, 80 - (dayIndex * 10) - searchIndex);

      if (text) {
        entries.push({ text, weight });
      }
    });
  });

  return entries;
};

const buildTrendEntriesFromRealtime = (payload) => {
  const stories = payload?.storySummaries?.trendingStories || [];
  const entries = [];

  stories.forEach((story, storyIndex) => {
    const title = story?.title || '';
    const entities = Array.isArray(story?.entityNames)
      ? story.entityNames.join(' | ')
      : '';
    const articles = (story?.articles || [])
      .map((article) => article?.title)
      .filter(Boolean)
      .join(' | ');
    const text = [title, entities, articles].filter(Boolean).join(' | ');
    const weight = Math.max(1, 100 - storyIndex);
    const sportHint = detectLeagueFromText(text);

    if (text) {
      entries.push({
        text,
        weight,
        sportHint,
        entities: Array.isArray(story?.entityNames) ? story.entityNames : []
      });
    }
  });

  return entries;
};

const getTopTrendingAthletes = async ({ limit }) => {
  const rssPayload = await fetchGoogleTrendsRss();
  const entries = buildTrendEntriesFromRss(rssPayload);
  const { scores, examples, sports } = scoreAthleteMentions(entries);

  const ranked = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, score], index) => ({
      rank: index + 1,
      name,
      sport: sports.get(name) || ATHLETE_SPORT_LOOKUP.get(name) || 'Unknown',
      score,
      sampleMentions: examples.get(name) || []
    }));

  return ranked;
};

const getBrowseAccessToken = async () => {
  const now = Date.now();
  if (browseTokenCache.token && browseTokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return browseTokenCache.token;
  }

  const credentials = Buffer.from(`${APP_ID}:${CERT_ID}`).toString('base64');
  const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: BROWSE_SCOPE
    })
  });

  const body = await response.json();
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error_description || body?.message || 'Failed to get eBay OAuth token.');
  }

  const expiresInMs = Number(body.expires_in || 7200) * 1000;
  browseTokenCache = {
    token: body.access_token,
    expiresAt: now + expiresInMs
  };

  return browseTokenCache.token;
};

const requestStoreListings = async ({ storeName }) => {
  const accessToken = await getBrowseAccessToken();
  const params = new URLSearchParams({
    limit: '20',
    sort: 'endingSoonest',
    category_ids: '261328',
    filter: `sellers:{${storeName}}`
  });

  const url = `${EBAY_BROWSE_ENDPOINT}?${params.toString()}`;
  console.log('[eBay Proxy] Fetching store listings (Browse API):', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json();
  console.log('[eBay Proxy] Store listings response (Browse API):', JSON.stringify(body, null, 2));

  if (!response.ok) {
    const apiMessage = body?.errors?.[0]?.message || 'eBay Browse API request failed.';
    throw new Error(apiMessage);
  }

  const invalidSellerWarning = (body?.warnings || []).find(
    (warning) => warning?.errorId === 12003
  );

  if (invalidSellerWarning) {
    throw new Error('Invalid eBay seller username for Browse API.');
  }

  const items = body?.itemSummaries || [];
  const listings = items.map((item) => ({
    title: item?.title || '',
    price: Number(item?.price?.value || 0),
    bids: Number(item?.bidCount || 0),
    timeLeft: item?.itemEndDate || '',
    imageUrl: item?.image?.imageUrl || item?.thumbnailImages?.[0]?.imageUrl || '',
    itemUrl: item?.itemWebUrl || '',
    listingType: Array.isArray(item?.buyingOptions) ? item.buyingOptions.join(',') : '',
    watching: 0,
  }));

  return listings;
};

const requestCompletedItems = async ({ player, sport, days }) => {
  const endedFrom = new Date();
  endedFrom.setDate(endedFrom.getDate() - days);

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    'keywords': `${player} ${sport} card`,
    'paginationInput.entriesPerPage': '50',
    'sortOrder': 'EndTimeSoonest',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'EndTimeFrom',
    'itemFilter(1).value': endedFrom.toISOString()
  });

  const url = `${EBAY_FINDING_ENDPOINT}?${params.toString()}`;
  console.log('[eBay Proxy] Fetching:', url);
  const requestBrowseFallback = async () => {
    const accessToken = await getBrowseAccessToken();
    const browseParams = new URLSearchParams({
      q: `${player} ${sport} card`,
      limit: '200',
      category_ids: TRADING_CARDS_CATEGORY_ID
    });

    const browseUrl = `${EBAY_BROWSE_ENDPOINT}?${browseParams.toString()}`;
    console.log('[eBay Proxy] Fetching Browse fallback:', browseUrl);

    const browseResponse = await fetch(browseUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const browseBody = await browseResponse.json();
    if (!browseResponse.ok) {
      const browseError = browseBody?.errors?.[0]?.message || 'eBay Browse API request failed.';
      throw new Error(browseError);
    }

    const prices = (browseBody?.itemSummaries || [])
      .map((item) => Number(item?.price?.value || 0))
      .filter((price) => Number.isFinite(price) && price > 0);

    const sampleCount = prices.length;
    const reportedTotal = Number(browseBody?.total || 0);
    const salesVolume = Number.isFinite(reportedTotal) && reportedTotal > 0
      ? reportedTotal
      : sampleCount;
    const sampleTotalValue = prices.reduce((sum, price) => sum + price, 0);
    const avgPrice = sampleCount > 0 ? Math.round(sampleTotalValue / sampleCount) : 0;
    const totalValue = Math.round(avgPrice * salesVolume);

    return {
      player,
      salesVolume,
      avgPrice,
      totalValue,
      source: 'browse-active-fallback'
    };
  };

  try {
    const response = await fetch(url, {
      headers: {
        'X-EBAY-SOA-SECURITY-APPNAME': APP_ID,
        'X-EBAY-SOA-OPERATION-NAME': 'findCompletedItems',
        'X-EBAY-SOA-SERVICE-VERSION': '1.13.0',
        'X-EBAY-SOA-RESPONSE-DATA-FORMAT': 'JSON'
      }
    });

    const body = await response.json();
    // Diagnostic log: output raw eBay API response
    console.log('[eBay Proxy] API response:', JSON.stringify(body, null, 2));
    const apiPayload = body?.findCompletedItemsResponse?.[0];
    const ack = apiPayload?.ack?.[0];

    if (!response.ok || ack === 'Failure') {
      const apiMessage = apiPayload?.errorMessage?.[0]?.error?.[0]?.message?.[0]
        || 'eBay API request failed.';
      console.error('[eBay Proxy] Full error response:', JSON.stringify(body, null, 2));
      throw new Error(apiMessage);
    }

    const items = apiPayload?.searchResult?.[0]?.item || [];
    const soldPrices = items
      .map((item) => Number(item?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0))
      .filter((price) => Number.isFinite(price) && price > 0);

    const salesVolume = soldPrices.length;
    const totalValue = soldPrices.reduce((sum, price) => sum + price, 0);
    const avgPrice = salesVolume > 0 ? Math.round(totalValue / salesVolume) : 0;

    return {
      player,
      salesVolume,
      avgPrice,
      totalValue: Math.round(totalValue)
    };
  } catch (err) {
    console.error('[eBay Proxy] Finding API failed, trying Browse fallback:', err);
    try {
      return await requestBrowseFallback();
    } catch (fallbackError) {
      console.error('[eBay Proxy] Browse fallback failed:', fallbackError);
      throw err;
    }
  }
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return writeJson(req, res, 204, {});
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
    // Normalize path, including optional Docusaurus baseUrl prefix.
    const normalizedPath = url.pathname.replace(/\/+$/, '').toLowerCase();
    const routePath = (normalizedPath.replace(/^\/cardboard_multiverse(?=\/|$)/, '') || '/').replace(/\/+$/, '');
    const validPaths = new Set([
      '/api/health',
      '/api/api/health',
      '/health',
      '/api/ebay/completed-items',
      '/api/api/ebay/completed-items',
      '/ebay/completed-items',
      '/api/ebay-listings',
      '/api/trends/top-athletes',
      '/api/api/trends/top-athletes',
      '/trends/top-athletes',
    ]);

    // Accept valid paths with or without trailing slash, case-insensitive
    const isValidPath = Array.from(validPaths).some(
      (p) => routePath === p.toLowerCase()
    );

    if (!isValidPath) {
      return writeJson(req, res, 404, { error: 'Route not found' });
    }

  if (routePath === '/api/health' || routePath === '/api/api/health' || routePath === '/health') {
    if (req.method !== 'GET') {
      return writeJson(req, res, 405, { error: 'Method not allowed' });
    }

    return writeJson(req, res, 200, {
      ok: true,
      service: 'ebay-proxy',
      now: new Date().toISOString()
    });
  }

  if (routePath === '/api/trends/top-athletes' || routePath === '/api/api/trends/top-athletes' || routePath === '/trends/top-athletes') {
    if (req.method !== 'GET') {
      return writeJson(req, res, 405, { error: 'Method not allowed' });
    }

    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 5), 1), 10);

    try {
      const athletes = await getTopTrendingAthletes({ limit });
      return writeJson(req, res, 200, {
        athletes,
        generatedAt: new Date().toISOString(),
        source: 'google-trends'
      });
    } catch (error) {
      return writeJson(req, res, 502, {
        error: error instanceof Error ? error.message : 'Failed to fetch Google Trends data.'
      });
    }
  }

  if (!APP_ID || !DEV_ID || !CERT_ID) {
    return writeJson(req, res, 500, {
      error: 'Missing eBay credentials. Set EBAY_APP_ID, EBAY_DEV_ID, and EBAY_CERT_ID in .env.local or environment variables.'
    });
  }

  // Handle store listings endpoint
  if (routePath === '/api/ebay-listings') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return writeJson(req, res, 405, { error: 'Method not allowed' });
    }

    const storeName = url.searchParams.get('storeName') || url.searchParams.get('username') || '';

    // For POST requests, read username from body
    const getStoreName = async () => {
      if (req.method === 'POST') {
        return new Promise((resolve) => {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              resolve(parsed.username || parsed.storeName || storeName);
            } catch {
              resolve(storeName);
            }
          });
        });
      }
      return storeName;
    };

    const resolvedStoreName = await getStoreName();
    if (!resolvedStoreName) {
      return writeJson(req, res, 400, { error: 'Missing storeName or username parameter' });
    }

    try {
      const listings = await requestStoreListings({ storeName: resolvedStoreName });
      return writeJson(req, res, 200, { listings });
    } catch (error) {
      return writeJson(req, res, 502, {
        error: error instanceof Error ? error.message : 'Failed to fetch store listings from eBay.'
      });
    }
  }

  // Remaining routes require GET
  if (req.method !== 'GET') {
    return writeJson(req, res, 405, { error: 'Method not allowed' });
  }

  const player = url.searchParams.get('player') || '';
  const sport = url.searchParams.get('sport') || '';
  const days = Number(url.searchParams.get('days') || 7);

  if (!player || !sport || !Number.isFinite(days) || days <= 0) {
    return writeJson(req, res, 400, { error: 'Invalid query. Required: player, sport, days.' });
  }

  try {
    const result = await requestCompletedItems({ player, sport, days });
    return writeJson(req, res, 200, result);
  } catch (error) {
    return writeJson(req, res, 502, {
      error: error instanceof Error ? error.message : 'Failed to fetch data from eBay.'
    });
  }
});

server.listen(PORT, () => {
  console.log(`eBay proxy listening on http://localhost:${PORT}`);
});
