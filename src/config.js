globalThis.BACKEND_URL = "YOUR_BACKEND_URL_HERE";
globalThis.STATUS_PAGE_SLUG = "YOUR_STATUS_PAGE_SLUG_HERE";
// Amount of shown decimal places for uptimes
globalThis.UPTIME_PRECISION = parseInt("YOUR_UPTIME_PRECISION_HERE") || 3;
// Available options: 1h, 24h, 7d, 30d, 90d, 365d
globalThis.DEFAULT_PERIOD = "YOUR_DEFAULT_PERIOD_HERE";

// Validation

if (!["1h", "24h", "7d", "30d", "90d", "365d"].includes(globalThis.DEFAULT_PERIOD)) {
	globalThis.DEFAULT_PERIOD = "24h";
}
