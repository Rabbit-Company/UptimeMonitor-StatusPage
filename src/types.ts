// Custom metric types
export interface CustomMetricConfig {
	id: string;
	name: string;
	unit?: string;
}

export interface CustomMetricData {
	config: CustomMetricConfig;
	value?: number;
}

// Status data types
export interface StatusData {
	name: string;
	slug: string;
	items: StatusItem[];
	lastUpdated: string;
}

export interface StatusItem {
	id: string;
	type: "group" | "monitor";
	name: string;
	status: "up" | "down" | "degraded";
	latency: number;
	lastCheck?: string;
	firstPulse?: string;
	uptime1h?: number;
	uptime24h?: number;
	uptime7d?: number;
	uptime30d?: number;
	uptime90d?: number;
	uptime365d?: number;
	children?: StatusItem[];
	custom1?: CustomMetricData;
	custom2?: CustomMetricData;
	custom3?: CustomMetricData;
}

// History data types
export interface HistoryDataPoint {
	timestamp: string;
	uptime: number;
	latency_min?: number;
	latency_max?: number;
	latency_avg?: number;
	custom1_min?: number;
	custom1_max?: number;
	custom1_avg?: number;
	custom2_min?: number;
	custom2_max?: number;
	custom2_avg?: number;
	custom3_min?: number;
	custom3_max?: number;
	custom3_avg?: number;
}

export interface MonitorHistoryResponse {
	monitorId: string;
	type: HistoryType;
	data: HistoryDataPoint[];
	customMetrics?: {
		custom1?: CustomMetricConfig;
		custom2?: CustomMetricConfig;
		custom3?: CustomMetricConfig;
	};
}

export interface GroupHistoryDataPoint {
	timestamp: string;
	uptime: number;
	latency_min?: number;
	latency_max?: number;
	latency_avg?: number;
}

export interface GroupHistoryResponse {
	groupId: string;
	type: HistoryType;
	strategy: "any-up" | "all-up" | "percentage";
	data: GroupHistoryDataPoint[];
}

// Period and history types
export type HistoryType = "raw" | "hourly" | "daily";
export type Period = "1h" | "24h" | "7d" | "30d" | "90d" | "365d";

// WebSocket message types
export interface WSConnectedMessage {
	action: "connected";
	message: string;
	timestamp: string;
}

export interface WSSubscribedMessage {
	action: "subscribed";
	slug: string;
	message: string;
	timestamp: string;
}

export interface WSPulseMessage {
	action: "pulse";
	data: {
		slug: string;
		monitorId: string;
		status: "up";
		latency: number;
		timestamp: string;
		custom1: number | null;
		custom2: number | null;
		custom3: number | null;
	};
	timestamp: string;
}

export interface WSMonitorDownMessage {
	action: "monitor-down";
	data: {
		slug: string;
		monitorId: string;
		downtime: number;
	};
	timestamp: string;
}

export interface WSMonitorStillDownMessage {
	action: "monitor-still-down";
	data: {
		slug: string;
		monitorId: string;
		consecutiveDownCount: number;
		downtime: number;
	};
	timestamp: string;
}

export interface WSMonitorRecoveredMessage {
	action: "monitor-recovered";
	data: {
		slug: string;
		monitorId: string;
		previousConsecutiveDownCount: number;
		downtime: number;
	};
	timestamp: string;
}

export type WSMessage =
	| WSConnectedMessage
	| WSSubscribedMessage
	| WSPulseMessage
	| WSMonitorDownMessage
	| WSMonitorStillDownMessage
	| WSMonitorRecoveredMessage;
