const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.EBAY_PROXY_PORT || 8787);
// Use live eBay Finding API endpoint for real data
const EBAY_FINDING_ENDPOINT = process.env.EBAY_FINDING_ENDPOINT || 'https://svcs.ebay.com/services/search/FindingService/v1';

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
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
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
    console.error('[eBay Proxy] Error fetching from eBay:', err);
    throw err;
  }
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return writeJson(req, res, 204, {});
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
    // Normalize path: remove trailing slashes and make lowercase
    const normalizedPath = url.pathname.replace(/\/+$/, '').toLowerCase();
    const validPaths = new Set([
      '/api/ebay/completed-items',
      '/api/api/ebay/completed-items',
      '/ebay/completed-items'
    ]);

    // Accept valid paths with or without trailing slash, case-insensitive
    const isValidPath = Array.from(validPaths).some(
      (p) => normalizedPath === p.toLowerCase()
    );

    if (req.method !== 'GET' || !isValidPath) {
      return writeJson(req, res, 404, { error: 'Route not found' });
    }

  if (!APP_ID || !DEV_ID || !CERT_ID) {
    return writeJson(req, res, 500, {
      error: 'Missing eBay credentials. Set EBAY_APP_ID, EBAY_DEV_ID, and EBAY_CERT_ID in .env.local or environment variables.'
    });
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
