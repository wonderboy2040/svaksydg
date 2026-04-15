/**
 * Converts Google Drive URLs to direct image URLs for <img> tags.
 *
 * SUPPORTED FORMATS:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://docs.google.com/uc?export=download&id=FILE_ID
 * - https://docs.google.com/uc?export=view&id=FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 * - https://lh3.googleusercontent.com/d/FILE_ID
 * - Direct image URLs (.jpg, .png, .webp, etc.)
 *
 * NOTE: Google Drive file MUST have "Anyone with the link" sharing permission.
 */
export function getDirectImageUrl(url) {
  if (!url) return '';

  const trimmedUrl = url.trim();

  // Already an lh3.googleusercontent.com CDN URL
  const lh3Match = trimmedUrl.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
  if (lh3Match) return trimmedUrl;

  // docs.google.com/uc?export=download&id=FILE_ID (user's format)
  // docs.google.com/uc?export=view&id=FILE_ID
  const ucMatch = trimmedUrl.match(/docs\.google\.com\/uc\?.*?[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (ucMatch) {
    const fileId = ucMatch[1];
    // Use lh3 CDN - most reliable for embedding
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

  // Google Photos - cannot be embedded
  if (trimmedUrl.includes('photos.google.com') || trimmedUrl.includes('photos.app.goo.gl')) {
    console.warn('[SVAKS] Google Photos cannot be embedded. Use Google Drive.');
    return '';
  }

  // Return as-is (direct image URL)
  return trimmedUrl;
}

// Inline SVG placeholder with Om symbol (no external dependency needed)
export const PLACEHOLDER_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">' +
  '<rect width="150" height="150" fill="#4A0000"/>' +
  '<text x="50%" y="50%" fill="#D4A017" font-size="48" text-anchor="middle" dominant-baseline="central">ॐ</text>' +
  '</svg>'
);
