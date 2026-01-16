import type { Chart } from "chart.js";
import type { StatusData, StatusItem, Period } from "./types";
import { DEFAULT_PERIOD } from "./config";

/**
 * Application state management
 */
class AppState {
	// Status data
	statusData: StatusData | null = null;

	// UI state
	selectedUptimePeriod: string = DEFAULT_PERIOD;
	expandedGroups = new Set<string>();

	// Modal state
	modalCharts: {
		uptime?: Chart;
		latency?: Chart;
		custom1?: Chart;
		custom2?: Chart;
		custom3?: Chart;
	} = {};
	currentModalItem: StatusItem | null = null;
	currentModalPeriod: Period = "24h";

	// WebSocket state
	ws: WebSocket | null = null;
	wsReconnectAttempts = 0;
	wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Find a status item by ID recursively
	 */
	findItemById(itemId: string, items: StatusItem[] = this.statusData?.items || []): StatusItem | null {
		for (const item of items) {
			if (item.id === itemId) return item;
			if (item.children) {
				const found = this.findItemById(itemId, item.children);
				if (found) return found;
			}
		}
		return null;
	}

	/**
	 * Toggle group expansion state
	 */
	toggleGroup(groupId: string): boolean {
		if (this.expandedGroups.has(groupId)) {
			this.expandedGroups.delete(groupId);
			return false;
		} else {
			this.expandedGroups.add(groupId);
			return true;
		}
	}

	/**
	 * Check if a group is expanded
	 */
	isGroupExpanded(groupId: string): boolean {
		return this.expandedGroups.has(groupId);
	}

	/**
	 * Destroy all modal charts
	 */
	destroyAllCharts(): void {
		const chartKeys = ["uptime", "latency", "custom1", "custom2", "custom3"] as const;
		for (const key of chartKeys) {
			if (this.modalCharts[key]) {
				this.modalCharts[key]!.destroy();
				this.modalCharts[key] = undefined;
			}
		}
	}

	/**
	 * Reset WebSocket state
	 */
	resetWebSocketState(): void {
		this.ws = null;
		this.wsReconnectAttempts = 0;
		if (this.wsReconnectTimeout) {
			clearTimeout(this.wsReconnectTimeout);
			this.wsReconnectTimeout = null;
		}
	}
}

// Export singleton instance
export const appState = new AppState();
