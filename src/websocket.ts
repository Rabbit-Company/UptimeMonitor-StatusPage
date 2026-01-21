import type { WSMessage, WSPulseMessage, WSMonitorDownMessage, WSMonitorStillDownMessage, WSMonitorRecoveredMessage } from "./types";
import { BACKEND_URL, STATUS_PAGE_SLUG, WS_MAX_RECONNECT_ATTEMPTS, WS_RECONNECT_BASE_DELAY, WS_RECONNECT_MAX_DELAY } from "./config";
import { appState } from "./state";
import { showNotification } from "./notifications";
import { updateMonitorUI, updateParentGroups, updateSummaryStats, updateOverallStatus } from "./ui";
import { getDateTime } from "./utils";

type ConnectionStatus = "connected" | "disconnected" | "reconnecting" | "error" | "failed";

/**
 * Get WebSocket URL from backend URL
 */
function getWebSocketUrl(): string {
	const url = new URL(BACKEND_URL);
	const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
	return `${wsProtocol}//${url.host}/ws`;
}

/**
 * Update connection status indicator in the UI
 */
function updateConnectionStatus(status: ConnectionStatus): void {
	const indicator = document.getElementById("wsStatusIndicator");
	const text = document.getElementById("wsStatusText");

	if (!indicator || !text) return;

	switch (status) {
		case "connected":
			indicator.className = "w-2 h-2 rounded-full bg-[var(--status-up)]";
			text.textContent = "Live";
			text.className = "text-sm text-[var(--status-up-text)]";
			break;
		case "disconnected":
		case "error":
			indicator.className = "w-2 h-2 rounded-full bg-[var(--status-down)]";
			text.textContent = "Disconnected";
			text.className = "text-sm text-[var(--status-down-text)]";
			break;
		case "reconnecting":
			indicator.className = "w-2 h-2 rounded-full bg-[var(--status-degraded)] animate-pulse";
			text.textContent = "Reconnecting...";
			text.className = "text-sm text-[var(--status-degraded-text)]";
			break;
		case "failed":
			indicator.className = "w-2 h-2 rounded-full bg-[var(--status-down)]";
			text.textContent = "Connection failed";
			text.className = "text-sm text-[var(--status-down-text)]";
			break;
	}
}

/**
 * Handle WebSocket open event
 */
function handleWSOpen(): void {
	console.log("[WS] Connection established");
	appState.wsReconnectAttempts = 0;

	// Subscribe to the status page
	if (appState.ws && appState.ws.readyState === WebSocket.OPEN) {
		appState.ws.send(JSON.stringify({ action: "subscribe", slug: STATUS_PAGE_SLUG }));
	}

	updateConnectionStatus("connected");
}

/**
 * Handle WebSocket message event
 */
function handleWSMessage(event: MessageEvent): void {
	try {
		const message: WSMessage = JSON.parse(event.data);

		switch (message.action) {
			case "connected":
				console.log("[WS] Server acknowledged connection");
				break;

			case "subscribed":
				console.log(`[WS] Subscribed to status page: ${message.slug}`);
				break;

			case "pulse":
				handlePulseUpdate(message);
				break;

			case "monitor-down":
				handleMonitorDown(message);
				break;

			case "monitor-still-down":
				handleMonitorStillDown(message);
				break;

			case "monitor-recovered":
				handleMonitorRecovered(message);
				break;

			default:
				console.log("[WS] Unknown message type:", message);
		}
	} catch (error) {
		console.error("[WS] Failed to parse message:", error);
	}
}

/**
 * Handle pulse update from WebSocket
 */
function handlePulseUpdate(message: WSPulseMessage): void {
	if (!appState.statusData) return;

	const { monitorId, status, latency, timestamp, custom1, custom2, custom3 } = message.data;

	const monitor = appState.findItemById(monitorId);
	if (monitor && monitor.type === "monitor") {
		const previousStatus = monitor.status;
		monitor.status = status;
		monitor.latency = latency;
		monitor.lastCheck = timestamp;

		if (custom1 !== undefined && monitor.custom1) {
			monitor.custom1.value = custom1;
		}
		if (custom2 !== undefined && monitor.custom2) {
			monitor.custom2.value = custom2;
		}
		if (custom3 !== undefined && monitor.custom3) {
			monitor.custom3.value = custom3;
		}

		appState.statusData.lastUpdated = timestamp;

		updateMonitorUI(monitorId, monitor);
		updateSummaryStats();

		if (previousStatus !== status) {
			updateOverallStatus();
		}

		document.getElementById("lastUpdated")!.textContent = getDateTime(appState.statusData.lastUpdated);
	}

	updateParentGroups(monitorId);
}

/**
 * Handle monitor down event
 */
function handleMonitorDown(message: WSMonitorDownMessage): void {
	if (!appState.statusData) return;

	const { monitorId } = message.data;
	const monitor = appState.findItemById(monitorId);

	if (monitor) {
		monitor.status = "down";
		updateMonitorUI(monitorId, monitor);
		updateParentGroups(monitorId);
		updateSummaryStats();
		updateOverallStatus();

		showNotification(`${monitor.name} is down`, "error");
	}
}

/**
 * Handle monitor still down event
 */
function handleMonitorStillDown(message: WSMonitorStillDownMessage): void {
	if (!appState.statusData) return;

	const { monitorId } = message.data;
	const monitor = appState.findItemById(monitorId);

	if (monitor && monitor.status !== "down") {
		monitor.status = "down";
		updateMonitorUI(monitorId, monitor);
		updateParentGroups(monitorId);
		updateSummaryStats();
		updateOverallStatus();
	}
}

/**
 * Handle monitor recovered event
 */
function handleMonitorRecovered(message: WSMonitorRecoveredMessage): void {
	if (!appState.statusData) return;

	const { monitorId } = message.data;
	const monitor = appState.findItemById(monitorId);

	if (monitor) {
		monitor.status = "up";
		updateMonitorUI(monitorId, monitor);
		updateParentGroups(monitorId);
		updateSummaryStats();
		updateOverallStatus();

		showNotification(`${monitor.name} has recovered`, "success");
	}
}

/**
 * Handle WebSocket close event
 */
function handleWSClose(event: CloseEvent): void {
	console.log(`[WS] Connection closed (code: ${event.code}, reason: ${event.reason})`);
	appState.ws = null;
	updateConnectionStatus("disconnected");
	scheduleReconnect();
}

/**
 * Handle WebSocket error event
 */
function handleWSError(event: Event): void {
	console.error("[WS] WebSocket error:", event);
	updateConnectionStatus("error");
}

/**
 * Schedule a WebSocket reconnection attempt
 */
function scheduleReconnect(): void {
	if (appState.wsReconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
		console.log("[WS] Max reconnection attempts reached. Stopping reconnection.");
		updateConnectionStatus("failed");
		return;
	}

	const delay = Math.min(WS_RECONNECT_BASE_DELAY * Math.pow(2, appState.wsReconnectAttempts) + Math.random() * 1000, WS_RECONNECT_MAX_DELAY);

	console.log(`[WS] Scheduling reconnection attempt ${appState.wsReconnectAttempts + 1} in ${Math.round(delay)}ms...`);
	updateConnectionStatus("reconnecting");

	if (appState.wsReconnectTimeout) {
		clearTimeout(appState.wsReconnectTimeout);
	}

	appState.wsReconnectTimeout = setTimeout(() => {
		appState.wsReconnectAttempts++;
		initWebSocket();
	}, delay);
}

/**
 * Initialize WebSocket connection
 */
export function initWebSocket(): void {
	if (appState.ws && (appState.ws.readyState === WebSocket.CONNECTING || appState.ws.readyState === WebSocket.OPEN)) {
		return;
	}

	const wsUrl = getWebSocketUrl();
	console.log(`[WS] Connecting to ${wsUrl}...`);

	try {
		appState.ws = new WebSocket(wsUrl);

		appState.ws.addEventListener("open", handleWSOpen);
		appState.ws.addEventListener("message", handleWSMessage);
		appState.ws.addEventListener("close", handleWSClose);
		appState.ws.addEventListener("error", handleWSError);
	} catch (error) {
		console.error("[WS] Failed to create WebSocket:", error);
		scheduleReconnect();
	}
}

/**
 * Cleanup WebSocket connection
 */
export function cleanupWebSocket(): void {
	if (appState.ws) {
		appState.ws.close();
		appState.ws = null;
	}
	if (appState.wsReconnectTimeout) {
		clearTimeout(appState.wsReconnectTimeout);
		appState.wsReconnectTimeout = null;
	}
}
