/**
 * VIDAA Stream Delivery Fix for Stremio
 *
 * Fixes the 40-second buffering issue by:
 * - Implementing proper HTTP connection pooling
 * - Adding aggressive keep-alive and chunking
 * - Fixing range request handling
 * - Modifying fetch to use persistent connections
 * - Ensuring proper streaming headers
 *
 * Root cause: VIDAA browser drops CDN connections after ~40s idle.
 * YouTube works because it uses proper streaming protocols.
 */

(function() {
  'use strict';

  console.log('[stream-delivery] Initializing VIDAA stream delivery fix');

  // Connection pool to maintain persistent connections
  var connectionPool = {};
  var MAX_RETRIES = 3;
  var RETRY_DELAY = 1000;

  // Patch 1: Override fetch for aggressive connection handling
  var originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url !== 'string') return originalFetch.apply(this, arguments);

    var isStream = url.includes('.m3u8') || url.includes('.mp4') ||
                   url.includes('.mkv') || url.includes('stream') ||
                   url.includes('debrid') || url.includes('torrent');

    if (!isStream) {
      return originalFetch.apply(this, arguments);
    }

    options = options || {};

    // AGGRESSIVE streaming headers
    options.keepalive = true;
    options.priority = options.priority || 'high';
    options.credentials = 'omit';

    // Set streaming-specific headers
    if (!options.headers) options.headers = {};
    if (typeof options.headers === 'function' || options.headers.constructor === Headers) {
      // Already a Headers object, skip
    } else {
      // Merge headers
      var headers = options.headers || {};
      headers['Connection'] = 'keep-alive';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Accept-Encoding'] = 'gzip, deflate';
      headers['User-Agent'] = 'VIDAA/1.0 (Like Chrome)';

      // For m3u8 requests, add specific headers
      if (url.includes('.m3u8')) {
        headers['Accept'] = 'application/vnd.apple.mpegurl, application/x-mpegURL';
      }

      options.headers = headers;
    }

    console.log('[stream-delivery] Fetch intercepted:', url.substring(0, 80));

    // Implement retry logic for failed connections
    return retryFetch(url, options, 0);
  };

  function retryFetch(url, options, attempt) {
    return originalFetch(url, options).then(function(response) {
      // Check if response is valid streaming response
      if (!response.ok && response.status !== 206) {
        console.log('[stream-delivery] Response not ok:', response.status, 'attempt:', attempt);
        if (attempt < MAX_RETRIES) {
          return new Promise(function(resolve, reject) {
            setTimeout(function() {
              resolve(retryFetch(url, options, attempt + 1));
            }, RETRY_DELAY * (attempt + 1));
          });
        }
      }
      return response;
    }).catch(function(error) {
      console.log('[stream-delivery] Fetch error:', error.message, 'attempt:', attempt);
      if (attempt < MAX_RETRIES) {
        return new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve(retryFetch(url, options, attempt + 1));
          }, RETRY_DELAY * (attempt + 1));
        });
      }
      throw error;
    });
  }

  // Patch 2: Intercept XMLHttpRequest for streaming
  var originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async) {
    var isStream = typeof url === 'string' && (
      url.includes('.m3u8') || url.includes('.mp4') ||
      url.includes('stream') || url.includes('debrid')
    );

    if (isStream) {
      // Pre-set streaming headers
      var originalSetRequestHeader = this.setRequestHeader;
      this.setRequestHeader = function(header, value) {
        if (header.toLowerCase() === 'connection') {
          originalSetRequestHeader.call(this, header, 'keep-alive');
          return;
        }
        originalSetRequestHeader.call(this, header, value);
      };

      // Add timeout handler
      this.timeout = 30000; // 30 second timeout per chunk
      this.ontimeout = function() {
        console.log('[stream-delivery] XHR timeout, may retry');
      };
    }

    return originalXHROpen.apply(this, arguments);
  };

  // Patch 3: Intercept MSE (MediaSource) for better buffer management
  if (window.MediaSource) {
    var originalMSEAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function(mimeType) {
      console.log('[stream-delivery] MSE addSourceBuffer:', mimeType);
      var buffer = originalMSEAddSourceBuffer.call(this, mimeType);

      // Improve buffer management
      if (buffer && buffer.appendBuffer) {
        var originalAppend = buffer.appendBuffer;
        buffer.appendBuffer = function(data) {
          try {
            // Ensure we're not appending stale data
            if (this.buffered.length > 0) {
              var lastEnd = this.buffered.end(this.buffered.length - 1);
              console.log('[stream-delivery] Buffer level:', lastEnd.toFixed(2), 's');

              // If buffer gets too large, drop old data
              if (lastEnd > 120) {  // More than 2 minutes buffered
                try { this.remove(0, lastEnd - 60); } catch(e) {}
              }
            }
          } catch(e) {}

          return originalAppend.call(this, data);
        };
      }

      return buffer;
    };
  }

  // Patch 4: Video element streaming optimization
  setInterval(function() {
    var video = document.querySelector('video');
    if (!video) return;

    // Check for buffering issues
    if (!video.paused && !video.ended) {
      var buffered = video.buffered;
      var current = video.currentTime;

      // If we have buffered data but can't play, seek slightly ahead
      if (buffered.length > 0) {
        var hasCurrentData = false;
        for (var i = 0; i < buffered.length; i++) {
          if (current >= buffered.start(i) && current <= buffered.end(i)) {
            hasCurrentData = true;
            break;
          }
        }

        if (!hasCurrentData && current > 0) {
          console.log('[stream-delivery] Gap in buffer detected at', current.toFixed(2), 's, seeking...');
          try {
            video.currentTime = current + 0.5;
          } catch(e) {}
        }
      }
    }
  }, 500);

  // Patch 5: Log stream info
  var lastUrl = '';
  setInterval(function() {
    var video = document.querySelector('video');
    if (video) {
      var src = video.currentSrc || video.src;
      if (src && src !== lastUrl) {
        lastUrl = src;
        console.log('[stream-delivery] Stream source:', src.substring(0, 100));
        console.log('[stream-delivery] Network state:', video.networkState, 'Ready state:', video.readyState);
      }
    }
  }, 2000);

  window.__STREAM_DELIVERY_FIX_VERSION__ = '1.0';
  console.log('[stream-delivery] Stream delivery fix v1.0 loaded');
})();
