export function getDirectImageUrl(url) {
  if (!url) return '';

  const trimmedUrl = url.trim();

  // Google Drive: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const driveMatch = trimmedUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Google Photos: https://photos.google.com/lr/photo/FILE_ID or similar
  const photosMatch = trimmedUrl.match(/photos\.google\.com\/.*?\/photo\/([a-zA-Z0-9_-]+)/);
  if (photosMatch) {
    const fileId = photosMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // Google Photos share links (new format)
  const photosNewMatch = trimmedUrl.match(/photos\.app\.google\.com\/([a-zA-Z0-9_-]+)/);
  if (photosNewMatch) {
    console.warn('Google Photos share links cannot be directly embedded. Please use Google Drive.');
    return trimmedUrl;
  }

  // Already a direct link or other URL
  return trimmedUrl;
}

export const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/150?text=No+Image';
