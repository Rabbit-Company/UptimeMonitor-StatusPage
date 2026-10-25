import type { StatusData } from "./types";
import { BACKEND_URL, STATUS_PAGE_SLUG } from "./config";
import { getAuthHeaders } from "./auth";
import { appState } from "./state";
import { renderStatusSnapshot } from "./ui";

// Group status is computed by the server shortly after a monitor changes.
const GROUP_UPDATE_DELAY_MS = 250;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshVersion = 0;
let requestId = 0;

export function scheduleStatusRefresh(): void {
	refreshVersion++;
	if (refreshTimer) return;

	refreshTimer = setTimeout(() => {
		refreshTimer = null;
		void refreshStatusData(refreshVersion);
	}, GROUP_UPDATE_DELAY_MS);
}

async function refreshStatusData(version: number): Promise<void> {
	// The server caches public status responses by URL for 30 seconds.
	const url = `${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}?_=${Date.now()}-${++requestId}`;
	try {
		const response = await fetch(url, { headers: getAuthHeaders(), cache: "no-store" });
		if (!response.ok) throw new Error(`Status refresh failed: ${response.status}`);
		const data = (await response.json()) as StatusData;
		if (version !== refreshVersion || !appState.statusData) return;
		appState.statusData = data;
		renderStatusSnapshot();
	} catch (error) {
		console.warn("Could not refresh status data:", error);
	}
}
