// Cloudflare Worker port of server/ebay-proxy.js.
// Serves eBay + Google Trends data for the Cardboard Multiverse card tracker
// with the same routes and response shapes as the local dev proxy.

const DEFAULT_EBAY_FINDING_ENDPOINT = 'https://svcs.ebay.com/services/search/FindingService/v1';
const DEFAULT_EBAY_BROWSE_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
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

const BROWSE_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
// Module-scope cache persists across requests on the same isolate.
let browseTokenCache = {
  token: '',
  expiresAt: 0
};

const corsHeaders = (request) => {
  const requestOrigin = request.headers.get('Origin');
  const allowOrigin = typeof requestOrigin === 'string' && requestOrigin.length > 0
    ? requestOrigin
    : '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
};

const writeJson = (request, statusCode, payload) => new Response(JSON.stringify(payload), {
  status: statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...corsHeaders(request)
  }
});

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

const normalizeText = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '');

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

const getBrowseAccessToken = async (env) => {
  const now = Date.now();
  if (browseTokenCache.token && browseTokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS > now) {
    return browseTokenCache.token;
  }

  const credentials = btoa(`${env.EBAY_APP_ID}:${env.EBAY_CERT_ID}`);
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

const requestStoreListings = async (env, { storeName }) => {
  const browseEndpoint = env.EBAY_BROWSE_ENDPOINT || DEFAULT_EBAY_BROWSE_ENDPOINT;
  const accessToken = await getBrowseAccessToken(env);
  const params = new URLSearchParams({
    limit: '20',
    sort: 'endingSoonest',
    category_ids: '261328',
    filter: `sellers:{${storeName}}`
  });

  const url = `${browseEndpoint}?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json();

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

const requestCompletedItems = async (env, { player, sport, days }) => {
  const findingEndpoint = env.EBAY_FINDING_ENDPOINT || DEFAULT_EBAY_FINDING_ENDPOINT;
  const browseEndpoint = env.EBAY_BROWSE_ENDPOINT || DEFAULT_EBAY_BROWSE_ENDPOINT;
  const endedFrom = new Date();
  endedFrom.setDate(endedFrom.getDate() - days);

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': env.EBAY_APP_ID,
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

  const url = `${findingEndpoint}?${params.toString()}`;

  const requestBrowseFallback = async () => {
    const accessToken = await getBrowseAccessToken(env);
    const browseParams = new URLSearchParams({
      q: `${player} ${sport} card`,
      limit: '200',
      category_ids: TRADING_CARDS_CATEGORY_ID
    });

    const browseUrl = `${browseEndpoint}?${browseParams.toString()}`;
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
        'X-EBAY-SOA-SECURITY-APPNAME': env.EBAY_APP_ID,
        'X-EBAY-SOA-OPERATION-NAME': 'findCompletedItems',
        'X-EBAY-SOA-SERVICE-VERSION': '1.13.0',
        'X-EBAY-SOA-RESPONSE-DATA-FORMAT': 'JSON'
      }
    });

    const body = await response.json();
    const apiPayload = body?.findCompletedItemsResponse?.[0];
    const ack = apiPayload?.ack?.[0];

    if (!response.ok || ack === 'Failure') {
      const apiMessage = apiPayload?.errorMessage?.[0]?.error?.[0]?.message?.[0]
        || 'eBay API request failed.';
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

const handleRequest = async (request, env) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);
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
    return writeJson(request, 404, { error: 'Route not found' });
  }

  if (routePath === '/api/health' || routePath === '/api/api/health' || routePath === '/health') {
    if (request.method !== 'GET') {
      return writeJson(request, 405, { error: 'Method not allowed' });
    }

    return writeJson(request, 200, {
      ok: true,
      service: 'ebay-proxy',
      now: new Date().toISOString()
    });
  }

  if (routePath === '/api/trends/top-athletes' || routePath === '/api/api/trends/top-athletes' || routePath === '/trends/top-athletes') {
    if (request.method !== 'GET') {
      return writeJson(request, 405, { error: 'Method not allowed' });
    }

    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 5), 1), 10);

    try {
      const athletes = await getTopTrendingAthletes({ limit });
      return writeJson(request, 200, {
        athletes,
        generatedAt: new Date().toISOString(),
        source: 'google-trends'
      });
    } catch (error) {
      return writeJson(request, 502, {
        error: error instanceof Error ? error.message : 'Failed to fetch Google Trends data.'
      });
    }
  }

  if (!env.EBAY_APP_ID || !env.EBAY_DEV_ID || !env.EBAY_CERT_ID) {
    return writeJson(request, 500, {
      error: 'Missing eBay credentials. Set EBAY_APP_ID, EBAY_DEV_ID, and EBAY_CERT_ID as worker secrets.'
    });
  }

  // Handle store listings endpoint
  if (routePath === '/api/ebay-listings') {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return writeJson(request, 405, { error: 'Method not allowed' });
    }

    const storeName = url.searchParams.get('storeName') || url.searchParams.get('username') || '';

    let resolvedStoreName = storeName;
    if (request.method === 'POST') {
      const parsed = await request.json().catch(() => null);
      if (parsed && typeof parsed === 'object') {
        resolvedStoreName = parsed.username || parsed.storeName || storeName;
      }
    }

    if (!resolvedStoreName) {
      return writeJson(request, 400, { error: 'Missing storeName or username parameter' });
    }

    try {
      const listings = await requestStoreListings(env, { storeName: resolvedStoreName });
      return writeJson(request, 200, { listings });
    } catch (error) {
      return writeJson(request, 502, {
        error: error instanceof Error ? error.message : 'Failed to fetch store listings from eBay.'
      });
    }
  }

  // Remaining routes require GET
  if (request.method !== 'GET') {
    return writeJson(request, 405, { error: 'Method not allowed' });
  }

  const player = url.searchParams.get('player') || '';
  const sport = url.searchParams.get('sport') || '';
  const days = Number(url.searchParams.get('days') || 7);

  if (!player || !sport || !Number.isFinite(days) || days <= 0) {
    return writeJson(request, 400, { error: 'Invalid query. Required: player, sport, days.' });
  }

  try {
    const result = await requestCompletedItems(env, { player, sport, days });
    return writeJson(request, 200, result);
  } catch (error) {
    return writeJson(request, 502, {
      error: error instanceof Error ? error.message : 'Failed to fetch data from eBay.'
    });
  }
};

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
