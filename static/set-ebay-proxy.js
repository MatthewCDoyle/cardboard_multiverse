// This script derives a usable eBay proxy URL for local and Codespaces sessions.
(function() {
  var STORAGE_KEY = 'sports-card-tracker-proxy-url';

  function normalizeUrl(value) {
    return typeof value === 'string' && value.trim() ? value.trim().replace(/\/$/, '') : '';
  }

  function getCodespaceRoot(host) {
    return typeof host === 'string'
      ? host.replace(/-\d+\.app\.github\.dev$/, '')
      : '';
  }

  function deriveProxyUrl(host, protocol) {
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8787';
    }

    if (/\.app\.github\.dev$/.test(host)) {
      return protocol + '//' + host.replace(/-\d+\.app\.github\.dev$/, '-8787.app.github.dev');
    }

    return '';
  }

  function canReuseSavedUrl(savedUrl, host) {
    if (!savedUrl) {
      return false;
    }

    try {
      var parsed = new URL(savedUrl);
      var savedHost = parsed.hostname;

      if (host === 'localhost' || host === '127.0.0.1') {
        return savedHost === 'localhost' || savedHost === '127.0.0.1';
      }

      if (/\.app\.github\.dev$/.test(host)) {
        return /\.app\.github\.dev$/.test(savedHost) && getCodespaceRoot(savedHost) === getCodespaceRoot(host);
      }
    } catch {
      return false;
    }

    return false;
  }

  if (typeof window === 'undefined') {
    return;
  }

  var host = window.location.hostname;
  var protocol = window.location.protocol;
  var derivedProxyUrl = deriveProxyUrl(host, protocol);
  var existing = normalizeUrl(window.__EBAY_PROXY_URL__);

  if (existing && canReuseSavedUrl(existing, host)) {
    return;
  }

  try {
    var saved = normalizeUrl(window.localStorage.getItem(STORAGE_KEY));
    if (canReuseSavedUrl(saved, host)) {
      window.__EBAY_PROXY_URL__ = saved;
      return;
    }
  } catch {
    // Ignore storage errors.
  }

  if (derivedProxyUrl) {
    window.__EBAY_PROXY_URL__ = derivedProxyUrl;
  }
})();
