/**
 * Converts Google Drive / Google Photos URLs to direct image URLs for <img> tags.
 *
 * SUPPORTED FORMATS:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://docs.google.com/uc?export=download&id=FILE_ID
 * - https://docs.google.com/uc?export=view&id=FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 * - https://lh3.googleusercontent.com/d/FILE_ID
 * - https://photos.google.com/photo/FILE_ID (best-effort)
 * - https://photos.app.goo.gl/SHORTCODE (shows warning)
 * - Direct image URLs (.jpg, .png, .webp, etc.)
 *
 * NOTE: Google Drive file MUST have "Anyone with the link" sharing permission.
 * Google Photos links have limited embedding support — use Google Drive for best results.
 */
export function getDirectImageUrl(url) {
  if (!url) return '';

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return '';

  // Already an lh3.googleusercontent.com CDN URL
  const lh3Match = trimmedUrl.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
  if (lh3Match) return trimmedUrl;

  // lh3.googleusercontent.com without /d/ path (Google Photos shared)
  if (trimmedUrl.includes('lh3.googleusercontent.com')) return trimmedUrl;

  // docs.google.com/uc?export=download&id=FILE_ID (user's format)
  // docs.google.com/uc?export=view&id=FILE_ID
  const ucMatch = trimmedUrl.match(/docs\.google\.com\/uc\?.*?[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (ucMatch) {
    const fileId = ucMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // drive.google.com/file/d/FILE_ID/view
  const driveMatch = trimmedUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // drive.google.com/open?id=FILE_ID
  const openMatch = trimmedUrl.match(/drive\.google\.com\/open\?.*?[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (openMatch) {
    const fileId = openMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // Google Photos — attempt to extract file ID for embedding
  // photos.google.com/photo/AF1... or photos.google.com/share/...
  if (trimmedUrl.includes('photos.google.com')) {
    // Try to extract photo ID from URL
    const photoIdMatch = trimmedUrl.match(/photo\/([a-zA-Z0-9_-]{20,})/);
    if (photoIdMatch) {
      // Best-effort: use lh3 CDN with photo ID
      return `https://lh3.googleusercontent.com/${photoIdMatch[1]}`;
    }
    // For album/share links, we can't embed — return URL as-is for user to see
    console.warn('[SVAKS] Google Photos album/share links have limited embedding. Use Google Drive for reliable photos.');
    return trimmedUrl;
  }

  // Google Photos short link — can't resolve without redirect follow
  if (trimmedUrl.includes('photos.app.goo.gl')) {
    console.warn('[SVAKS] Google Photos short links cannot be embedded directly. Use the full Google Drive link instead.');
    return trimmedUrl;
  }

  // Return as-is (direct image URL)
  return trimmedUrl;
}

/**
 * Validates if a URL looks like a valid Google Drive or direct image link
 * Returns { valid: boolean, type: 'drive' | 'photos' | 'direct' | 'unknown', message: string }
 */
export function validateImageUrl(url) {
  if (!url || !url.trim()) {
    return { valid: false, type: 'unknown', message: 'URL is empty' };
  }

  const trimmed = url.trim();

  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com/uc')) {
    return { valid: true, type: 'drive', message: '✅ Google Drive link detected — will embed correctly' };
  }

  if (trimmed.includes('lh3.googleusercontent.com')) {
    return { valid: true, type: 'drive', message: '✅ Google CDN link — will embed correctly' };
  }

  if (trimmed.includes('photos.google.com') || trimmed.includes('photos.app.goo.gl')) {
    return { valid: true, type: 'photos', message: '⚠️ Google Photos link — embedding may not work. Use Google Drive for best results.' };
  }

  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(trimmed)) {
    return { valid: true, type: 'direct', message: '✅ Direct image URL detected' };
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { valid: true, type: 'unknown', message: 'ℹ️ URL detected — preview may vary' };
  }

  return { valid: false, type: 'unknown', message: '❌ Invalid URL format' };
}

// Inline SVG placeholder with Om symbol (no external dependency needed)
export const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">' +
  '<rect width="150" height="150" fill="#4A0000"/>' +
  '<text x="50%" y="50%" fill="#D4A017" font-size="48" text-anchor="middle" dominant-baseline="central">ॐ</text>' +
  '</svg>'
);
