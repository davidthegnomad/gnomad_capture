// Normalizes the API across Chrome and Firefox
export const api = globalThis.browser || globalThis.chrome;

// Helper to wrap timeouts in promises
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
