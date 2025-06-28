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
	uptime1h?: number;
	uptime24h?: number;
	uptime7d?: number;
	uptime30d?: number;
	uptime90d?: number;
	uptime365d?: number;
	children?: StatusItem[];
}

interface HistoryData {
	monitorId?: string;
	groupId?: string;
	period: string;
	data: Array<{
		time: string;
		avg_latency: number;
		min_latency: number;
		max_latency: number;
		uptime: number;
	}>;
}

if (!["1h", "24h", "7d", "30d", "90d", "365d"].includes(globalThis.DEFAULT_PERIOD)) {
	globalThis.DEFAULT_PERIOD = "24h";
}

// Global state
let statusData: StatusData | null = null;
let selectedUptimePeriod = DEFAULT_PERIOD;
let expandedGroups = new Set<string>();
let modalCharts: { uptime?: Chart; latency?: Chart } = {};
let currentModalItem: string | null = null;
let currentModalType: "group" | "monitor" | null = null;

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
			const period = (e.currentTarget as HTMLElement).getAttribute("data-modal-period");
			if (period && currentModalItem && currentModalType) {
				await loadModalHistory(currentModalItem, currentModalType, period);
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
	const overallUp = !statusData.items.some((item) => item.status === "down");
	const overallStatusEl = document.getElementById("overallStatus")!;
	const statusDot = overallStatusEl.querySelector("div")!;
	const statusText = overallStatusEl.querySelector("span")!;

	if (overallUp) {
		statusDot.className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse-slow";
		statusText.className = "text-sm font-medium text-emerald-400";
		statusText.textContent = "All Systems Operational";
	} else {
		statusDot.className = "w-3 h-3 rounded-full bg-red-500 animate-pulse-slow";
		statusText.className = "text-sm font-medium text-red-400";
		statusText.textContent = "Partial Outage";
	}

	// Calculate summary stats
	let servicesUp = 0;
	let servicesDown = 0;

	function countServices(items: StatusItem[]): void {
		items.forEach((item) => {
			if (item.children) {
				countServices(item.children);
			} else {
				console.log(item.id);
				if (item.status === "up") servicesUp++;
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
	document.getElementById("servicesDown")!.textContent = servicesDown.toString();

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
							<button data-history-id="${item.id}" data-history-type="group" data-history-name="${
			item.name
		}" class="cursor-pointer history-btn p-2 hover:bg-gray-800 rounded-lg transition-colors" title="View History">
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
		// Monitor
		const uptimeVal = getUptimeValue(item, selectedUptimePeriod);
		div.innerHTML = `
			<div class="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
				<div class="px-6 py-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center space-x-3 min-w-0 flex-1">
							<div class="w-2 h-2 rounded-full ${item.status === "up" ? "bg-emerald-500" : "bg-red-500"} flex-shrink-0"></div>
							<h4 class="font-medium text-white truncate">${item.name}</h4>
						</div>

						<!-- Desktop metrics -->
						<div class="hidden sm:flex items-center space-x-6">
							<div class="text-right">
								<p class="text-sm text-gray-400">Latency</p>
								<p class="text-sm font-semibold text-white">${Math.round(item.latency)}ms</p>
							</div>
							<div class="text-right">
								<p class="text-sm text-gray-400">Uptime (${selectedUptimePeriod})</p>
								<p class="text-sm font-semibold ${uptimeVal! > 99 ? "text-emerald-400" : uptimeVal! > 95 ? "text-yellow-400" : "text-red-400"}">${uptimeVal?.toFixed(
			UPTIME_PRECISION
		)}%</p>
							</div>
						</div>

						<!-- History button -->
						<div class="ml-4">
							<button data-history-id="${item.id}" data-history-type="monitor" data-history-name="${
			item.name
		}" class="cursor-pointer history-btn p-2 hover:bg-gray-800 rounded-lg transition-colors" title="View History">
								<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
								</svg>
							</button>
						</div>
					</div>

					<!-- Mobile metrics -->
					<div class="sm:hidden flex justify-between mt-3">
						<div class="text-left">
							<p class="text-xs text-gray-400">Latency</p>
							<p class="text-sm font-semibold text-white">${Math.round(item.latency)}ms</p>
						</div>
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

	// History buttons
	document.querySelectorAll(".history-btn").forEach((button) => {
		button.addEventListener("click", async (e) => {
			const btn = e.currentTarget as HTMLElement;
			const itemId = btn.getAttribute("data-history-id");
			const itemType = btn.getAttribute("data-history-type") as "group" | "monitor";
			const itemName = btn.getAttribute("data-history-name");
			if (itemId && itemType && itemName) {
				await openHistoryModal(itemId, itemType, itemName);
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
async function openHistoryModal(itemId: string, itemType: "group" | "monitor", itemName: string): Promise<void> {
	currentModalItem = itemId;
	currentModalType = itemType;

	// Update modal title
	document.getElementById("modalTitle")!.textContent = itemName;
	document.getElementById("modalSubtitle")!.textContent = `${itemType === "group" ? "Group" : "Monitor"} History`;

	// Show modal
	document.getElementById("historyModal")!.classList.remove("hidden");
	document.body.style.overflow = "hidden";

	// Load default period
	await loadModalHistory(itemId, itemType, selectedUptimePeriod);
}

function closeHistoryModal(): void {
	document.getElementById("historyModal")!.classList.add("hidden");
	document.body.style.overflow = "auto";

	// Destroy charts
	if (modalCharts.uptime) {
		modalCharts.uptime.destroy();
		modalCharts.uptime = undefined;
	}
	if (modalCharts.latency) {
		modalCharts.latency.destroy();
		modalCharts.latency = undefined;
	}

	currentModalItem = null;
	currentModalType = null;
}

async function loadModalHistory(itemId: string, itemType: "group" | "monitor", period: string): Promise<void> {
	try {
		// Update button states
		document.querySelectorAll(".modal-period-btn").forEach((btn) => {
			const btnPeriod = btn.getAttribute("data-modal-period");
			if (btnPeriod === period) {
				btn.className = "modal-period-btn cursor-pointer px-4 py-2 text-sm rounded-lg bg-gray-700 text-gray-300 transition-colors";
			} else {
				btn.className = "modal-period-btn cursor-pointer px-4 py-2 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors";
			}
		});

		// Fetch history
		const endpoint =
			itemType === "monitor" ? `${BACKEND_URL}/v1/monitors/${itemId}/history?period=${period}` : `${BACKEND_URL}/v1/groups/${itemId}/history?period=${period}`;

		const response = await fetch(endpoint);
		if (!response.ok) throw new Error(`Failed to fetch ${itemType} history`);

		const historyData: HistoryData = await response.json();

		// Process data
		const labels = historyData.data.map((d) => {
			const date = new Date(d.time);
			if (period === "1h" || period === "24h") {
				return getTime(date, false);
			} else if (period === "7d") {
				return getDateTime(date, false);
			} else {
				return getDate(date);
			}
		});

		const uptimeData = historyData.data.map((d) => d.uptime);
		const latencyData = historyData.data.map((d) => d.avg_latency);
		const minLatencyData = historyData.data.map((d) => d.min_latency);
		const maxLatencyData = historyData.data.map((d) => d.max_latency);

		// Destroy existing charts
		if (modalCharts.uptime) modalCharts.uptime.destroy();
		if (modalCharts.latency) modalCharts.latency.destroy();

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
								return `Uptime: ${context.parsed.y.toFixed(UPTIME_PRECISION)}%`;
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
								minRange: 10, // Minimum 10 data points visible
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
						label: "Avg Latency",
						data: latencyData,
						borderColor: "rgba(59, 130, 246, 1)",
						backgroundColor: "rgba(59, 130, 246, 0.1)",
						tension: 0.3,
						fill: true,
					},
					{
						label: "Min Latency",
						data: minLatencyData,
						borderColor: "rgba(16, 185, 129, 0.5)",
						borderDash: [5, 5],
						tension: 0.3,
						fill: false,
						pointRadius: 0,
					},
					{
						label: "Max Latency",
						data: maxLatencyData,
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
								return `${context.dataset.label}: ${Math.round(context.parsed.y)}ms`;
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
								minRange: 10, // Minimum 10 data points visible
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

		const syncCharts = (sourceChart: Chart) => {
			const { min, max } = sourceChart.scales.x!;
			if (sourceChart === modalCharts.uptime && modalCharts.latency) {
				modalCharts.latency.zoomScale("x", { min, max }, "none");
			} else if (sourceChart === modalCharts.latency && modalCharts.uptime) {
				modalCharts.uptime.zoomScale("x", { min, max }, "none");
			}
		};

		// Set up event handlers for both charts
		if (modalCharts.uptime) {
			modalCharts.uptime.options.plugins!.zoom!.zoom!.onZoomComplete = function ({ chart }) {
				syncCharts(chart);
			};
			modalCharts.uptime.options.plugins!.zoom!.pan!.onPanComplete = function ({ chart }) {
				syncCharts(chart);
			};
		}

		if (modalCharts.latency) {
			modalCharts.latency.options.plugins!.zoom!.zoom!.onZoomComplete = function ({ chart }) {
				syncCharts(chart);
			};
			modalCharts.latency.options.plugins!.zoom!.pan!.onPanComplete = function ({ chart }) {
				syncCharts(chart);
			};
		}

		// Update stats
		updateModalStats(itemId, itemType);
	} catch (error) {
		console.error(`Error loading ${itemType} history:`, error);
	}
}

function updateModalStats(itemId: string, itemType: string): void {
	const item = findItemById(itemId);
	if (!item) return;

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
