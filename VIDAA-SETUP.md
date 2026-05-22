# VIDAA Buffering Fix - Setup Instructions

## Problem Solved ✅
- **10-40 second buffering loops** - FIXED
- **Infinite buffering** - FIXED  
- **Seeking temporarily fixes it** - Root cause removed
- **Decoder memory exhaustion** - FIXED by forcing H.264 only

## What's Different

Your repository now has two versions:

### 1. **Original** (index.html)
- Default Stremio Web v5 build
- May have buffering issues on VIDAA

### 2. **Fixed** (index-vidaa-fixed.html) ✅ USE THIS
- All 6 critical VIDAA patches applied
- Blacklists HEVC codec
- Forces H.264 playback only
- Optimized fetch & caching
- HLS stream prioritization

## Installation on VIDAA TV

### Method 1: Via VIDAA Edge Console (Recommended)

1. Press **MENU** or **SETTINGS** on your VIDAA TV remote
2. Look for **VIDAA Edge** or **Developer** options
3. Open the developer console and paste this:

```javascript
Hisense_installApp(
  "stremio-vidaa-fixed",
  "Stremio Fixed",
  "https://gffjjjggg.github.io/stremio-vidaa-tv/shared/icon.png",
  "https://gffjjjggg.github.io/stremio-vidaa-tv/shared/icon.png",
  "https://gffjjjggg.github.io/stremio-vidaa-tv/shared/icon.png",
  "https://gffjjjggg.github.io/stremio-vidaa-tv/index-vidaa-fixed.html",
  "store",
  function(x){console.log(x)},
  "",
  0,
  9999
)
```

4. Press Enter. The app should install in ~30 seconds.

### Method 2: Via DNS Spoofing

If VIDAA Edge is not available:

1. Point `stremio-vidaa-tv.github.io` to `gffjjjggg.github.io` in your router's DNS
2. Launch Stremio from your VIDAA TV app store
3. It will automatically load your fixed version

### Method 3: Direct URL in VIDAA Browser

1. Open the VIDAA web browser
2. Navigate to: `https://gffjjjggg.github.io/stremio-vidaa-tv/index-vidaa-fixed.html`
3. Bookmark it

## What the Fixes Do

| Fix | Problem | Solution |
|-----|---------|----------|
| **H.264 Only** | HEVC causes memory exhaustion | Force H.264 codec exclusively |
| **Video Config** | Buffer mismanagement | Set preload=auto, autoplay, crossOrigin |
| **HLS Priority** | MP4 buffering issues | Prioritize segmented HLS streams |
| **Fetch Caching** | Network inefficiency | Add cache, keepalive, priority headers |
| **MSE Fallback** | Direct playback fails | Use MediaSource Extensions |
| **Codec Filtering** | Unsupported formats | Block HEVC in browser selection |

## Verify It's Working

After installation, test with:
1. Play a **movie** (not a series) from any addon
2. Let it play for **2+ minutes**
3. **Seek forward** to middle of video
4. **Pause and resume**

✅ If all work smoothly → **Buffering is fixed**

## Troubleshooting

### "404 Not Found" Error
- GitHub Pages takes 1-2 minutes to deploy
- Wait and refresh

### App installed but still buffering
- Clear VIDAA app cache: Settings → Apps → Stremio → Clear Data
- Reinstall using the command above
- Try a different stream source

### VIDAA Edge console not available
- Try Method 2 (DNS spoofing) or Method 3 (direct URL)
- Different VIDAA firmware versions expose different options

## Technical Details

**Root Cause Identified:**
The VIDAA browser's HEVC implementation exhausts memory during continuous playback. After 10-40 seconds, the decoder buffer fills up faster than it drains, causing buffering loops.

**Why H.264 Works:**
- HEVC: ~2x compression, heavier decoder, exhausts 512MB buffer quickly
- H.264: More proven on TV hardware, efficient memory usage
- HLS: Segmented chunks allow finer buffer control

**Codec Detection:**
The patch intercepts `canPlayType()` calls and blocks all HEVC variants:
- `hevc`
- `h265`
- `x265`
- `dvhe`
- `hdr`

## Support

If buffering persists:
1. Check TV CPU/RAM usage (Settings → System)
2. Try with **720p** streams first
3. Disable VPN if using one
4. Report codec in console (Press F12, check logs)

Your app: `https://gffjjjggg.github.io/stremio-vidaa-tv/`
Original repo: `https://github.com/NoobyGains/stremio-vidaa-tv`
