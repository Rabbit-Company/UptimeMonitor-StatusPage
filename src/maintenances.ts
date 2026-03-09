import { BACKEND_URL, STATUS_PAGE_SLUG } from "./config";
import { getAuthHeaders } from "./auth";
import type {
	Maintenance,
	WSMaintenanceCreatedMessage,
	WSMaintenanceDeletedMessage,
	WSMaintenanceUpdateAddedMessage,
	WSMaintenanceUpdateDeletedMessage,
	WSMaintenanceUpdatedMessage,
} from "./types";
import { showNotification } from "./notifications";

export interface MaintenancesResponse {
	statusPageId: string;
	month: string;
	maintenances: Maintenance[];
}

const expandedMaintenances = new Set<string>();
let currentMonth: string = getCurrentMonthString();
const monthCache = new Map<string, Maintenance[]>();

/** Whether a fetch is currently in-flight (prevents double-clicks) */
let isFetching = false;

/** Whether initial load has completed (for WS updates that arrive before fetch) */
let initialLoadDone = false;

/**
 * Fetch maintenances for a given month from the backend.
 */
async function fetchMaintenances(month: string): Promise<MaintenancesResponse> {
	const url = `${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}/maintenances?month=${month}`;
	const response = await fetch(url, { headers: getAuthHeaders() });

	if (!response.ok) {
		throw new Error(`Failed to fetch maintenances: ${response.status}`);
	}

	return (await response.json()) as MaintenancesResponse;
}

/**
 * Get maintenances for a month, using cache when available.
 */
async function getMaintenancesForMonth(month: string): Promise<Maintenance[]> {
	if (monthCache.has(month)) {
		return monthCache.get(month)!;
	}

	const data = await fetchMaintenances(month);

	monthCache.set(month, data.maintenances);

	return data.maintenances;
}

function getCurrentMonthString(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthFromDate(dateStr: string): string {
	const d = new Date(dateStr);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
	const [year, m] = month.split("-");
	const date = new Date(parseInt(year!), parseInt(m!) - 1);
	return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function prevMonth(month: string): string {
	const [year, m] = month.split("-");
	const date = new Date(parseInt(year!), parseInt(m!) - 1 - 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
	const [year, m] = month.split("-");
	const date = new Date(parseInt(year!), parseInt(m!) - 1 + 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getStatusLabel(status: string): string {
	const labels: Record<string, string> = {
		scheduled: "Scheduled",
		in_progress: "In Progress",
		completed: "Completed",
		cancelled: "Cancelled",
	};
	return labels[status] || status;
}

function getStatusStyles(status: string): { dot: string; badge: string; text: string; timeline: string } {
	switch (status) {
		case "scheduled":
			return {
				dot: "background:var(--accent-primary)",
				badge:
					"background:color-mix(in srgb, var(--accent-primary) 15%, transparent);color:var(--accent-tertiary);border:1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
				text: "color:var(--accent-tertiary)",
				timeline: "background:var(--accent-primary)",
			};
		case "in_progress":
			return {
				dot: "background:var(--status-degraded)",
				badge:
					"background:color-mix(in srgb, var(--status-degraded) 15%, transparent);color:var(--status-degraded-text);border:1px solid color-mix(in srgb, var(--status-degraded) 30%, transparent)",
				text: "color:var(--status-degraded-text)",
				timeline: "background:var(--status-degraded)",
			};
		case "completed":
			return {
				dot: "background:var(--status-up)",
				badge:
					"background:color-mix(in srgb,var(--status-up) 15%,transparent);color:var(--status-up-text);border:1px solid color-mix(in srgb,var(--status-up) 30%,transparent)",
				text: "color:var(--status-up-text)",
				timeline: "background:var(--status-up)",
			};
		case "cancelled":
		default:
			return {
				dot: "background:var(--text-muted)",
				badge: "background:var(--bg-tertiary);color:var(--text-muted);border:1px solid var(--border-secondary)",
				text: "color:var(--text-muted)",
				timeline: "background:var(--text-muted)",
			};
	}
}

function formatRelativeTime(dateStr: string): string {
	const diffMs = Date.now() - new Date(dateStr).getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function formatDateGroup(dateStr: string): string {
	const date = new Date(dateStr);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const maintenanceDate = new Date(date);
	maintenanceDate.setHours(0, 0, 0, 0);
	const diffDays = Math.floor((today.getTime() - maintenanceDate.getTime()) / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 0) {
		// Future dates
		if (diffDays === -1) return "Tomorrow";
		return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
	}
	return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatScheduledWindow(start: string, end: string): string {
	const s = new Date(start);
	const e = new Date(end);
	const sameDay = s.toDateString() === e.toDateString();

	const startStr = s.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	if (sameDay) {
		const endTime = e.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		return `${startStr} - ${endTime}`;
	}

	const endStr = e.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	return `${startStr} - ${endStr}`;
}

function escapeHTML(str: string): string {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

function renderMaintenanceCard(maintenance: Maintenance): string {
	const sc = getStatusStyles(maintenance.status);
	const isOngoing = maintenance.completed_at === null && maintenance.status !== "cancelled";
	const isExpanded = expandedMaintenances.has(maintenance.id);
	const latestUpdate = maintenance.updates.length > 0 ? maintenance.updates[maintenance.updates.length - 1] : undefined;
	const hasMultipleUpdates = maintenance.updates.length > 1;
	const ongoingBorderStyle =
		isOngoing && maintenance.status === "in_progress" ? "border-color:color-mix(in srgb,var(--status-degraded) 30%,var(--border-primary))" : "";

	// Build the expanded timeline (all updates except the latest, in reverse-chron for display)
	let timelineHTML = "";
	if (hasMultipleUpdates) {
		const olderUpdates = maintenance.updates.slice(0, -1).reverse();
		timelineHTML = olderUpdates
			.map((u) => {
				const uc = getStatusStyles(u.status);
				return `
				<div class="relative">
					<div class="absolute w-2.5 h-2.5 rounded-full" style="${uc.timeline}; left:-1.1em; top:0.15em;"></div>
					<div>
						<div class="flex items-center gap-2 mb-1">
							<span class="text-xs font-medium" style="${uc.text}">${getStatusLabel(u.status)}</span>
							<span class="text-xs" style="color:var(--text-muted)">${formatDateTime(u.created_at)}</span>
						</div>
						<p class="text-sm leading-relaxed" style="color:var(--text-secondary)">${escapeHTML(u.message)}</p>
					</div>
				</div>`;
			})
			.join("");
	}

	return `
		<div class="rounded-xl overflow-hidden transition-all duration-200" style="background:var(--bg-secondary);border:1px solid var(--border-primary);backdrop-filter:blur(12px);${ongoingBorderStyle}">
			<div class="px-5 py-4 sm:px-6">
				<div class="flex items-start justify-between gap-3">
					<div class="flex items-start gap-3 min-w-0 flex-1">
						<div class="flex-shrink-0 mt-1.5">
							<div class="w-2.5 h-2.5 rounded-full ${isOngoing && maintenance.status === "in_progress" ? "animate-pulse-slow" : ""}" style="${sc.dot}"></div>
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-base leading-snug" style="color:var(--text-primary)">${escapeHTML(maintenance.title)}</h3>
							<div class="flex flex-wrap items-center gap-2 mt-2">
								<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style="${sc.badge}">${getStatusLabel(maintenance.status)}</span>
								<span class="text-xs" style="color:var(--text-muted)">
									<svg class="w-3 h-3 inline-block mr-0.5 -mt-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
									${formatScheduledWindow(maintenance.scheduled_start, maintenance.scheduled_end)}
								</span>
								${
									maintenance.affected_monitors.length > 0
										? `<span class="text-xs" style="color:var(--text-muted)">${maintenance.affected_monitors.length} affected service${maintenance.affected_monitors.length > 1 ? "s" : ""}</span>`
										: ""
								}
							</div>
						</div>
					</div>
					<div class="flex-shrink-0 text-right">
						<span class="text-xs" style="color:var(--text-muted)">${formatRelativeTime(maintenance.updated_at)}</span>
					</div>
				</div>

				${
					latestUpdate
						? `
				<div class="mt-3 ml-[22px] pl-3" style="border-left:2px solid var(--border-secondary)">
					<p class="text-sm leading-relaxed" style="color:var(--text-secondary)">${escapeHTML(latestUpdate.message)}</p>
					<p class="text-xs mt-1.5" style="color:var(--text-muted)">${formatDateTime(latestUpdate.created_at)}</p>
				</div>`
						: ""
				}

				${
					hasMultipleUpdates
						? `
				<button
					class="cursor-pointer maintenance-toggle mt-3 ml-[22px] flex items-center gap-1.5 text-xs font-medium transition-colors"
					style="color:var(--accent-primary)"
					data-maintenance-id="${maintenance.id}"
				>
					<svg class="w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
					</svg>
					<span>${isExpanded ? "Hide" : "Show"} ${maintenance.updates.length - 1} earlier update${maintenance.updates.length - 1 > 1 ? "s" : ""}</span>
				</button>`
						: ""
				}
			</div>

			${
				hasMultipleUpdates
					? `
			<div class="maintenance-timeline ${isExpanded ? "" : "hidden"}" data-timeline-id="${maintenance.id}">
				<div class="px-5 pb-4 sm:px-6">
					<div class="ml-[22px] pl-3 space-y-4 mt-1" style="border-left:2px solid var(--border-primary)">
						${timelineHTML}
					</div>
				</div>
			</div>`
					: ""
			}
		</div>
	`;
}

/**
 * Initialise maintenances: fetch the current month once, then render both sections from cache.
 * Call this on page load instead of renderActiveMaintenances + renderPastMaintenances separately.
 */
export async function initMaintenances(): Promise<void> {
	try {
		await getMaintenancesForMonth(getCurrentMonthString());
		initialLoadDone = true;
		renderActiveMaintenancesFromCache();
		renderPastMaintenancesFromCache();
		const paginationEl = document.getElementById("pastMaintenancesPagination");
		if (paginationEl) renderPagination(paginationEl);
	} catch (error) {
		console.error("Failed to load maintenances:", error);
	}
}

/**
 * Render active (not completed/cancelled) maintenances into #activeMaintenances.
 */
export async function renderActiveMaintenances(): Promise<void> {
	const container = document.getElementById("activeMaintenances");
	if (!container) return;

	try {
		const maintenances = await getMaintenancesForMonth(getCurrentMonthString());
		initialLoadDone = true;
		renderActiveMaintenancesFromCache(container);
	} catch (error) {
		console.error("Failed to load active maintenances:", error);
		container.innerHTML = "";
		container.classList.add("hidden");
	}
}

function renderActiveMaintenancesFromCache(container?: HTMLElement): void {
	const el = container || document.getElementById("activeMaintenances");
	if (!el) return;

	const cached = monthCache.get(getCurrentMonthString());
	if (!cached) return;

	const ongoing = cached
		.filter((m) => m.completed_at === null && m.status !== "cancelled")
		.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());

	if (ongoing.length === 0) {
		el.innerHTML = "";
		el.classList.add("hidden");
		return;
	}

	el.classList.remove("hidden");
	el.innerHTML = `
		<div class="flex items-center gap-2 mb-4">
			<div class="w-2 h-2 rounded-full animate-pulse-slow" style="background:var(--accent-primary)"></div>
			<h3 class="text-sm font-semibold uppercase tracking-wider" style="color:var(--text-primary)">Scheduled Maintenance</h3>
			<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style="background:color-mix(in srgb,var(--accent-primary) 15%,transparent);color:var(--accent-tertiary)">${ongoing.length}</span>
		</div>
		<div class="space-y-3">${ongoing.map((m) => renderMaintenanceCard(m)).join("")}</div>
	`;
	addMaintenanceToggleListeners(el);
}

/**
 * Render past maintenances with month-based pagination into #pastMaintenances.
 */
export async function renderPastMaintenances(month?: string): Promise<void> {
	if (month) currentMonth = month;

	const contentEl = document.getElementById("pastMaintenancesContent");
	const paginationEl = document.getElementById("pastMaintenancesPagination");
	if (!contentEl || !paginationEl) return;

	if (isFetching) return;
	isFetching = true;

	contentEl.innerHTML = `
    <div class="rounded-xl p-6 flex flex-col items-center justify-center" style="background:var(--bg-secondary);border:1px solid var(--border-primary)">
        <div class="w-10 h-10 rounded-full mb-3 animate-pulse" style="background:var(--bg-tertiary)"></div>
        <div class="h-4.5 w-64 rounded animate-pulse" style="background:var(--bg-tertiary)"></div>
    </div>`;

	try {
		const maintenances = await getMaintenancesForMonth(currentMonth);
		initialLoadDone = true;
		renderPastMaintenancesFromCache(contentEl);
		renderPagination(paginationEl);
	} catch (error) {
		console.error("Failed to load past maintenances:", error);
		contentEl.innerHTML = `
			<div class="rounded-xl p-6 text-center" style="background:var(--bg-secondary);border:1px solid var(--border-primary)">
				<p class="text-sm" style="color:var(--status-down-text)">Failed to load maintenances</p>
				<button id="pastMaintenancesRetry" class="cursor-pointer mt-2 text-xs font-medium" style="color:var(--accent-primary)">Retry</button>
			</div>`;
		document.getElementById("pastMaintenancesRetry")?.addEventListener("click", () => renderPastMaintenances(currentMonth));
	} finally {
		isFetching = false;
	}
}

function renderPastMaintenancesFromCache(container?: HTMLElement): void {
	const contentEl = container || document.getElementById("pastMaintenancesContent");
	if (!contentEl) return;

	const cached = monthCache.get(currentMonth);
	if (!cached) return;

	const past = cached
		.filter((m) => m.completed_at !== null || m.status === "cancelled")
		.sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime());

	if (past.length === 0) {
		contentEl.innerHTML = `
			<div class="rounded-xl p-6 text-center" style="background:var(--bg-secondary);border:1px solid var(--border-primary)">
				<div class="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3" style="background:color-mix(in srgb,var(--status-up) 10%,transparent)">
					<svg class="w-5 h-5" style="color:var(--status-up-text)" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
				</div>
				<p class="text-sm font-medium" style="color:var(--text-secondary)">No past maintenances in ${formatMonthLabel(currentMonth)}</p>
			</div>`;
		return;
	}

	const byDate = new Map<string, Maintenance[]>();
	for (const maint of past) {
		const key = formatDateGroup(maint.scheduled_start);
		if (!byDate.has(key)) byDate.set(key, []);
		byDate.get(key)!.push(maint);
	}

	let html = "";
	for (const [dateLabel, dateMaintenances] of byDate) {
		html += `<div class="mb-4 last:mb-0"><p class="text-xs font-medium mb-2 ml-1" style="color:var(--text-muted)">${dateLabel}</p><div class="space-y-3">${dateMaintenances.map((m) => renderMaintenanceCard(m)).join("")}</div></div>`;
	}

	contentEl.innerHTML = html;
	addMaintenanceToggleListeners(contentEl);
}

function renderPagination(container: HTMLElement): void {
	const isCurrentMonth = currentMonth === getCurrentMonthString();
	const prev = prevMonth(currentMonth);
	const next = nextMonth(currentMonth);

	container.innerHTML = `
		<div class="grid grid-cols-3 items-center pt-4">
			<button id="maintenancesPrevMonth" class="cursor-pointer justify-self-start maintenance-nav-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style="background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-primary)">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
				${formatMonthLabel(prev)}
			</button>
			<span class="justify-self-center text-xs font-medium" style="color:var(--text-muted)">${formatMonthLabel(currentMonth)}</span>
			${
				!isCurrentMonth
					? `<button id="maintenancesNextMonth" class="justify-self-end cursor-pointer maintenance-nav-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style="background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-primary)">
				${formatMonthLabel(next)}
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
			</button>`
					: `<div class="justify-self-end"></div>`
			}
		</div>`;

	document.getElementById("maintenancesPrevMonth")?.addEventListener("click", () => renderPastMaintenances(prev));
	document.getElementById("maintenancesNextMonth")?.addEventListener("click", () => renderPastMaintenances(next));
}

function addMaintenanceToggleListeners(root: HTMLElement): void {
	root.querySelectorAll(".maintenance-toggle").forEach((btn) => {
		btn.addEventListener("click", () => {
			const maintenanceId = (btn as HTMLElement).getAttribute("data-maintenance-id");
			if (!maintenanceId) return;
			const timeline = root.querySelector(`[data-timeline-id="${maintenanceId}"]`);
			if (!timeline) return;
			const wasExpanded = expandedMaintenances.has(maintenanceId);
			if (wasExpanded) {
				expandedMaintenances.delete(maintenanceId);
				timeline.classList.add("hidden");
			} else {
				expandedMaintenances.add(maintenanceId);
				timeline.classList.remove("hidden");
			}
			const chevron = btn.querySelector("svg");
			const span = btn.querySelector("span");
			if (chevron) chevron.classList.toggle("rotate-180");
			if (span) {
				const count = parseInt(span.textContent?.match(/\d+/)?.[0] || "0");
				span.textContent = `${!wasExpanded ? "Hide" : "Show"} ${count} earlier update${count > 1 ? "s" : ""}`;
			}
		});
	});
}

/**
 * Upsert a maintenance into the cache for the month it belongs to,
 * then re-render the affected UI sections.
 */
function upsertMaintenanceInCache(maintenance: Maintenance): void {
	const month = getMonthFromDate(maintenance.created_at);
	let cached = monthCache.get(month);
	if (!cached) {
		// If we do not have this month cached and it is the current month,
		// create the array so we can start tracking
		if (month === getCurrentMonthString()) {
			cached = [];
			monthCache.set(month, cached);
		} else {
			// Not the current month and not cached, so just ignore. Will be fetched when navigated to
			return;
		}
	}

	const idx = cached.findIndex((m) => m.id === maintenance.id);
	if (idx !== -1) {
		cached[idx] = maintenance;
	} else {
		cached.push(maintenance);
	}
}

function removeMaintenanceFromCache(maintenanceId: string): void {
	for (const [month, cached] of monthCache) {
		const idx = cached.findIndex((m) => m.id === maintenanceId);
		if (idx !== -1) {
			cached.splice(idx, 1);
			break;
		}
	}
}

function refreshUI(): void {
	renderActiveMaintenancesFromCache();

	// Only refresh past maintenances if we are viewing the affected month
	if (currentMonth === getCurrentMonthString()) {
		renderPastMaintenancesFromCache();
	}
}

/**
 * Handle "maintenance-created" WebSocket message.
 * A brand-new maintenance was created.
 */
export function handleMaintenanceCreated(message: WSMaintenanceCreatedMessage): void {
	const maintenance = message.data.maintenance;
	console.log(`[WS] Maintenance created: ${maintenance.title}`);

	upsertMaintenanceInCache(maintenance);

	if (initialLoadDone) {
		refreshUI();
	}

	showNotification(`Maintenance scheduled: ${maintenance.title}`, "warning");
}

/**
 * Handle "maintenance-updated" WebSocket message.
 * An existing maintenance's metadata was updated (title, schedule, affected_monitors...)
 */
export function handleMaintenanceUpdated(message: WSMaintenanceUpdatedMessage): void {
	const maintenance = message.data.maintenance;
	console.log(`[WS] Maintenance updated: ${maintenance.title}`);

	upsertMaintenanceInCache(maintenance);

	if (initialLoadDone) {
		refreshUI();
	}
}

/**
 * Handle "maintenance-update-added" WebSocket message.
 * A new timeline update was posted on an existing maintenance.
 */
export function handleMaintenanceUpdateAdded(message: WSMaintenanceUpdateAddedMessage): void {
	const maintenance = message.data.maintenance;
	console.log(`[WS] Maintenance update added: ${maintenance.title} -> ${maintenance.status}`);

	upsertMaintenanceInCache(maintenance);

	if (initialLoadDone) {
		refreshUI();
	}

	// Show notification about the status change
	if (maintenance.status === "completed") {
		showNotification(`Maintenance completed: ${maintenance.title}`, "success");
	} else if (maintenance.status === "in_progress") {
		showNotification(`Maintenance started: ${maintenance.title}`, "warning");
	} else {
		showNotification(`${getStatusLabel(maintenance.status)}: ${maintenance.title}`, "warning");
	}
}

/**
 * Handle "maintenance-update-deleted" WebSocket message.
 * A maintenance update was removed.
 */
export function handleMaintenanceUpdateDeleted(message: WSMaintenanceUpdateDeletedMessage): void {
	const maintenanceId = message.data.maintenanceId;
	const updateId = message.data.updateId;
	const maintenance = message.data.maintenance;
	console.log(`[WS] Maintenance update deleted: ${maintenanceId} - ${updateId}`);

	upsertMaintenanceInCache(maintenance);

	if (initialLoadDone) {
		refreshUI();
	}
}

/**
 * Handle "maintenance-deleted" WebSocket message.
 * A maintenance was removed.
 */
export function handleMaintenanceDeleted(message: WSMaintenanceDeletedMessage): void {
	const maintenanceId = message.data.maintenanceId;
	console.log(`[WS] Maintenance deleted: ${maintenanceId}`);

	removeMaintenanceFromCache(maintenanceId);

	if (initialLoadDone) {
		refreshUI();
	}
}
