// Cloud Configuration
// Hardcoded values for complete setup bypass and direct access
// URL and PIN are globally defined here

export const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbxfHoBOTcj8iqrg5YFXggGs_bkkfAxFomtZo0GoQLxeZceGWc003jwY9X80Kd-9RNjxfA/exec';
export const ADMIN_PIN = '1234';

// Sync Configuration
export const SYNC_INTERVAL = 3000; // 3 seconds for real-time sync
export const INITIAL_LOAD_DELAY = 500; // Faster initial load
export const MAX_RETRY_ATTEMPTS = 5; // Max retries for failed syncs

// How auto-connect works:
// App immediately connects to CLOUD_URL on boot.
// It bypasses the Setup Wizard, fetches real-time data, and seamlessly syncs changes directly.
