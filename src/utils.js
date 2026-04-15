/**
 * Converts Google Drive/Photos URLs to a direct image URL usable in <img> tags.
 *
 * IMPORTANT: Google Drive file must have "Anyone with the link" sharing permission.
 *
 * Supported formats:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://docs.google.com/uc?export=download&id=FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 * - Direct image URLs (returned as-is)
 */
export function getDirectImageUrl(url) {
  if (!url) return '';

  const trimmedUrl = url.trim();

  // Pattern 1: docs.google.com/uc?export=download&id=FILE_ID (user's current format)
  const ucMatch = trimmedUrl.match(/docs\.google\.com\/uc\?.*?[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (ucMatch) {
    const fileId = ucMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Pattern 2: drive.google.com/file/d/FILE_ID/view
  const driveMatch = trimmedUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Pattern 3: drive.google.com/open?id=FILE_ID
  const openMatch = trimmedUrl.match(/drive\.google\.com\/open\?.*?[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (openMatch) {
    const fileId = openMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Pattern 4: Already a direct uc?export=view URL - return as-is
  if (trimmedUrl.includes('drive.google.com/uc?export=view')) {
    return trimmedUrl;
  }

  // Google Photos - cannot be embedded in img tags
  if (trimmedUrl.includes('photos.google.com') || trimmedUrl.includes('photos.app.goo.gl')) {
    console.warn('[getDirectImageUrl] Google Photos links cannot be embedded. Use Google Drive.');
    return '';
  }

  // Return as-is for other URLs (direct .jpg/.png/.webp links)
  return trimmedUrl;
}

// Inline SVG placeholder with Om symbol (no external dependency)
export const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22150%22 viewBox=%220 0 150 150%22%3E%3Crect width=%22150%22 height=%22150%22 fill=%22%234A0000%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23D4A017%22 font-size=%2248%22 text-anchor=%22middle%22 dominant-baseline=%22central%22%3E%E0%A5%90%3C/text%3E%3C/svg%3E';
