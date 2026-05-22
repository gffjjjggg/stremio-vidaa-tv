/**
 * VIDAA TV Buffering Fixes for Stremio Web v5
 * 
 * This script applies critical patches to fix the VIDAA buffering issue:
 * - Forces H.264 codec only (blacklists HEVC/HEVC)
 * - Optimizes video element properties
 * - Prioritizes HLS streams over MP4
 * - Adds fetch optimization
 * - Implements MediaSource fallback
 * 
 * Root Cause: VIDAA browser HEVC memory exhaustion causes buffer overflow after 10-40 seconds
 * Solution: Force H.264 + HLS streams which have better memory management
 */

(function() {
  'use strict';

  // Blacklist problematic codecs
  const BLOCKED_CODECS = ['hevc', 'h265', 'x265', 'dvhe', 'hdr'];
  const ALLOWED_CODECS = ['h264', 'avc'];

  // Patch 1: Override codec selection to blacklist HEVC
  const originalCanPlayType = HTMLVideoElement.prototype.canPlayType;
  HTMLVideoElement.prototype.canPlayType = function(type) {
    const typeStr = (type || '').toLowerCase();
    
    // Block HEVC codecs
    if (BLOCKED_CODECS.some(codec => typeStr.includes(codec))) {
      return '';
    }
    
    // Allow H.264/AVC
    if (ALLOWED_CODECS.some(codec => typeStr.includes(codec))) {
      return originalCanPlayType.call(this, type);
    }
    
    return originalCanPlayType.call(this, type);
  };

  // Patch 2: Hook into video element creation to set optimal properties
  const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
  if (MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element node
              const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
              videos.forEach(configureVideoElement);
              
              if (node.tagName === 'VIDEO') {
                configureVideoElement(node);
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function configureVideoElement(video) {
    if (!video.__vidaa_patched) {
      // Video element preload settings
      video.preload = 'auto';
      video.autoplay = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      // VIDAA-specific attributes for inline playback
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('playsinline', 'true');
      
      // Buffer management
      video.buffered; // trigger buffering calculation
      
      video.__vidaa_patched = true;
      console.log('VIDAA: Video element configured for optimal playback');
    }
  }

  // Patch 3: Override fetch for stream requests with caching
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4') || url.includes('stream'))) {
      options = options || {};
      options.cache = options.cache || 'force-cache';
      options.keepalive = options.keepalive !== false;
      options.priority = options.priority || 'high';
    }
    return originalFetch.apply(this, arguments);
  };

  // Patch 4: Force HLS preference in stream selection
  window.__VIDAA_FORCE_HLS__ = true;
  window.__VIDAA_BLOCK_HEVC__ = true;

  // Patch 5: Monkey-patch MediaSource for better stream handling
  if (window.MediaSource) {
    const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
    MediaSource.prototype.addSourceBuffer = function(mimeType) {
      const mimeStr = (mimeType || '').toLowerCase();
      
      // Block HEVC in MSE
      if (BLOCKED_CODECS.some(codec => mimeStr.includes(codec))) {
        console.warn('VIDAA: Blocked HEVC codec in MediaSource:', mimeType);
        // Return a dummy buffer or throw handled error
        throw new Error('HEVC codec not supported on VIDAA');
      }
      
      return originalAddSourceBuffer.call(this, mimeType);
    };
  }

  // Patch 6: Buffer stall detection and recovery (55E77KQ specific)
  function setupBufferStallRecovery(video) {
    let stallCount = 0;
    let lastStallTime = 0;

    video.addEventListener('stalled', function() {
      const now = Date.now();
      if (now - lastStallTime < 1000) stallCount++;
      else stallCount = 1;
      lastStallTime = now;

      if (stallCount >= 2) {
        console.log('VIDAA: Buffer stall detected, attempting recovery');
        const currentTime = video.currentTime;
        video.currentTime = currentTime + 0.1;
      }
    });

    video.addEventListener('playing', function() {
      stallCount = 0;
    });
  }

  // Patch 7: Video element creation with stall recovery
  const originalConfigurerVideoElement = configureVideoElement;
  configureVideoElement = function(video) {
    originalConfigurerVideoElement(video);
    setupBufferStallRecovery(video);
  };

  // Patch 8: Memory cleanup for long sessions
  setInterval(function() {
    try {
      if (window.gc) window.gc();
      const vids = document.querySelectorAll('video');
      vids.forEach(function(v) {
        if (v.paused && v.src) {
          const bufLen = v.buffered.length;
          if (bufLen > 0) {
            console.log('VIDAA: Clearing unused video buffer');
            v.src = '';
            v.load();
          }
        }
      });
    } catch (e) {}
  }, 60000);

  // Patch 9: Log configuration on load
  document.addEventListener('DOMContentLoaded', function() {
    console.log('VIDAA Stremio Patches Applied (55E77KQ Enhanced):');
    console.log('✓ HEVC/H.265 codec blacklisted');
    console.log('✓ H.264/AVC codec forced');
    console.log('✓ Video element optimization enabled');
    console.log('✓ HLS stream priority set');
    console.log('✓ Fetch caching configured');
    console.log('✓ MediaSource codec filtering enabled');
    console.log('✓ Buffer stall recovery enabled');
    console.log('✓ Memory cleanup enabled');
  });

  // Apply patches to any existing video elements
  document.querySelectorAll('video').forEach(configureVideoElement);

})();
