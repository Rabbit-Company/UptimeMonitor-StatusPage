import Chart from "chart.js/auto";

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
	status: "up" | "down";
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

interface MonitorHistoryData {
	monitorId: string;
	period: string;
	data: Array<{
		time: string;
		avg_latency: number;
		min_latency: number;
		max_latency: number;
		uptime: number;
	}>;
}

// Global state
let statusData: StatusData | null = null;
let selectedUptimePeriod = DEFAULT_PERIOD;
let charts: Record<string, any> = {};
let expandedMonitors = new Set<string>();

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
}

function renderPage(): void {
	if (!statusData) return;

	expandedMonitors.forEach((monitorId) => {
		// Destroy any existing charts
		if (charts[`uptime-${monitorId}`]) {
			charts[`uptime-${monitorId}`].destroy();
			delete charts[`uptime-${monitorId}`];
		}
		if (charts[`latency-${monitorId}`]) {
			charts[`latency-${monitorId}`].destroy();
			delete charts[`latency-${monitorId}`];
		}
	});
	expandedMonitors.clear();

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
	let totalUptime = 0;
	let totalLatency = 0;
	let servicesUp = 0;
	let servicesDown = 0;
	let serviceCount = 0;

	function countServices(items: StatusItem[]): void {
		items.forEach((item) => {
			if (item.type === "monitor") {
				serviceCount++;
				const uptimeVal = getUptimeValue(item, selectedUptimePeriod) || 0;
				totalUptime += uptimeVal;
				totalLatency += item.latency || 0;
				if (item.status === "up") servicesUp++;
				else servicesDown++;
			} else if (item.children) {
				countServices(item.children);
			}
		});
	}

	countServices(statusData.items);

	document.getElementById("uptimeValue")!.textContent = serviceCount > 0 ? `${(totalUptime / serviceCount).toFixed(UPTIME_PRECISION)}%` : "-";
	document.getElementById("avgLatency")!.textContent = serviceCount > 0 ? `${Math.round(totalLatency / serviceCount)}ms` : "-";
	document.getElementById("servicesUp")!.textContent = servicesUp.toString();
	document.getElementById("servicesDown")!.textContent = servicesDown.toString();

	document.getElementById("lastUpdated")!.textContent = new Date(statusData.lastUpdated).toLocaleString();

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
	div.className = depth > 0 ? "ml-8" : "";

	if (item.type === "group") {
		// Group header
		const isExpanded = expandedMonitors.has(item.id);
		const uptimeVal = getUptimeValue(item, selectedUptimePeriod);
		div.innerHTML = `
			<div class="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
				<button data-group-id="${item.id}" class="group-toggle w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
					<div class="flex items-center space-x-3">
						<div class="w-2 h-2 rounded-full ${item.status === "up" ? "bg-emerald-500" : "bg-red-500"}"></div>
						<h3 class="text-lg font-semibold text-white">${item.name}</h3>
					</div>
					<div class="flex items-center space-x-6">
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
						<svg class="w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
					</div>
				</button>
				<div id="group-${item.id}" class="${isExpanded ? "" : "hidden"}">
					<div class="px-6 py-4 border-t border-gray-800 space-y-4">
						${item.children?.map((child) => renderServiceItem(child, depth + 1).outerHTML).join("") || ""}
					</div>
				</div>
			</div>
		`;
	} else if (item.type === "monitor") {
		// Monitor item
		const isExpanded = expandedMonitors.has(item.id);
		const uptimeVal = getUptimeValue(item, selectedUptimePeriod);
		div.innerHTML = `
			<div class="bg-gray-900/50 backdrop-blur rounded-xl border border-gray-800 overflow-hidden">
				<button data-monitor-id="${item.id}" class="monitor-toggle w-full px-6 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
					<div class="flex items-center justify-between w-full">
						<div class="flex items-center space-x-3">
							<div class="w-2 h-2 rounded-full ${item.status === "up" ? "bg-emerald-500" : "bg-red-500"}"></div>
							<h4 class="font-medium text-white">${item.name}</h4>
						</div>
						<div class="flex items-center space-x-6">
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
							<svg class="w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</div>
					</div>
				</button>
				<div id="monitor-${item.id}" class="${isExpanded ? "" : "hidden"}">
					<div class="px-6 py-4 border-t border-gray-800">
						<!-- Time period selector -->
						<div class="flex space-x-2 mb-4">
							<button data-monitor-id="${
								item.id
							}" data-period="1h" class="period-btn px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">1h</button>
							<button data-monitor-id="${
								item.id
							}" data-period="24h" class="period-btn px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">24h</button>
							<button data-monitor-id="${
								item.id
							}" data-period="7d" class="period-btn px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">7d</button>
							<button data-monitor-id="${item.id}" data-period="30d" class="period-btn px-3 py-1 text-sm rounded-lg bg-gray-700 text-gray-300 transition-colors">30d</button>
							<button data-monitor-id="${
								item.id
							}" data-period="90d" class="period-btn px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">90d</button>
							<button data-monitor-id="${
								item.id
							}" data-period="365d" class="period-btn px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">365d</button>
						</div>
						<!-- Charts -->
						<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div>
								<h5 class="text-sm font-medium text-gray-400 mb-2">Uptime</h5>
								<div class="chart-container">
									<canvas id="uptime-chart-${item.id}"></canvas>
								</div>
							</div>
							<div>
								<h5 class="text-sm font-medium text-gray-400 mb-2">Response Time</h5>
								<div class="chart-container">
									<canvas id="latency-chart-${item.id}"></canvas>
								</div>
							</div>
						</div>
						<!-- Additional info -->
						<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
							<div>
								<p class="text-xs text-gray-500">Last Check</p>
								<p class="text-sm text-gray-300">${new Date(item.lastCheck!).toLocaleString()}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500">7 Day Uptime</p>
								<p class="text-sm text-gray-300">${item.uptime7d?.toFixed(UPTIME_PRECISION)}%</p>
							</div>
							<div>
								<p class="text-xs text-gray-500">30 Day Uptime</p>
								<p class="text-sm text-gray-300">${item.uptime30d?.toFixed(UPTIME_PRECISION)}%</p>
							</div>
							<div>
								<p class="text-xs text-gray-500">90 Day Uptime</p>
								<p class="text-sm text-gray-300">${item.uptime90d?.toFixed(UPTIME_PRECISION)}%</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	return div;
}

function addServiceEventListeners(): void {
	document.querySelectorAll(".group-toggle").forEach((button) => {
		button.addEventListener("click", (e) => {
			const btn = e.currentTarget as HTMLElement;
			const groupId = btn.getAttribute("data-group-id");
			if (groupId) toggleGroup(groupId);
		});
	});

	document.querySelectorAll(".monitor-toggle").forEach((button) => {
		button.addEventListener("click", async (e) => {
			const btn = e.currentTarget as HTMLElement;
			const monitorId = btn.getAttribute("data-monitor-id");
			if (monitorId) await toggleMonitor(monitorId);
		});
	});

	document.querySelectorAll(".period-btn").forEach((button) => {
		button.addEventListener("click", async (e) => {
			const btn = e.currentTarget as HTMLElement;
			const monitorId = btn.getAttribute("data-monitor-id");
			const period = btn.getAttribute("data-period");
			if (monitorId && period) await loadMonitorHistory(monitorId, period);
		});
	});
}

function toggleGroup(groupId: string): void {
	const element = document.getElementById(`group-${groupId}`);
	if (!element) return;

	if (expandedMonitors.has(groupId)) {
		expandedMonitors.delete(groupId);
		element.classList.add("hidden");
	} else {
		expandedMonitors.add(groupId);
		element.classList.remove("hidden");
	}

	// Update chevron
	const button = element.previousElementSibling as HTMLElement;
	const chevron = button.querySelector("svg");
	chevron?.classList.toggle("rotate-180");
}

async function toggleMonitor(monitorId: string): Promise<void> {
	const element = document.getElementById(`monitor-${monitorId}`);
	if (!element) return;

	if (expandedMonitors.has(monitorId)) {
		expandedMonitors.delete(monitorId);
		element.classList.add("hidden");

		// Destroy charts
		if (charts[`uptime-${monitorId}`]) {
			charts[`uptime-${monitorId}`].destroy();
			delete charts[`uptime-${monitorId}`];
		}
		if (charts[`latency-${monitorId}`]) {
			charts[`latency-${monitorId}`].destroy();
			delete charts[`latency-${monitorId}`];
		}
	} else {
		expandedMonitors.add(monitorId);
		element.classList.remove("hidden");

		await loadMonitorHistory(monitorId, selectedUptimePeriod);
	}

	// Update chevron
	const button = element.previousElementSibling as HTMLElement;
	const chevron = button.querySelector("svg");
	chevron?.classList.toggle("rotate-180");
}

async function loadMonitorHistory(monitorId: string, period: string): Promise<void> {
	try {
		// Update button states
		const container = document.getElementById(`monitor-${monitorId}`);
		if (!container) return;

		const buttons = container.querySelectorAll(".period-btn");
		buttons.forEach((btn) => {
			const btnPeriod = btn.getAttribute("data-period");
			if (btnPeriod === period) {
				btn.className = "period-btn px-3 py-1 text-sm rounded-lg bg-gray-700 text-gray-300 transition-colors";
			} else {
				btn.className = "period-btn px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors";
			}
		});

		const response = await fetch(`${BACKEND_URL}/v1/monitors/${monitorId}/history?period=${period}`);
		if (!response.ok) throw new Error("Failed to fetch monitor history");

		const historyData: MonitorHistoryData = await response.json();

		// Process data
		const labels = historyData.data.map((d) => {
			const date = new Date(d.time);
			if (period === "1h" || period === "24h") {
				return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			} else {
				return date.toLocaleDateString([], { month: "short", day: "numeric" });
			}
		});

		const uptimeData = historyData.data.map((d) => d.uptime);
		const latencyData = historyData.data.map((d) => d.avg_latency);
		const minLatencyData = historyData.data.map((d) => d.min_latency);
		const maxLatencyData = historyData.data.map((d) => d.max_latency);

		// Create or update uptime chart
		const uptimeCtx = (document.getElementById(`uptime-chart-${monitorId}`) as HTMLCanvasElement).getContext("2d");
		if (!uptimeCtx) return;

		if (charts[`uptime-${monitorId}`]) {
			charts[`uptime-${monitorId}`].destroy();
		}

		charts[`uptime-${monitorId}`] = new Chart(uptimeCtx, {
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
				plugins: {
					legend: {
						display: false,
					},
					tooltip: {
						callbacks: {
							label: function (context: any) {
								return `Uptime: ${context.parsed.y.toFixed(UPTIME_PRECISION)}%`;
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						max: 100,
						ticks: {
							callback: function (value: any) {
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

		// Create or update latency chart
		const latencyCtx = (document.getElementById(`latency-chart-${monitorId}`) as HTMLCanvasElement).getContext("2d");
		if (!latencyCtx) return;

		if (charts[`latency-${monitorId}`]) {
			charts[`latency-${monitorId}`].destroy();
		}

		charts[`latency-${monitorId}`] = new Chart(latencyCtx, {
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
							label: function (context: any) {
								return `${context.dataset.label}: ${Math.round(context.parsed.y)}ms`;
							},
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: function (value: any) {
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
	} catch (error) {
		console.error("Error loading monitor history:", error);
	}
}

init();
