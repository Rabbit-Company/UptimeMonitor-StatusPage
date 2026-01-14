import {
	Chart,
	LineController,
	LineElement,
	BarController,
	BarElement,
	PointElement,
	LinearScale,
	CategoryScale,
	TimeScale,
	Tooltip,
	Legend,
	Filler,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

Chart.register(
	LineController,
	LineElement,
	BarController,
	BarElement,
	PointElement,
	LinearScale,
	CategoryScale,
	TimeScale,
	Tooltip,
	Legend,
	Filler,
	zoomPlugin
);

// Types matching the new backend
interface CustomMetricConfig {
	id: string;
	name: string;
	unit?: string;
}

interface CustomMetricData {
	config: CustomMetricConfig;
	value?: number;
}

interface StatusData {
	name: string;
	slug: string;
	items: StatusItem[];
	lastUpdated: string;
}

interface StatusItem {
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

// New history data types matching the backend
interface HistoryDataPoint {
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

interface MonitorHistoryResponse {
	monitorId: string;
	type: "raw" | "hourly" | "daily";
	data: HistoryDataPoint[];
	customMetrics?: {
		custom1?: CustomMetricConfig;
		custom2?: CustomMetricConfig;
		custom3?: CustomMetricConfig;
	};
}

// Group history response
interface GroupHistoryDataPoint {
	timestamp: string;
	uptime: number;
	latency_min?: number;
	latency_max?: number;
	latency_avg?: number;
}

interface GroupHistoryResponse {
	groupId: string;
	type: "raw" | "hourly" | "daily";
	strategy: "any-up" | "all-up" | "percentage";
	data: GroupHistoryDataPoint[];
}

type HistoryType = "raw" | "hourly" | "daily";
type Period = "1h" | "24h" | "7d" | "30d" | "90d" | "365d";

// Validate and set default period
if (!["1h", "24h", "7d", "30d", "90d", "365d"].includes(globalThis.DEFAULT_PERIOD)) {
	globalThis.DEFAULT_PERIOD = "24h";
}

// Global state
let statusData: StatusData | null = null;
let selectedUptimePeriod = DEFAULT_PERIOD;
let expandedGroups = new Set<string>();
let modalCharts: { uptime?: Chart; latency?: Chart; custom1?: Chart; custom2?: Chart; custom3?: Chart } = {};
let currentModalItem: StatusItem | null = null;
let currentModalPeriod: Period = "24h";

// Map periods to history types and filter ranges
function getHistoryTypeForPeriod(period: Period): HistoryType {
	switch (period) {
		case "1h":
		case "24h":
			return "raw";
		case "7d":
			return "hourly";
		case "30d":
		case "90d":
		case "365d":
			return "daily";
		default:
			return "hourly";
	}
}

// Get the time range for filtering data based on period
function getTimeRangeForPeriod(period: Period): number {
	const now = Date.now();
	switch (period) {
		case "1h":
			return now - 60 * 60 * 1000;
		case "24h":
			return now - 24 * 60 * 60 * 1000;
		case "7d":
			return now - 7 * 24 * 60 * 60 * 1000;
		case "30d":
			return now - 30 * 24 * 60 * 60 * 1000;
		case "90d":
			return now - 90 * 24 * 60 * 60 * 1000;
		case "365d":
			return now - 365 * 24 * 60 * 60 * 1000;
		default:
			return now - 24 * 60 * 60 * 1000;
	}
}

function parseTimestamp(timestamp: string): Date {
	if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
		const [year, month, day] = timestamp.split("-").map(Number) as [number, number, number];
		return new Date(year, month - 1, day);
	}

	return new Date(timestamp);
}

function formatDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

// Fill missing intervals in history data with 0 uptime and null latencies
// This handles cases where monitoring hasn't been running for the full period
function fillMissingIntervals<T extends { timestamp: string; uptime: number }>(data: T[], period: Period, historyType: HistoryType): T[] {
	if (historyType === "raw") {
		return data;
	}

	const now = new Date();
	const cutoffTime = getTimeRangeForPeriod(period);

	const intervalMs = historyType === "hourly" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

	const dataMap = new Map<string, T>();
	for (const point of data) {
		const date = parseTimestamp(point.timestamp);
		let key: string;
		if (historyType === "hourly") {
			key = `${formatDateOnly(date)}-${String(date.getHours()).padStart(2, "0")}`;
		} else {
			key = formatDateOnly(date);
		}
		dataMap.set(key, point);
	}

	const filledData: T[] = [];

	const startDate = new Date(cutoffTime);
	if (historyType === "hourly") {
		startDate.setMinutes(0, 0, 0);
	} else {
		startDate.setHours(0, 0, 0, 0);
	}

	let endDate: Date;
	if (historyType === "hourly") {
		endDate = new Date(now);
		endDate.setMinutes(0, 0, 0);
		endDate.setHours(endDate.getHours() - 1);
	} else {
		endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	}

	let currentTime = startDate.getTime();
	const endTime = endDate.getTime();

	while (currentTime <= endTime) {
		const currentDate = new Date(currentTime);
		let key: string;
		if (historyType === "hourly") {
			key = `${formatDateOnly(currentDate)}-${String(currentDate.getHours()).padStart(2, "0")}`;
		} else {
			key = formatDateOnly(currentDate);
		}

		const existingPoint = dataMap.get(key);

		if (existingPoint) {
			filledData.push(existingPoint);
		} else {
			const placeholderTimestamp = historyType === "daily" ? formatDateOnly(currentDate) : currentDate.toISOString();
			const placeholderPoint = {
				timestamp: placeholderTimestamp,
				uptime: 0,
			} as T;
			filledData.push(placeholderPoint);
		}

		currentTime += intervalMs;
	}

	const currentIntervalDate = new Date(now);
	if (historyType === "hourly") {
		currentIntervalDate.setMinutes(0, 0, 0);
	} else {
		currentIntervalDate.setHours(0, 0, 0, 0);
	}

	let currentKey: string;
	if (historyType === "hourly") {
		currentKey = `${formatDateOnly(currentIntervalDate)}-${String(currentIntervalDate.getHours()).padStart(2, "0")}`;
	} else {
		currentKey = formatDateOnly(currentIntervalDate);
	}

	const currentIntervalPoint = dataMap.get(currentKey);
	if (currentIntervalPoint) {
		filledData.push(currentIntervalPoint);
	}

	return filledData;
}

// Aggregate raw 1-minute data into 10-minute intervals for 24h period
// This reduces ~1440 data points to ~144 for better chart performance
function aggregateTo10MinIntervals<T extends HistoryDataPoint | GroupHistoryDataPoint>(data: T[]): T[] {
	if (data.length === 0) return data;

	// Group data points by 10-minute buckets
	const buckets = new Map<string, T[]>();

	for (const point of data) {
		const date = parseTimestamp(point.timestamp);
		// Round down to nearest 10-minute interval
		const minutes = Math.floor(date.getMinutes() / 10) * 10;
		date.setMinutes(minutes, 0, 0);
		const bucketKey = date.toISOString();

		if (!buckets.has(bucketKey)) {
			buckets.set(bucketKey, []);
		}
		buckets.get(bucketKey)!.push(point);
	}

	const aggregated: T[] = [];

	for (const [bucketKey, points] of buckets) {
		if (points.length === 0) continue;

		const uptimeSum = points.reduce((sum, p) => sum + p.uptime, 0);
		const uptimeAvg = uptimeSum / points.length;

		const aggregatedPoint: any = {
			timestamp: bucketKey,
			uptime: uptimeAvg,
		};

		const latencyMinValues = points.map((p) => p.latency_min).filter((v): v is number => v !== undefined && v !== null);
		const latencyMaxValues = points.map((p) => p.latency_max).filter((v): v is number => v !== undefined && v !== null);
		const latencyAvgValues = points.map((p) => p.latency_avg).filter((v): v is number => v !== undefined && v !== null);

		if (latencyMinValues.length > 0) {
			aggregatedPoint.latency_min = Math.min(...latencyMinValues);
		}
		if (latencyMaxValues.length > 0) {
			aggregatedPoint.latency_max = Math.max(...latencyMaxValues);
		}
		if (latencyAvgValues.length > 0) {
			aggregatedPoint.latency_avg = latencyAvgValues.reduce((sum, v) => sum + v, 0) / latencyAvgValues.length;
		}

		// Aggregate custom metrics if present (only for HistoryDataPoint, not GroupHistoryDataPoint)
		const firstPoint = points[0] as any;
		if ("custom1_avg" in firstPoint) {
			const custom1MinValues = points.map((p: any) => p.custom1_min).filter((v: any): v is number => v !== undefined && v !== null);
			const custom1MaxValues = points.map((p: any) => p.custom1_max).filter((v: any): v is number => v !== undefined && v !== null);
			const custom1AvgValues = points.map((p: any) => p.custom1_avg).filter((v: any): v is number => v !== undefined && v !== null);

			if (custom1MinValues.length > 0) aggregatedPoint.custom1_min = Math.min(...custom1MinValues);
			if (custom1MaxValues.length > 0) aggregatedPoint.custom1_max = Math.max(...custom1MaxValues);
			if (custom1AvgValues.length > 0) aggregatedPoint.custom1_avg = custom1AvgValues.reduce((sum: number, v: number) => sum + v, 0) / custom1AvgValues.length;

			const custom2MinValues = points.map((p: any) => p.custom2_min).filter((v: any): v is number => v !== undefined && v !== null);
			const custom2MaxValues = points.map((p: any) => p.custom2_max).filter((v: any): v is number => v !== undefined && v !== null);
			const custom2AvgValues = points.map((p: any) => p.custom2_avg).filter((v: any): v is number => v !== undefined && v !== null);

			if (custom2MinValues.length > 0) aggregatedPoint.custom2_min = Math.min(...custom2MinValues);
			if (custom2MaxValues.length > 0) aggregatedPoint.custom2_max = Math.max(...custom2MaxValues);
			if (custom2AvgValues.length > 0) aggregatedPoint.custom2_avg = custom2AvgValues.reduce((sum: number, v: number) => sum + v, 0) / custom2AvgValues.length;

			const custom3MinValues = points.map((p: any) => p.custom3_min).filter((v: any): v is number => v !== undefined && v !== null);
			const custom3MaxValues = points.map((p: any) => p.custom3_max).filter((v: any): v is number => v !== undefined && v !== null);
			const custom3AvgValues = points.map((p: any) => p.custom3_avg).filter((v: any): v is number => v !== undefined && v !== null);

			if (custom3MinValues.length > 0) aggregatedPoint.custom3_min = Math.min(...custom3MinValues);
			if (custom3MaxValues.length > 0) aggregatedPoint.custom3_max = Math.max(...custom3MaxValues);
			if (custom3AvgValues.length > 0) aggregatedPoint.custom3_avg = custom3AvgValues.reduce((sum: number, v: number) => sum + v, 0) / custom3AvgValues.length;
		}

		aggregated.push(aggregatedPoint as T);
	}

	aggregated.sort((a, b) => parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime());

	return aggregated;
}

function changeUptimePeriod(period: string): void {
	selectedUptimePeriod = period;
	renderPage();
}

function getUptimeValue(item: StatusItem, period: string): number | undefined {
	switch (period) {
		case "1h":
			return item.uptime1h;
		case "24h":
			return item.uptime24h;
		case "7d":
			return item.uptime7d;
		case "30d":
			return item.uptime30d;
		case "90d":
			return item.uptime90d;
		case "365d":
			return item.uptime365d;
		default:
			return item.uptime24h;
	}
}

function getTime(date: Date | string | number, seconds: boolean = true): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, "0");
	const h = pad(d.getHours());
	const m = pad(d.getMinutes());
	const s = pad(d.getSeconds());
	return seconds ? `${h}:${m}:${s}` : `${h}:${m}`;
}

function getDate(date: Date | string | number): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, "0");
	const year = d.getFullYear();
	const month = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	return `${year}-${month}-${day}`;
}

function getDateTime(date: Date | string | number, seconds: boolean = true): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, "0");
	const year = d.getFullYear();
	const month = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	const hours = pad(d.getHours());
	const minutes = pad(d.getMinutes());
	const secs = pad(d.getSeconds());
	return seconds ? `${year}-${month}-${day} ${hours}:${minutes}:${secs}` : `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Get appropriate label format based on period
function formatLabelForPeriod(timestamp: string, period: Period): string {
	const date = parseTimestamp(timestamp);
	switch (period) {
		case "1h":
		case "24h":
			return getTime(date, false);
		case "7d":
			return getDateTime(date, false);
		case "30d":
		case "90d":
		case "365d":
			return getDate(date);
		default:
			return getDateTime(date, false);
	}
}

// Initialize
async function init(): Promise<void> {
	try {
		const response = await fetch(`${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}`);
		if (!response.ok) throw new Error("Failed to fetch status data");

		statusData = await response.json();

		(document.getElementById("uptimePeriodSelector") as HTMLSelectElement).value = selectedUptimePeriod;

		document.getElementById("loading")!.classList.add("hidden");
		document.getElementById("content")!.classList.remove("hidden");

		setupEventListeners();
		renderPage();
	} catch (error: any) {
		console.error("Error loading status data:", error);
		document.getElementById("loading")!.innerHTML = `
			<div class="text-center">
				<div class="text-red-500 mb-4">
					<svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<p class="text-gray-400">Failed to load status data</p>
				<p class="text-gray-500 text-sm mt-2">${error.message}</p>
			</div>
		`;
	}
}

function setupEventListeners(): void {
	const uptimePeriodSelector = document.getElementById("uptimePeriodSelector") as HTMLSelectElement;
	if (uptimePeriodSelector) {
		uptimePeriodSelector.addEventListener("change", (e) => {
			const target = e.target as HTMLSelectElement;
			changeUptimePeriod(target.value);
		});
	}

	// Modal close handlers
	const modalBackdrop = document.querySelector(".modal-backdrop");
	if (modalBackdrop) {
		modalBackdrop.addEventListener("click", closeHistoryModal);
	}

	const modalCloseBtn = document.getElementById("modalCloseBtn");
	if (modalCloseBtn) {
		modalCloseBtn.addEventListener("click", closeHistoryModal);
	}

	// Modal period buttons
	document.querySelectorAll(".modal-period-btn").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			const period = (e.currentTarget as HTMLElement).getAttribute("data-modal-period") as Period;
			if (period && currentModalItem) {
				await loadModalHistory(currentModalItem, period);
			}
		});
	});

	// Close modal on Escape key
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeHistoryModal();
		}
	});
}

function renderPage(): void {
	if (!statusData) return;

	document.getElementById("serviceName")!.textContent = statusData.name;

	// Calculate overall status
	const hasDown = statusData.items.some((item) => item.status === "down");
	const hasDegraded = statusData.items.some((item) => item.status === "degraded");
	const overallStatusEl = document.getElementById("overallStatus")!;
	const statusDot = overallStatusEl.querySelector("div")!;
	const statusText = overallStatusEl.querySelector("span")!;

	if (hasDown) {
		statusDot.className = "w-3 h-3 rounded-full bg-red-500 animate-pulse-slow";
		statusText.className = "text-sm font-medium text-red-400";
		statusText.textContent = "Partial Outage";
	} else if (hasDegraded) {
		statusDot.className = "w-3 h-3 rounded-full bg-yellow-500 animate-pulse-slow";
		statusText.className = "text-sm font-medium text-yellow-400";
		statusText.textContent = "Degraded Performance";
	} else {
		statusDot.className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse-slow";
		statusText.className = "text-sm font-medium text-emerald-400";
		statusText.textContent = "All Systems Operational";
	}

	// Calculate summary stats
	let servicesUp = 0;
	let servicesDown = 0;
	let servicesDegraded = 0;

	function countServices(items: StatusItem[]): void {
		items.forEach((item) => {
			if (item.children) {
				countServices(item.children);
			} else {
				if (item.status === "up") servicesUp++;
				else if (item.status === "degraded") servicesDegraded++;
				else servicesDown++;
			}
		});
	}

	countServices(statusData.items);

	const uptimeValues: number[] = statusData.items.map((i) => getUptimeValue(i, selectedUptimePeriod) || 0);
	const averageUptime = uptimeValues.length > 0 ? (uptimeValues.reduce((sum, val) => sum + val, 0) / uptimeValues.length).toFixed(UPTIME_PRECISION) + "%" : "-";

	const latencyValues: number[] = statusData.items.map((i) => i.latency);
	const averageLatency = latencyValues.length > 0 ? `${Math.round(latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length)}ms` : "-";

	document.getElementById("uptimeValue")!.textContent = averageUptime;
	document.getElementById("avgLatency")!.textContent = averageLatency;
	document.getElementById("servicesUp")!.textContent = servicesUp.toString();
	document.getElementById("servicesDown")!.textContent = (servicesDown + servicesDegraded).toString();

	document.getElementById("lastUpdated")!.textContent = getDateTime(statusData.lastUpdated);

	renderServices();
}

function renderServices(): void {
	if (!statusData) return;

	const container = document.getElementById("servicesList")!;
	container.innerHTML = "";

	statusData.items.forEach((item) => {
		container.appendChild(renderServiceItem(item, 0));
	});

	addServiceEventListeners();
}

function renderServiceItem(item: StatusItem, depth: number): HTMLElement {
	const div = document.createElement("div");
	div.className = depth > 0 ? "ml-0 lg:ml-8" : "";

	if (item.type === "group") {
		// Group
		const isGroupExpanded = expandedGroups.has(item.id);
		const uptimeVal = getUptimeValue(item, selectedUptimePeriod);
		const statusColor = item.status === "up" ? "bg-emerald-500" : item.status === "degraded" ? "bg-yellow-500" : "bg-red-500";

		div.innerHTML = `
			<div class="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
				<div class="px-6 py-4 group-header cursor-pointer group-toggle" data-group-id="${item.id}">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-3 min-w-0 flex-1">
							<div class="w-2 h-2 rounded-full ${statusColor} flex-shrink-0"></div>
							<h3 class="text-lg font-semibold text-white truncate">${item.name}</h3>
						</div>
						<!-- Desktop metrics -->
						<div class="hidden sm:flex items-center space-x-6">
							${
								item.latency !== undefined && item.latency > 0
									? `
							<div class="text-right">
								<p class="text-sm text-gray-400">Latency</p>
								<p class="text-sm font-semibold text-white">${Math.round(item.latency)}ms</p>
							</div>
							`
									: ""
							}
							${
								uptimeVal !== undefined
									? `
							<div class="text-right">
								<p class="text-sm text-gray-400">Uptime (${selectedUptimePeriod})</p>
								<p class="text-sm font-semibold ${uptimeVal > 99 ? "text-emerald-400" : uptimeVal > 95 ? "text-yellow-400" : "text-red-400"}">${uptimeVal.toFixed(
											UPTIME_PRECISION
									  )}%</p>
							</div>
							`
									: ""
							}
						</div>
						<!-- Action buttons -->
						<div class="flex items-center space-x-2 ml-4">
							<button data-history-id="${
								item.id
							}" data-history-type="group" class="cursor-pointer history-btn p-2 hover:bg-gray-800 rounded-lg transition-colors" title="View History">
								<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
								</svg>
							</button>
							<button data-group-id="${item.id}" class="cursor-pointer group-toggle p-2 hover:bg-gray-800 rounded-lg transition-colors" title="Toggle Group">
								<svg class="toggle-group-icon w-5 h-5 text-gray-400 transform transition-transform ${
									isGroupExpanded ? "rotate-180" : ""
								}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
								</svg>
							</button>
						</div>
					</div>
					<!-- Mobile metrics -->
					<div class="sm:hidden flex justify-between mt-3">
						${
							item.latency !== undefined && item.latency > 0
								? `
						<div class="text-left">
							<p class="text-xs text-gray-400">Latency</p>
							<p class="text-sm font-semibold text-white">${Math.round(item.latency)}ms</p>
						</div>
						`
								: "<div></div>"
						}
						${
							uptimeVal !== undefined
								? `
						<div class="text-right">
							<p class="text-xs text-gray-400">Uptime (${selectedUptimePeriod})</p>
							<p class="text-sm font-semibold ${uptimeVal > 99 ? "text-emerald-400" : uptimeVal > 95 ? "text-yellow-400" : "text-red-400"}">${uptimeVal.toFixed(
										UPTIME_PRECISION
								  )}%</p>
						</div>
						`
								: ""
						}
					</div>
				</div>
				<!-- Group children -->
				<div id="group-${item.id}" class="${isGroupExpanded ? "" : "hidden"}">
				<div class="px-6 py-4 border-t border-gray-800 space-y-4">
					${item.children?.map((child) => renderServiceItem(child, depth + 1).outerHTML).join("") || ""}
				</div>
			</div>
			</div>
		`;
	} else if (item.type === "monitor") {
		// Monitor - has history button
		const uptimeVal = getUptimeValue(item, selectedUptimePeriod);

		// Build custom metrics display
		let customMetricsHtml = "";
		let customMetricsMobileHtml = "";

		if (item.custom1?.value !== undefined) {
			const unit = item.custom1.config.unit || "";
			customMetricsHtml += `
				<div class="text-right">
					<p class="text-sm text-gray-400">${item.custom1.config.name}</p>
					<p class="text-sm font-semibold text-blue-400">${item.custom1.value} ${unit}</p>
				</div>
			`;
			customMetricsMobileHtml += `
				<div class="text-center">
					<p class="text-xs text-gray-400">${item.custom1.config.name}</p>
					<p class="text-sm font-semibold text-blue-400">${item.custom1.value} ${unit}</p>
				</div>
			`;
		}

		if (item.custom2?.value !== undefined) {
			const unit = item.custom2.config.unit || "";
			customMetricsHtml += `
				<div class="text-right">
					<p class="text-sm text-gray-400">${item.custom2.config.name}</p>
					<p class="text-sm font-semibold text-purple-400">${item.custom2.value} ${unit}</p>
				</div>
			`;
			customMetricsMobileHtml += `
				<div class="text-center">
					<p class="text-xs text-gray-400">${item.custom2.config.name}</p>
					<p class="text-sm font-semibold text-purple-400">${item.custom2.value} ${unit}</p>
				</div>
			`;
		}

		if (item.custom3?.value !== undefined) {
			const unit = item.custom3.config.unit || "";
			customMetricsHtml += `
				<div class="text-right">
					<p class="text-sm text-gray-400">${item.custom3.config.name}</p>
					<p class="text-sm font-semibold text-cyan-400">${item.custom3.value} ${unit}</p>
				</div>
			`;
			customMetricsMobileHtml += `
				<div class="text-center">
					<p class="text-xs text-gray-400">${item.custom3.config.name}</p>
					<p class="text-sm font-semibold text-cyan-400">${item.custom3.value} ${unit}</p>
				</div>
			`;
		}

		div.innerHTML = `
			<div class="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
				<div class="px-6 py-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-3 min-w-0 flex-1">
							<div class="w-2 h-2 rounded-full ${item.status === "up" ? "bg-emerald-500" : item.status === "degraded" ? "bg-yellow-500" : "bg-red-500"} flex-shrink-0"></div>
							<h4 class="font-medium text-white truncate">${item.name}</h4>
						</div>

						<!-- Desktop metrics -->
						<div class="hidden sm:flex items-center space-x-6">
							<div class="text-right">
								<p class="text-sm text-gray-400">Latency</p>
								<p class="text-sm font-semibold text-white">${Math.round(item.latency)}ms</p>
							</div>
							${customMetricsHtml}
							<div class="text-right">
								<p class="text-sm text-gray-400">Uptime (${selectedUptimePeriod})</p>
								<p class="text-sm font-semibold ${uptimeVal! > 99 ? "text-emerald-400" : uptimeVal! > 95 ? "text-yellow-400" : "text-red-400"}">${uptimeVal?.toFixed(
			UPTIME_PRECISION
		)}%</p>
							</div>
						</div>

						<!-- History button -->
						<div class="ml-4">
							<button data-history-id="${
								item.id
							}" data-history-type="monitor" class="cursor-pointer history-btn p-2 hover:bg-gray-800 rounded-lg transition-colors" title="View History">
								<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
								</svg>
							</button>
						</div>
					</div>

					<!-- Mobile metrics -->
					<div class="sm:hidden flex flex-wrap justify-between gap-2 mt-3">
						<div class="text-left">
							<p class="text-xs text-gray-400">Latency</p>
							<p class="text-sm font-semibold text-white">${Math.round(item.latency)}ms</p>
						</div>
						${customMetricsMobileHtml}
						<div class="text-right">
							<p class="text-xs text-gray-400">Uptime (${selectedUptimePeriod})</p>
							<p class="text-sm font-semibold ${uptimeVal! > 99 ? "text-emerald-400" : uptimeVal! > 95 ? "text-yellow-400" : "text-red-400"}">${uptimeVal?.toFixed(
			UPTIME_PRECISION
		)}%</p>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	return div;
}

function addServiceEventListeners(): void {
	// Group header click handlers (for expanding/collapsing)
	document.querySelectorAll(".group-header").forEach((header) => {
		header.addEventListener("click", (e) => {
			// Don't toggle if the click was on a button inside the header
			if ((e.target as HTMLElement).closest("button:not(.group-toggle)")) {
				return;
			}

			const groupId = (e.currentTarget as HTMLElement).getAttribute("data-group-id");
			if (groupId) toggleGroup(groupId);
		});
	});

	// Group toggle buttons
	document.querySelectorAll("button.group-toggle").forEach((button) => {
		button.addEventListener("click", (e) => {
			e.stopPropagation(); // Prevent the header click handler from firing
			const groupId = (e.currentTarget as HTMLElement).getAttribute("data-group-id");
			if (groupId) toggleGroup(groupId);
		});
	});

	// History buttons (both monitors and groups)
	document.querySelectorAll(".history-btn").forEach((button) => {
		button.addEventListener("click", async (e) => {
			const btn = e.currentTarget as HTMLElement;
			const itemId = btn.getAttribute("data-history-id");
			if (itemId) {
				const item = findItemById(itemId);
				if (item) {
					await openHistoryModal(item);
				}
			}
		});
	});
}

function toggleGroup(groupId: string): void {
	const element = document.getElementById(`group-${groupId}`);
	if (!element) return;

	if (expandedGroups.has(groupId)) {
		expandedGroups.delete(groupId);
		element.classList.add("hidden");
	} else {
		expandedGroups.add(groupId);
		element.classList.remove("hidden");
	}

	// Update chevron
	const chevrons = document.querySelectorAll(`[data-group-id="${groupId}"] svg`);
	chevrons.forEach((chevron) => {
		if (!chevron.classList.contains("toggle-group-icon")) return;
		chevron.classList.toggle("rotate-180");
	});
}

// Modal functions
async function openHistoryModal(item: StatusItem): Promise<void> {
	currentModalItem = item;
	currentModalPeriod = selectedUptimePeriod as Period;

	// Update modal title
	document.getElementById("modalTitle")!.textContent = item.name;
	document.getElementById("modalSubtitle")!.textContent = item.type === "group" ? "Group History" : "Monitor History";

	// Show modal
	document.getElementById("historyModal")!.classList.remove("hidden");
	document.body.style.overflow = "hidden";

	// Load history with the currently selected period
	await loadModalHistory(item, currentModalPeriod);
}

function closeHistoryModal(): void {
	document.getElementById("historyModal")!.classList.add("hidden");
	document.body.style.overflow = "auto";

	// Destroy all charts
	destroyAllCharts();

	currentModalItem = null;
}

function destroyAllCharts(): void {
	if (modalCharts.uptime) {
		modalCharts.uptime.destroy();
		modalCharts.uptime = undefined;
	}
	if (modalCharts.latency) {
		modalCharts.latency.destroy();
		modalCharts.latency = undefined;
	}
	if (modalCharts.custom1) {
		modalCharts.custom1.destroy();
		modalCharts.custom1 = undefined;
	}
	if (modalCharts.custom2) {
		modalCharts.custom2.destroy();
		modalCharts.custom2 = undefined;
	}
	if (modalCharts.custom3) {
		modalCharts.custom3.destroy();
		modalCharts.custom3 = undefined;
	}
}

async function loadModalHistory(item: StatusItem, period: Period): Promise<void> {
	try {
		currentModalPeriod = period;

		// Update button states
		document.querySelectorAll(".modal-period-btn").forEach((btn) => {
			const btnPeriod = btn.getAttribute("data-modal-period");
			if (btnPeriod === period) {
				btn.className = "modal-period-btn cursor-pointer px-4 py-2 text-sm rounded-lg bg-gray-700 text-gray-300 transition-colors";
			} else {
				btn.className = "modal-period-btn cursor-pointer px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors";
			}
		});

		// Route to appropriate loader based on item type
		if (item.type === "group") {
			await loadGroupHistory(item, period);
		} else {
			await loadMonitorHistory(item, period);
		}
	} catch (error) {
		console.error(`Error loading ${item.type} history:`, error);
	}
}

async function loadGroupHistory(item: StatusItem, period: Period): Promise<void> {
	// Determine which history endpoint to use based on period
	const historyType = getHistoryTypeForPeriod(period);

	let endpoint: string;
	switch (historyType) {
		case "raw":
			endpoint = `${BACKEND_URL}/v1/groups/${item.id}/history`;
			break;
		case "hourly":
			endpoint = `${BACKEND_URL}/v1/groups/${item.id}/history/hourly`;
			break;
		case "daily":
			endpoint = `${BACKEND_URL}/v1/groups/${item.id}/history/daily`;
			break;
	}

	const response = await fetch(endpoint);
	if (!response.ok) throw new Error(`Failed to fetch group history`);

	const historyData: GroupHistoryResponse = await response.json();

	// Filter data based on the selected period
	const cutoffTime = getTimeRangeForPeriod(period);
	let filteredData = historyData.data.filter((d) => parseTimestamp(d.timestamp).getTime() >= cutoffTime);

	// For 24h period with raw data, aggregate to 10-minute intervals for better chart performance
	if (period === "24h" && historyType === "raw") {
		filteredData = aggregateTo10MinIntervals(filteredData);
	}

	// Fill missing intervals with 0 uptime for hourly/daily data
	const filledData = fillMissingIntervals(filteredData, period, historyType);

	// Process data
	const labels = filledData.map((d) => formatLabelForPeriod(d.timestamp, period));
	const uptimeData = filledData.map((d) => d.uptime);
	const latencyMinData = filledData.map((d) => d.latency_min ?? null);
	const latencyMaxData = filledData.map((d) => d.latency_max ?? null);
	const latencyAvgData = filledData.map((d) => d.latency_avg ?? null);

	// Destroy existing charts
	destroyAllCharts();

	// Create uptime chart
	const uptimeCtx = (document.getElementById("modal-uptime-chart") as HTMLCanvasElement).getContext("2d")!;
	modalCharts.uptime = new Chart(uptimeCtx, {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Uptime %",
					data: uptimeData,
					backgroundColor: uptimeData.map((v) => (v >= 99 ? "rgba(16, 185, 129, 0.8)" : v >= 95 ? "rgba(251, 191, 36, 0.8)" : "rgba(239, 68, 68, 0.8)")),
					borderColor: uptimeData.map((v) => (v >= 99 ? "rgba(16, 185, 129, 1)" : v >= 95 ? "rgba(251, 191, 36, 1)" : "rgba(239, 68, 68, 1)")),
					borderWidth: 1,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					display: false,
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							return `Uptime: ${context.parsed.y?.toFixed(UPTIME_PRECISION)}%`;
						},
					},
				},
				zoom: {
					pan: {
						enabled: true,
						mode: "x",
					},
					zoom: {
						wheel: {
							enabled: true,
							speed: 0.1,
						},
						pinch: {
							enabled: true,
						},
						mode: "x",
					},
					limits: {
						x: {
							min: "original",
							max: "original",
							minRange: 10,
						},
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					max: 100,
					ticks: {
						callback: function (value) {
							return value + "%";
						},
						color: "#9CA3AF",
					},
					grid: {
						color: "rgba(156, 163, 175, 0.1)",
					},
				},
				x: {
					ticks: {
						color: "#9CA3AF",
						maxRotation: 45,
						minRotation: 45,
					},
					grid: {
						display: false,
					},
				},
			},
		},
	});

	// Create latency chart (simpler for groups - only avg, no min/max)
	const hasLatencyData = latencyAvgData.some((v) => v !== null);

	if (hasLatencyData) {
		const latencyCtx = (document.getElementById("modal-latency-chart") as HTMLCanvasElement).getContext("2d")!;
		modalCharts.latency = new Chart(latencyCtx, {
			type: "line",
			data: {
				labels: labels,
				datasets: [
					{
						label: "Min Latency",
						data: latencyMinData,
						borderColor: "rgba(16, 185, 129, 0.5)",
						borderDash: [5, 5],
						tension: 0.3,
						fill: false,
						pointRadius: 0,
					},
					{
						label: "Avg Latency",
						data: latencyAvgData,
						borderColor: "rgba(59, 130, 246, 1)",
						backgroundColor: "rgba(59, 130, 246, 0.1)",
						tension: 0.3,
						fill: false,
						pointRadius: 0,
					},
					{
						label: "Max Latency",
						data: latencyMaxData,
						borderColor: "rgba(239, 68, 68, 0.5)",
						borderDash: [5, 5],
						tension: 0.3,
						fill: false,
						pointRadius: 0,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: "index",
					intersect: false,
				},
				plugins: {
					legend: {
						labels: {
							color: "#9CA3AF",
							usePointStyle: true,
							pointStyle: "line",
						},
					},
					tooltip: {
						mode: "index",
						intersect: false,
						callbacks: {
							label: function (context) {
								const value = context.parsed.y;
								if (value === null || value === undefined) return "";
								return `${context.dataset.label}: ${Math.round(value)}ms`;
							},
						},
					},
					zoom: {
						pan: {
							enabled: true,
							mode: "x",
						},
						zoom: {
							wheel: {
								enabled: true,
								speed: 0.1,
							},
							pinch: {
								enabled: true,
							},
							mode: "x",
						},
						limits: {
							x: {
								min: "original",
								max: "original",
								minRange: 10,
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value) {
								return value + "ms";
							},
							color: "#9CA3AF",
						},
						grid: {
							color: "rgba(156, 163, 175, 0.1)",
						},
					},
					x: {
						ticks: {
							color: "#9CA3AF",
							maxRotation: 45,
							minRotation: 45,
						},
						grid: {
							display: false,
						},
					},
				},
			},
		});
	}

	// Hide custom metric containers for groups (they don't have custom metrics)
	document.getElementById("custom1-chart-container")!.classList.add("hidden");
	document.getElementById("custom2-chart-container")!.classList.add("hidden");
	document.getElementById("custom3-chart-container")!.classList.add("hidden");
	// Set up chart sync
	setupChartSync();

	// Update stats
	updateModalStats(item);
}

// Helper function to create a custom metric chart
function createCustomMetricChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	minData: (number | null)[],
	avgData: (number | null)[],
	maxData: (number | null)[],
	config: CustomMetricConfig
): Chart {
	const unit = config.unit || "";

	return new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: `Min ${config.name}`,
					data: minData,
					borderColor: "rgba(16, 185, 129, 0.5)",
					borderDash: [5, 5],
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: `Avg ${config.name}`,
					data: avgData,
					borderColor: "rgba(168, 85, 247, 1)",
					backgroundColor: "rgba(168, 85, 247, 0.1)",
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: `Max ${config.name}`,
					data: maxData,
					borderColor: "rgba(239, 68, 68, 0.5)",
					borderDash: [5, 5],
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					labels: {
						color: "#9CA3AF",
						usePointStyle: true,
						pointStyle: "line",
					},
				},
				tooltip: {
					mode: "index",
					intersect: false,
					callbacks: {
						label: function (context) {
							const value = context.parsed.y;
							if (value === null || value === undefined) return "";
							return `${context.dataset.label}: ${Math.round(value)} ${unit}`;
						},
					},
				},
				zoom: {
					pan: {
						enabled: true,
						mode: "x",
					},
					zoom: {
						wheel: {
							enabled: true,
							speed: 0.1,
						},
						pinch: {
							enabled: true,
						},
						mode: "x",
					},
					limits: {
						x: {
							min: "original",
							max: "original",
							minRange: 10,
						},
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						callback: function (value) {
							return `${value} ${unit}`;
						},
						color: "#9CA3AF",
					},
					grid: {
						color: "rgba(156, 163, 175, 0.1)",
					},
				},
				x: {
					ticks: {
						color: "#9CA3AF",
						maxRotation: 45,
						minRotation: 45,
					},
					grid: {
						display: false,
					},
				},
			},
		},
	});
}

async function loadMonitorHistory(item: StatusItem, period: Period): Promise<void> {
	// Determine which history endpoint to use based on period
	const historyType = getHistoryTypeForPeriod(period);

	let endpoint: string;
	switch (historyType) {
		case "raw":
			endpoint = `${BACKEND_URL}/v1/monitors/${item.id}/history`;
			break;
		case "hourly":
			endpoint = `${BACKEND_URL}/v1/monitors/${item.id}/history/hourly`;
			break;
		case "daily":
			endpoint = `${BACKEND_URL}/v1/monitors/${item.id}/history/daily`;
			break;
	}

	const response = await fetch(endpoint);
	if (!response.ok) throw new Error(`Failed to fetch monitor history`);

	const historyData: MonitorHistoryResponse = await response.json();

	// Filter data based on the selected period
	const cutoffTime = getTimeRangeForPeriod(period);
	let filteredData = historyData.data.filter((d) => parseTimestamp(d.timestamp).getTime() >= cutoffTime);

	// For 24h period with raw data, aggregate to 10-minute intervals for better chart performance
	if (period === "24h" && historyType === "raw") {
		filteredData = aggregateTo10MinIntervals(filteredData);
	}

	// Fill missing intervals with 0 uptime for hourly/daily data
	const filledData = fillMissingIntervals(filteredData, period, historyType);

	// Process data
	const labels = filledData.map((d) => formatLabelForPeriod(d.timestamp, period));
	const uptimeData = filledData.map((d) => d.uptime);
	const latencyAvgData = filledData.map((d) => d.latency_avg ?? null);
	const latencyMinData = filledData.map((d) => d.latency_min ?? null);
	const latencyMaxData = filledData.map((d) => d.latency_max ?? null);

	// Destroy existing charts
	destroyAllCharts();

	// Create uptime chart
	const uptimeCtx = (document.getElementById("modal-uptime-chart") as HTMLCanvasElement).getContext("2d")!;
	modalCharts.uptime = new Chart(uptimeCtx, {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Uptime %",
					data: uptimeData,
					backgroundColor: uptimeData.map((v) => (v >= 99 ? "rgba(16, 185, 129, 0.8)" : v >= 95 ? "rgba(251, 191, 36, 0.8)" : "rgba(239, 68, 68, 0.8)")),
					borderColor: uptimeData.map((v) => (v >= 99 ? "rgba(16, 185, 129, 1)" : v >= 95 ? "rgba(251, 191, 36, 1)" : "rgba(239, 68, 68, 1)")),
					borderWidth: 1,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					display: false,
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							return `Uptime: ${context.parsed.y?.toFixed(UPTIME_PRECISION)}%`;
						},
					},
				},
				zoom: {
					pan: {
						enabled: true,
						mode: "x",
					},
					zoom: {
						wheel: {
							enabled: true,
							speed: 0.1,
						},
						pinch: {
							enabled: true,
						},
						mode: "x",
					},
					limits: {
						x: {
							min: "original",
							max: "original",
							minRange: 10,
						},
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					max: 100,
					ticks: {
						callback: function (value) {
							return value + "%";
						},
						color: "#9CA3AF",
					},
					grid: {
						color: "rgba(156, 163, 175, 0.1)",
					},
				},
				x: {
					ticks: {
						color: "#9CA3AF",
						maxRotation: 45,
						minRotation: 45,
					},
					grid: {
						display: false,
					},
				},
			},
		},
	});

	// Create latency chart
	const latencyCtx = (document.getElementById("modal-latency-chart") as HTMLCanvasElement).getContext("2d")!;
	modalCharts.latency = new Chart(latencyCtx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Min Latency",
					data: latencyMinData,
					borderColor: "rgba(16, 185, 129, 0.5)",
					borderDash: [5, 5],
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: "Avg Latency",
					data: latencyAvgData,
					borderColor: "rgba(59, 130, 246, 1)",
					backgroundColor: "rgba(59, 130, 246, 0.1)",
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: "Max Latency",
					data: latencyMaxData,
					borderColor: "rgba(239, 68, 68, 0.5)",
					borderDash: [5, 5],
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					labels: {
						color: "#9CA3AF",
						usePointStyle: true,
						pointStyle: "line",
					},
				},
				tooltip: {
					mode: "index",
					intersect: false,
					callbacks: {
						label: function (context) {
							const value = context.parsed.y;
							if (value === null || value === undefined) return "";
							return `${context.dataset.label}: ${Math.round(value)}ms`;
						},
					},
				},
				zoom: {
					pan: {
						enabled: true,
						mode: "x",
					},
					zoom: {
						wheel: {
							enabled: true,
							speed: 0.1,
						},
						pinch: {
							enabled: true,
						},
						mode: "x",
					},
					limits: {
						x: {
							min: "original",
							max: "original",
							minRange: 10,
						},
					},
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						callback: function (value) {
							return value + "ms";
						},
						color: "#9CA3AF",
					},
					grid: {
						color: "rgba(156, 163, 175, 0.1)",
					},
				},
				x: {
					ticks: {
						color: "#9CA3AF",
						maxRotation: 45,
						minRotation: 45,
					},
					grid: {
						display: false,
					},
				},
			},
		},
	});

	// Create custom metrics charts if data is available
	const customMetrics = historyData.customMetrics;

	// Custom Metric 1
	const custom1Container = document.getElementById("custom1-chart-container")!;
	if (customMetrics?.custom1 && filledData.some((d) => d.custom1_avg !== undefined)) {
		const custom1Config = customMetrics.custom1;
		const custom1MinData = filledData.map((d) => d.custom1_min ?? null);
		const custom1MaxData = filledData.map((d) => d.custom1_max ?? null);
		const custom1AvgData = filledData.map((d) => d.custom1_avg ?? null);

		document.getElementById("custom1-chart-title")!.textContent = `${custom1Config.name} History`;
		custom1Container.classList.remove("hidden");

		const custom1Ctx = (document.getElementById("modal-custom1-chart") as HTMLCanvasElement).getContext("2d")!;
		modalCharts.custom1 = createCustomMetricChart(custom1Ctx, labels, custom1MinData, custom1AvgData, custom1MaxData, custom1Config);
	} else {
		custom1Container.classList.add("hidden");
	}

	// Custom Metric 2
	const custom2Container = document.getElementById("custom2-chart-container")!;
	if (customMetrics?.custom2 && filledData.some((d) => d.custom2_avg !== undefined)) {
		const custom2Config = customMetrics.custom2;
		const custom2MinData = filledData.map((d) => d.custom2_min ?? null);
		const custom2MaxData = filledData.map((d) => d.custom2_max ?? null);
		const custom2AvgData = filledData.map((d) => d.custom2_avg ?? null);

		document.getElementById("custom2-chart-title")!.textContent = `${custom2Config.name} History`;
		custom2Container.classList.remove("hidden");

		const custom2Ctx = (document.getElementById("modal-custom2-chart") as HTMLCanvasElement).getContext("2d")!;
		modalCharts.custom2 = createCustomMetricChart(custom2Ctx, labels, custom2MinData, custom2AvgData, custom2MaxData, custom2Config);
	} else {
		custom2Container.classList.add("hidden");
	}

	// Custom Metric 3
	const custom3Container = document.getElementById("custom3-chart-container")!;
	if (customMetrics?.custom3 && filledData.some((d) => d.custom3_avg !== undefined)) {
		const custom3Config = customMetrics.custom3;
		const custom3MinData = filledData.map((d) => d.custom3_min ?? null);
		const custom3MaxData = filledData.map((d) => d.custom3_max ?? null);
		const custom3AvgData = filledData.map((d) => d.custom3_avg ?? null);

		document.getElementById("custom3-chart-title")!.textContent = `${custom3Config.name} History`;
		custom3Container.classList.remove("hidden");

		const custom3Ctx = (document.getElementById("modal-custom3-chart") as HTMLCanvasElement).getContext("2d")!;
		modalCharts.custom3 = createCustomMetricChart(custom3Ctx, labels, custom3MinData, custom3AvgData, custom3MaxData, custom3Config);
	} else {
		custom3Container.classList.add("hidden");
	}

	// Set up chart sync
	setupChartSync();

	// Update stats
	updateModalStats(item);
}

function setupChartSync(): void {
	const allCharts = [modalCharts.uptime, modalCharts.latency, modalCharts.custom1, modalCharts.custom2, modalCharts.custom3].filter(Boolean) as Chart[];

	const syncCharts = (sourceChart: Chart) => {
		const { min, max } = sourceChart.scales.x!;
		for (const chart of allCharts) {
			if (chart !== sourceChart) {
				chart.zoomScale("x", { min, max }, "none");
			}
		}
	};

	for (const chart of allCharts) {
		chart.options.plugins!.zoom!.zoom!.onZoomComplete = function ({ chart: c }) {
			syncCharts(c);
		};
		chart.options.plugins!.zoom!.pan!.onPanComplete = function ({ chart: c }) {
			syncCharts(c);
		};
	}
}

function updateModalStats(item: StatusItem): void {
	const statsHtml = `
		<div class="bg-gray-800/50 rounded-lg p-4">
			<p class="text-xs text-gray-400 mb-1">Last Check</p>
			<p class="text-sm text-gray-300">${item.lastCheck ? getDateTime(item.lastCheck) : "-"}</p>
		</div>
		<div class="bg-gray-800/50 rounded-lg p-4">
			<p class="text-xs text-gray-400 mb-1">1 Day Uptime</p>
			<p class="text-sm font-semibold ${(item.uptime24h || 0) > 99 ? "text-emerald-400" : (item.uptime24h || 0) > 95 ? "text-yellow-400" : "text-red-400"}">
				${item.uptime24h?.toFixed(UPTIME_PRECISION) || "-"}%
			</p>
		</div>
		<div class="bg-gray-800/50 rounded-lg p-4">
			<p class="text-xs text-gray-400 mb-1">30 Day Uptime</p>
			<p class="text-sm font-semibold ${(item.uptime30d || 0) > 99 ? "text-emerald-400" : (item.uptime30d || 0) > 95 ? "text-yellow-400" : "text-red-400"}">
				${item.uptime30d?.toFixed(UPTIME_PRECISION) || "-"}%
			</p>
		</div>
		<div class="bg-gray-800/50 rounded-lg p-4">
			<p class="text-xs text-gray-400 mb-1">365 Day Uptime</p>
			<p class="text-sm font-semibold ${(item.uptime365d || 0) > 99 ? "text-emerald-400" : (item.uptime365d || 0) > 95 ? "text-yellow-400" : "text-red-400"}">
				${item.uptime365d?.toFixed(UPTIME_PRECISION) || "-"}%
			</p>
		</div>
	`;

	document.getElementById("modalStats")!.innerHTML = statsHtml;
}

function findItemById(itemId: string, items: StatusItem[] = statusData?.items || []): StatusItem | null {
	for (const item of items) {
		if (item.id === itemId) return item;
		if (item.children) {
			const found = findItemById(itemId, item.children);
			if (found) return found;
		}
	}
	return null;
}

// Window exports for HTML onclick handlers
(window as any).openHistoryModal = openHistoryModal;
(window as any).closeHistoryModal = closeHistoryModal;

// Start the application
init();
