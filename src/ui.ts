import type { StatusItem, Period } from "./types";
import { UPTIME_PRECISION, LATENCY_PRECISION } from "./config";
import { appState } from "./state";
import { getUptimeValue, getDateTime } from "./utils";
import { loadGroupHistory, loadMonitorHistory } from "./charts";

/**
 * Update overall status indicator
 */
export function updateOverallStatus(): void {
	if (!appState.statusData) return;

	const hasDown = appState.statusData.items.some((item) => item.status === "down");
	const hasDegraded = appState.statusData.items.some((item) => item.status === "degraded");
	const indicator = document.getElementById("overallStatusIndicator")!;
	const text = document.getElementById("overallStatusText")!;

	if (hasDown) {
		indicator.className = "w-2 h-2 rounded-full bg-[var(--status-down)] animate-pulse-slow";
		text.textContent = "Partial Outage";
		text.className = "text-sm text-[var(--status-down-text)]";
	} else if (hasDegraded) {
		indicator.className = "w-2 h-2 rounded-full bg-[var(--status-degraded)] animate-pulse-slow";
		text.textContent = "Degraded Performance";
		text.className = "text-sm text-[var(--status-degraded-text)]";
	} else {
		indicator.className = "w-2 h-2 rounded-full bg-[var(--status-up)] animate-pulse-slow";
		text.textContent = "All Systems Operational";
		text.className = "text-sm text-[var(--status-up-text)]";
	}
}

/**
 * Update summary statistics
 */
export function updateSummaryStats(): void {
	if (!appState.statusData) return;

	let servicesUp = 0;
	let servicesDown = 0;
	let servicesDegraded = 0;

	function countServices(items: StatusItem[]): void {
		items.forEach((item) => {
			if (item.type === "monitor") {
				if (item.status === "up") servicesUp++;
				else if (item.status === "degraded") servicesDegraded++;
				else servicesDown++;
			}
			if (item.children) {
				countServices(item.children);
			}
		});
	}

	countServices(appState.statusData.items);

	const latencyValues: number[] = appState.statusData.items.map((i) => i.latency).filter((l) => l !== undefined && l > 0);
	const averageLatency =
		latencyValues.length > 0 ? (latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length).toFixed(LATENCY_PRECISION) + "ms" : "-";

	const avgLatencyEl = document.getElementById("avgLatency")!;
	avgLatencyEl.textContent = averageLatency;
	avgLatencyEl.classList.add("animate-pulse");
	setTimeout(() => avgLatencyEl.classList.remove("animate-pulse"), 1000);

	document.getElementById("servicesUp")!.textContent = servicesUp.toString();
	document.getElementById("servicesDown")!.textContent = (servicesDown + servicesDegraded).toString();
}

/**
 * Update a specific monitor's UI
 */
export function updateMonitorUI(monitorId: string, monitor: StatusItem): void {
	const statusDot = document.querySelector(`[data-status-dot="${monitorId}"]`);
	if (statusDot) {
		const statusClass =
			monitor.status === "up" ? "bg-[var(--status-up)]" : monitor.status === "degraded" ? "bg-[var(--status-degraded)]" : "bg-[var(--status-down)]";
		statusDot.className = `w-2 h-2 rounded-full flex-shrink-0 ${statusClass}`;
		statusDot.setAttribute("data-status-dot", monitorId);
	}

	const desktopLatency = document.querySelector(`[data-latency-desktop="${monitorId}"]`);
	if (desktopLatency) {
		desktopLatency.textContent = `${monitor.latency.toFixed(LATENCY_PRECISION)}ms`;
		desktopLatency.classList.add("animate-pulse");
		setTimeout(() => desktopLatency.classList.remove("animate-pulse"), 1000);
	}

	const mobileLatency = document.querySelector(`[data-latency-mobile="${monitorId}"]`);
	if (mobileLatency) {
		mobileLatency.textContent = `${monitor.latency.toFixed(LATENCY_PRECISION)}ms`;
	}

	if (monitor.custom1?.value !== undefined) {
		const custom1Desktop = document.querySelector(`[data-custom1-desktop="${monitorId}"]`);
		const custom1Mobile = document.querySelector(`[data-custom1-mobile="${monitorId}"]`);
		const unit = monitor.custom1.config.unit || "";
		if (custom1Desktop) custom1Desktop.textContent = `${monitor.custom1.value} ${unit}`;
		if (custom1Mobile) custom1Mobile.textContent = `${monitor.custom1.value} ${unit}`;
	}

	if (monitor.custom2?.value !== undefined) {
		const custom2Desktop = document.querySelector(`[data-custom2-desktop="${monitorId}"]`);
		const custom2Mobile = document.querySelector(`[data-custom2-mobile="${monitorId}"]`);
		const unit = monitor.custom2.config.unit || "";
		if (custom2Desktop) custom2Desktop.textContent = `${monitor.custom2.value} ${unit}`;
		if (custom2Mobile) custom2Mobile.textContent = `${monitor.custom2.value} ${unit}`;
	}

	if (monitor.custom3?.value !== undefined) {
		const custom3Desktop = document.querySelector(`[data-custom3-desktop="${monitorId}"]`);
		const custom3Mobile = document.querySelector(`[data-custom3-mobile="${monitorId}"]`);
		const unit = monitor.custom3.config.unit || "";
		if (custom3Desktop) custom3Desktop.textContent = `${monitor.custom3.value} ${unit}`;
		if (custom3Mobile) custom3Mobile.textContent = `${monitor.custom3.value} ${unit}`;
	}
}

/**
 * Update parent groups when a monitor changes
 */
export function updateParentGroups(monitorId: string): void {
	if (!appState.statusData) return;

	function containsMonitor(item: StatusItem, targetId: string): boolean {
		if (item.id === targetId) return true;
		if (item.children) {
			return item.children.some((child) => containsMonitor(child, targetId));
		}
		return false;
	}

	function calculateGroupStatus(item: StatusItem): "up" | "down" | "degraded" {
		if (!item.children) return item.status;

		const hasDown = item.children.some((child) => {
			if (child.type === "group") return calculateGroupStatus(child) === "down";
			return child.status === "down";
		});

		const hasDegraded = item.children.some((child) => {
			if (child.type === "group") return calculateGroupStatus(child) === "degraded";
			return child.status === "degraded";
		});

		return hasDown ? "down" : hasDegraded ? "degraded" : "up";
	}

	function calculateGroupLatency(item: StatusItem): number {
		if (!item.children) return item.latency || 0;

		const latencies: number[] = [];

		for (const child of item.children) {
			if (child.type === "group") {
				const childLatency = calculateGroupLatency(child);
				if (childLatency > 0) latencies.push(childLatency);
			} else if (child.latency !== undefined && child.latency > 0) {
				latencies.push(child.latency);
			}
		}

		return latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
	}

	function updateAncestorGroups(items: StatusItem[]): void {
		for (const item of items) {
			if (item.children) {
				updateAncestorGroups(item.children);
			}

			if (item.type === "group" && item.children && containsMonitor(item, monitorId)) {
				updateAncestorGroups(item.children);

				if (containsMonitor(item, monitorId)) {
					const newStatus = calculateGroupStatus(item);
					if (item.status !== newStatus) {
						item.status = newStatus;

						const statusDot = document.querySelector(`[data-status-dot="${item.id}"]`);
						if (statusDot) {
							const statusClass =
								newStatus === "up" ? "bg-[var(--status-up)]" : newStatus === "degraded" ? "bg-[var(--status-degraded)]" : "bg-[var(--status-down)]";
							statusDot.className = `w-2 h-2 rounded-full flex-shrink-0 ${statusClass}`;
						}
					}

					const newLatency = calculateGroupLatency(item);
					if (newLatency > 0) {
						item.latency = newLatency;

						const desktopLatency = document.querySelector(`[data-latency-desktop="${item.id}"]`);
						const mobileLatency = document.querySelector(`[data-latency-mobile="${item.id}"]`);

						if (desktopLatency) {
							desktopLatency.textContent = `${newLatency.toFixed(LATENCY_PRECISION)}ms`;
							desktopLatency.classList.add("animate-pulse");
							setTimeout(() => desktopLatency.classList.remove("animate-pulse"), 1000);
						}
						if (mobileLatency) {
							mobileLatency.textContent = `${newLatency.toFixed(LATENCY_PRECISION)}ms`;
							mobileLatency.classList.add("animate-pulse");
							setTimeout(() => mobileLatency.classList.remove("animate-pulse"), 1000);
						}
					}
				}
			}
		}
	}

	updateAncestorGroups(appState.statusData.items);
}

/**
 * Render the main page content
 */
export function renderPage(): void {
	if (!appState.statusData) return;

	document.getElementById("serviceName")!.textContent = appState.statusData.name;

	updateOverallStatus();

	let servicesUp = 0;
	let servicesDown = 0;
	let servicesDegraded = 0;

	function countServices(items: StatusItem[]): void {
		items.forEach((item) => {
			if (item.type === "monitor") {
				if (item.status === "up") servicesUp++;
				else if (item.status === "degraded") servicesDegraded++;
				else servicesDown++;
			}
			if (item.children) {
				countServices(item.children);
			}
		});
	}

	countServices(appState.statusData.items);

	const uptimeValues: number[] = appState.statusData.items.map((i) => getUptimeValue(i, appState.selectedUptimePeriod) || 0);
	const averageUptime = uptimeValues.length > 0 ? (uptimeValues.reduce((sum, val) => sum + val, 0) / uptimeValues.length).toFixed(UPTIME_PRECISION) + "%" : "-";

	const latencyValues: number[] = appState.statusData.items.map((i) => i.latency);
	const averageLatency =
		latencyValues.length > 0 ? (latencyValues.reduce((sum, val) => sum + val, 0) / latencyValues.length).toFixed(LATENCY_PRECISION) + "ms" : "-";

	document.getElementById("uptimeValue")!.textContent = averageUptime;
	document.getElementById("avgLatency")!.textContent = averageLatency;
	document.getElementById("servicesUp")!.textContent = servicesUp.toString();
	document.getElementById("servicesDown")!.textContent = (servicesDown + servicesDegraded).toString();

	document.getElementById("lastUpdated")!.textContent = getDateTime(appState.statusData.lastUpdated);

	renderServices();
}

function renderServices(): void {
	if (!appState.statusData) return;

	const container = document.getElementById("servicesList")!;
	container.innerHTML = "";

	appState.statusData.items.forEach((item) => {
		container.appendChild(renderServiceItem(item, 0));
	});

	addServiceEventListeners();
}

function renderServiceItem(item: StatusItem, depth: number): HTMLElement {
	const div = document.createElement("div");
	div.className = depth > 0 ? "ml-0 lg:ml-8" : "";

	if (item.type === "group") {
		div.innerHTML = renderGroupHTML(item);
	} else if (item.type === "monitor") {
		div.innerHTML = renderMonitorHTML(item);
	}

	return div;
}

function getUptimeColorClass(value: number): string {
	if (value > 99) return "text-[var(--status-up-text)]";
	if (value > 95) return "text-[var(--status-degraded-text)]";
	return "text-[var(--status-down-text)]";
}

function getStatusBgClass(status: string): string {
	if (status === "up") return "bg-[var(--status-up)]";
	if (status === "degraded") return "bg-[var(--status-degraded)]";
	return "bg-[var(--status-down)]";
}

function renderGroupHTML(item: StatusItem): string {
	const isGroupExpanded = appState.isGroupExpanded(item.id);
	const uptimeVal = getUptimeValue(item, appState.selectedUptimePeriod);
	const statusColor = getStatusBgClass(item.status);

	return `
		<div class="bg-[var(--bg-secondary)] backdrop-blur rounded-xl border border-[var(--border-primary)] overflow-hidden">
			<div class="px-6 py-4 group-header cursor-pointer group-toggle" data-group-id="${item.id}">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3 min-w-0 flex-1">
						<div data-status-dot="${item.id}" class="w-2 h-2 rounded-full ${statusColor} flex-shrink-0"></div>
						<h3 class="text-lg font-semibold text-[var(--text-primary)] truncate">${item.name}</h3>
					</div>
					<div class="hidden sm:flex items-center space-x-6">
						${
							item.latency !== undefined && item.latency > 0
								? `
						<div class="text-right">
							<p class="text-sm text-[var(--text-muted)]">Latency</p>
							<p data-latency-desktop="${item.id}" class="text-sm font-semibold text-[var(--text-primary)]">${item.latency.toFixed(LATENCY_PRECISION)}ms</p>
						</div>
						`
								: ""
						}
						${
							uptimeVal !== undefined
								? `
						<div class="text-right">
							<p class="text-sm text-[var(--text-muted)]">Uptime (${appState.selectedUptimePeriod})</p>
							<p data-uptime-desktop="${item.id}" class="text-sm font-semibold ${getUptimeColorClass(uptimeVal)}">${uptimeVal.toFixed(UPTIME_PRECISION)}%</p>
						</div>
						`
								: ""
						}
					</div>
					<div class="flex items-center space-x-2 ml-4">
						<button data-history-id="${item.id}" data-history-type="group" class="cursor-pointer history-btn p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors" title="View History">
							<svg class="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
							</svg>
						</button>
						<button data-group-id="${item.id}" class="cursor-pointer group-toggle p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors" title="Toggle Group">
							<svg class="toggle-group-icon w-5 h-5 text-[var(--text-muted)] transform transition-transform ${isGroupExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
					</div>
				</div>
				<div class="sm:hidden flex justify-between mt-3">
					${
						item.latency !== undefined && item.latency > 0
							? `
					<div class="text-left">
						<p class="text-xs text-[var(--text-muted)]">Latency</p>
						<p data-latency-mobile="${item.id}" class="text-sm font-semibold text-[var(--text-primary)]">${item.latency.toFixed(LATENCY_PRECISION)}ms</p>
					</div>
					`
							: "<div></div>"
					}
					${
						uptimeVal !== undefined
							? `
					<div class="text-right">
						<p class="text-xs text-[var(--text-muted)]">Uptime (${appState.selectedUptimePeriod})</p>
						<p data-uptime-mobile="${item.id}" class="text-sm font-semibold ${getUptimeColorClass(uptimeVal)}">${uptimeVal.toFixed(UPTIME_PRECISION)}%</p>
					</div>
					`
							: ""
					}
				</div>
			</div>
			<div id="group-${item.id}" class="${isGroupExpanded ? "" : "hidden"}">
				<div class="px-6 py-4 border-t border-[var(--border-primary)] space-y-4">
					${item.children?.map((child) => renderServiceItem(child, 1).outerHTML).join("") || ""}
				</div>
			</div>
		</div>
	`;
}

function renderMonitorHTML(item: StatusItem): string {
	const uptimeVal = getUptimeValue(item, appState.selectedUptimePeriod);
	const hasChildren = item.children && item.children.length > 0;
	const isExpanded = hasChildren ? appState.isGroupExpanded(item.id) : false;

	let customMetricsHtml = "";
	let customMetricsMobileHtml = "";

	if (item.custom1?.value !== undefined) {
		const unit = item.custom1.config.unit || "";
		customMetricsHtml += `
			<div class="text-right">
				<p class="text-sm text-[var(--text-muted)]">${item.custom1.config.name}</p>
				<p data-custom1-desktop="${item.id}" class="text-sm font-semibold text-[var(--accent-tertiary)]">${item.custom1.value} ${unit}</p>
			</div>
		`;
		customMetricsMobileHtml += `
			<div class="text-center">
				<p class="text-xs text-[var(--text-muted)]">${item.custom1.config.name}</p>
				<p data-custom1-mobile="${item.id}" class="text-sm font-semibold text-[var(--accent-tertiary)]">${item.custom1.value} ${unit}</p>
			</div>
		`;
	}

	if (item.custom2?.value !== undefined) {
		const unit = item.custom2.config.unit || "";
		customMetricsHtml += `
			<div class="text-right">
				<p class="text-sm text-[var(--text-muted)]">${item.custom2.config.name}</p>
				<p data-custom2-desktop="${item.id}" class="text-sm font-semibold text-[var(--accent-secondary)]">${item.custom2.value} ${unit}</p>
			</div>
		`;
		customMetricsMobileHtml += `
			<div class="text-center">
				<p class="text-xs text-[var(--text-muted)]">${item.custom2.config.name}</p>
				<p data-custom2-mobile="${item.id}" class="text-sm font-semibold text-[var(--accent-secondary)]">${item.custom2.value} ${unit}</p>
			</div>
		`;
	}

	if (item.custom3?.value !== undefined) {
		const unit = item.custom3.config.unit || "";
		customMetricsHtml += `
			<div class="text-right">
				<p class="text-sm text-[var(--text-muted)]">${item.custom3.config.name}</p>
				<p data-custom3-desktop="${item.id}" class="text-sm font-semibold text-[var(--accent-primary)]">${item.custom3.value} ${unit}</p>
			</div>
		`;
		customMetricsMobileHtml += `
			<div class="text-center">
				<p class="text-xs text-[var(--text-muted)]">${item.custom3.config.name}</p>
				<p data-custom3-mobile="${item.id}" class="text-sm font-semibold text-[var(--accent-primary)]">${item.custom3.value} ${unit}</p>
			</div>
		`;
	}

	return `
		<div class="bg-[var(--bg-secondary)] backdrop-blur rounded-xl border border-[var(--border-primary)] overflow-hidden">
			<div class="px-6 py-4${hasChildren ? " group-header cursor-pointer" : ""}"${hasChildren ? ` data-group-id="${item.id}"` : ""}>
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3 min-w-0 flex-1">
						<div data-status-dot="${item.id}" class="w-2 h-2 rounded-full ${getStatusBgClass(item.status)} flex-shrink-0"></div>
						<h4 class="font-medium text-[var(--text-primary)] truncate">${item.name}</h4>
					</div>
					<div class="hidden sm:flex items-center space-x-6">
						<div class="text-right">
							<p class="text-sm text-[var(--text-muted)]">Latency</p>
							<p data-latency-desktop="${item.id}" class="text-sm font-semibold text-[var(--text-primary)]">${item.latency.toFixed(LATENCY_PRECISION)}ms</p>
						</div>
						${customMetricsHtml}
						<div class="text-right">
							<p class="text-sm text-[var(--text-muted)]">Uptime (${appState.selectedUptimePeriod})</p>
							<p data-uptime-desktop="${item.id}" class="text-sm font-semibold ${getUptimeColorClass(uptimeVal!)}">${uptimeVal?.toFixed(UPTIME_PRECISION)}%</p>
						</div>
					</div>
					<div class="flex items-center space-x-2 ml-4">
						<button data-history-id="${item.id}" data-history-type="monitor" class="cursor-pointer history-btn p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors" title="View History">
							<svg class="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
							</svg>
						</button>
						${
							hasChildren
								? `
						<button data-group-id="${item.id}" class="cursor-pointer group-toggle p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors" title="Toggle Children">
							<svg class="toggle-group-icon w-5 h-5 text-[var(--text-muted)] transform transition-transform ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						`
								: ""
						}
					</div>
				</div>
				<div class="sm:hidden flex flex-wrap justify-between gap-2 mt-3">
					<div class="text-left">
						<p class="text-xs text-[var(--text-muted)]">Latency</p>
						<p data-latency-mobile="${item.id}" class="text-sm font-semibold text-[var(--text-primary)]">${item.latency.toFixed(LATENCY_PRECISION)}ms</p>
					</div>
					${customMetricsMobileHtml}
					<div class="text-right">
						<p class="text-xs text-[var(--text-muted)]">Uptime (${appState.selectedUptimePeriod})</p>
						<p data-uptime-mobile="${item.id}" class="text-sm font-semibold ${getUptimeColorClass(uptimeVal!)}">${uptimeVal?.toFixed(UPTIME_PRECISION)}%</p>
					</div>
				</div>
			</div>
			${
				hasChildren
					? `
			<div id="group-${item.id}" class="${isExpanded ? "" : "hidden"}">
					<div class="px-6 py-4 border-t border-[var(--border-primary)] space-y-4">
							${item.children?.map((child) => renderServiceItem(child, 1).outerHTML).join("") || ""}
					</div>
			</div>
			`
					: ""
			}
		</div>
	`;
}

function addServiceEventListeners(): void {
	document.querySelectorAll(".group-header").forEach((header) => {
		header.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).closest("button:not(.group-toggle)")) {
				return;
			}
			const groupId = (e.currentTarget as HTMLElement).getAttribute("data-group-id");
			if (groupId) toggleGroupUI(groupId);
		});
	});

	document.querySelectorAll("button.group-toggle").forEach((button) => {
		button.addEventListener("click", (e) => {
			e.stopPropagation();
			const groupId = (e.currentTarget as HTMLElement).getAttribute("data-group-id");
			if (groupId) toggleGroupUI(groupId);
		});
	});

	document.querySelectorAll(".history-btn").forEach((button) => {
		button.addEventListener("click", async (e) => {
			const btn = e.currentTarget as HTMLElement;
			const itemId = btn.getAttribute("data-history-id");
			if (itemId) {
				const item = appState.findItemById(itemId);
				if (item) {
					await openHistoryModal(item);
				}
			}
		});
	});
}

function toggleGroupUI(groupId: string): void {
	const element = document.getElementById(`group-${groupId}`);
	if (!element) return;

	const isExpanded = appState.toggleGroup(groupId);
	element.classList.toggle("hidden", !isExpanded);

	const chevrons = document.querySelectorAll(`[data-group-id="${groupId}"] svg`);
	chevrons.forEach((chevron) => {
		if (!chevron.classList.contains("toggle-group-icon")) return;
		chevron.classList.toggle("rotate-180");
	});
}

export async function openHistoryModal(item: StatusItem): Promise<void> {
	appState.currentModalItem = item;
	appState.currentModalPeriod = appState.selectedUptimePeriod as Period;

	document.getElementById("modalTitle")!.textContent = item.name;
	document.getElementById("modalSubtitle")!.textContent = item.type === "group" ? "Group History" : "Monitor History";

	document.getElementById("historyModal")!.classList.remove("hidden");
	document.body.style.overflow = "hidden";

	await loadModalHistory(item, appState.currentModalPeriod);
}

export function closeHistoryModal(): void {
	document.getElementById("historyModal")!.classList.add("hidden");
	document.body.style.overflow = "auto";

	appState.destroyAllCharts();
	appState.currentModalItem = null;
}

export async function loadModalHistory(item: StatusItem, period: Period): Promise<void> {
	try {
		appState.currentModalPeriod = period;

		document.querySelectorAll(".modal-period-btn").forEach((btn) => {
			const btnPeriod = btn.getAttribute("data-modal-period");
			if (btnPeriod === period) {
				btn.className = "modal-period-btn cursor-pointer px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors";
			} else {
				btn.className =
					"modal-period-btn cursor-pointer px-4 py-2 text-sm rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] transition-colors";
			}
		});

		if (item.type === "group") {
			await loadGroupHistory(item, period);
		} else {
			await loadMonitorHistory(item, period);
		}
	} catch (error) {
		console.error(`Error loading ${item.type} history:`, error);
	}
}

export function changeUptimePeriod(period: string): void {
	appState.selectedUptimePeriod = period;
	renderPage();
}
