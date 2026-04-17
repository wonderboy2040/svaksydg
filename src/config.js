// Cloud Configuration
// This URL is set during first-time setup and used for auto-connection on new devices
// When a new device/incognito opens the app, it will try this URL first
// If cloud has valid data, the setup wizard is skipped entirely

export const DEFAULT_CLOUD_URL = 'https://script.google.com/macros/s/AKfycbx3vlVOgxBJJoJTe4ZyDeNvHe9s6LRA4o0xdrrLrAN9nru2j_rwVzHaEAog2tTt2VQpAw/exec';

// How auto-connect works:
// 1. First device: User goes through Setup Wizard → enters URL + PIN → saved to cloud
// 2. New device/incognito: App checks DEFAULT_CLOUD_URL → finds data → auto-populates → skips wizard
// 3. If cloud is empty or unreachable → shows Setup Wizard as fallback
