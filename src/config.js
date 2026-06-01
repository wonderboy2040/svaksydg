// ===========================================
// SVAKS Configuration - Advanced Pro Level
// ===========================================

// IMPORTANT: Change the PIN below for security!
// Default PIN: 1234 (Change this in production)
export const ADMIN_PIN = '1234';

// Cloud URL for multi-device sync (Google Apps Script)
// To set up your own:
// 1. Create a Google Sheet
// 2. Go to Extensions > Apps Script
// 3. Create a new project with doPost and doGet functions
// 4. Deploy as Web App with "Anyone" access
// 5. Copy the Web App URL here
export const CLOUD_URL = 'https://script.google.com/macros/s/AKfycbz_8gmgc2BlOtt_W5lJbMUigSQEOSJIwSUjnkKpxJxSedZjppS4EpBFTW1sspV1_SudWg/exec';

// Sync Configuration - Optimized for performance
export const SYNC_INTERVAL = 15000; // 15 seconds for reliable multi-device sync
export const INITIAL_LOAD_DELAY = 500; // Faster initial load
export const MAX_RETRY_ATTEMPTS = 5; // Max retries for failed syncs

// App Version
export const APP_VERSION = '1.0.0';
export const APP_NAME = 'SVAKS';

// How auto-connect works:
// App immediately connects to CLOUD_URL on boot.
// It bypasses the Setup Wizard, fetches real-time data, and seamlessly syncs changes directly.
