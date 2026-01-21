import type { Period } from "./types";

// Declare global variables set by config.js
declare global {
	var BACKEND_URL: string;
	var STATUS_PAGE_SLUG: string;
	var UPTIME_PRECISION: number;
	var LATENCY_PRECISION: number;
	var DEFAULT_PERIOD: string;
	var DEFAULT_THEME: string;
}

// Valid values
const validPeriods: Period[] = ["1h", "24h", "7d", "30d", "90d", "365d"];
const validThemes = ["midnight", "ocean", "forest", "sunset", "lavender", "monochrome", "cyberpunk", "nord", "dracula"] as const;

export type ConfigThemeName = (typeof validThemes)[number];

export function getValidatedDefaultPeriod(): Period {
	if (!validPeriods.includes(globalThis.DEFAULT_PERIOD as Period)) {
		return "24h";
	}
	return globalThis.DEFAULT_PERIOD as Period;
}

export function getValidatedDefaultTheme(): ConfigThemeName {
	if (!validThemes.includes(globalThis.DEFAULT_THEME as ConfigThemeName)) {
		return "midnight";
	}
	return globalThis.DEFAULT_THEME as ConfigThemeName;
}

// Export config values from globalThis (set in config.js)
export const BACKEND_URL = globalThis.BACKEND_URL;
export const STATUS_PAGE_SLUG = globalThis.STATUS_PAGE_SLUG;
export const UPTIME_PRECISION = globalThis.UPTIME_PRECISION;
export const LATENCY_PRECISION = globalThis.LATENCY_PRECISION;
export const DEFAULT_PERIOD = getValidatedDefaultPeriod();
export const DEFAULT_THEME = getValidatedDefaultTheme();

// WebSocket configuration
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
export const WS_RECONNECT_BASE_DELAY = 1000; // 1 second
export const WS_RECONNECT_MAX_DELAY = 30000; // 30 seconds
