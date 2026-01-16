import type { Period } from "./types";

// Validate and set default period
const validPeriods: Period[] = ["1h", "24h", "7d", "30d", "90d", "365d"];

export function getValidatedDefaultPeriod(): Period {
	if (!validPeriods.includes(globalThis.DEFAULT_PERIOD as Period)) {
		return "24h";
	}
	return globalThis.DEFAULT_PERIOD as Period;
}

// Export config values from globalThis (set in config.js)
export const BACKEND_URL = globalThis.BACKEND_URL as string;
export const STATUS_PAGE_SLUG = globalThis.STATUS_PAGE_SLUG as string;
export const UPTIME_PRECISION = globalThis.UPTIME_PRECISION as number;
export const DEFAULT_PERIOD = getValidatedDefaultPeriod();

// WebSocket configuration
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_RECONNECT_BASE_DELAY = 1000; // 1 second
export const WS_RECONNECT_MAX_DELAY = 30000; // 30 seconds
