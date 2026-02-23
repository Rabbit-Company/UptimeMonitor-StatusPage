import { BACKEND_URL, STATUS_PAGE_SLUG } from "./config";
import { getAuthHeaders } from "./auth";
import type {
	Incident,
	WSIncidentCreatedMessage,
	WSIncidentDeletedMessage,
	WSIncidentUpdateAddedMessage,
	WSIncidentUpdateDeletedMessage,
	WSIncidentUpdatedMessage,
} from "./types";
import { showNotification } from "./notifications";

export interface IncidentsResponse {
	statusPageId: string;
	month: string;
	incidents: Incident[];
}

const expandedIncidents = new Set<string>();
let currentMonth: string = getCurrentMonthString();
const monthCache = new Map<string, Incident[]>();

/** Whether a fetch is currently in-flight (prevents double-clicks) */
let isFetching = false;

/** Whether initial load has completed (for WS updates that arrive before fetch) */
let initialLoadDone = false;

/**
 * Fetch incidents for a given month from the backend.
 */
async function fetchIncidents(month: string): Promise<IncidentsResponse> {
	const url = `${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}/incidents?month=${month}`;
	const response = await fetch(url, { headers: getAuthHeaders() });

	if (!response.ok) {
		throw new Error(`Failed to fetch incidents: ${response.status}`);
	}

	return (await response.json()) as IncidentsResponse;
}

/**
 * Get incidents for a month, using cache when available.
 */
async function getIncidentsForMonth(month: string): Promise<Incident[]> {
	if (monthCache.has(month)) {
		return monthCache.get(month)!;
	}

	const data = await fetchIncidents(month);

	monthCache.set(month, data.incidents);

	return data.incidents;
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
		investigating: "Investigating",
		identified: "Identified",
		monitoring: "Monitoring",
		resolved: "Resolved",
	};
	return labels[status] || status;
}

function getStatusStyles(status: string): { dot: string; badge: string; text: string; timeline: string } {
	switch (status) {
		case "investigating":
			return {
				dot: "background:var(--status-down)",
				badge:
					"background:color-mix(in srgb, var(--status-down) 15%, transparent);color:var(--status-down-text);border:1px solid color-mix(in srgb, var(--status-down) 30%, transparent)",
				text: "color:var(--status-down-text)",
				timeline: "background:var(--status-down)",
			};
		case "identified":
			return {
				dot: "background:var(--status-degraded)",
				badge:
					"background:color-mix(in srgb, var(--status-degraded) 15%, transparent);color:var(--status-degraded-text);border:1px solid color-mix(in srgb, var(--status-degraded) 30%, transparent)",
				text: "color:var(--status-degraded-text)",
				timeline: "background:var(--status-degraded)",
			};
		case "monitoring":
			return {
				dot: "background:var(--accent-primary)",
				badge:
					"background:color-mix(in srgb, var(--accent-primary) 15%, transparent);color:var(--accent-tertiary);border:1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)",
				text: "color:var(--accent-tertiary)",
				timeline: "background:var(--accent-primary)",
			};
		case "resolved":
		default:
			return {
				dot: "background:var(--status-up)",
				badge:
					"background:color-mix(in srgb,var(--status-up) 15%,transparent);color:var(--status-up-text);border:1px solid color-mix(in srgb,var(--status-up) 30%,transparent)",
				text: "color:var(--status-up-text)",
				timeline: "background:var(--status-up)",
			};
	}
}

function getSeverityBadgeStyle(severity: string): { label: string; style: string } {
	switch (severity) {
		case "critical":
			return {
				label: "Critical",
				style:
					"background:color-mix(in srgb, var(--status-down) 10%, transparent);color:var(--status-down-text);border:1px solid color-mix(in srgb, var(--status-down) 20%, transparent)",
			};
		case "major":
			return {
				label: "Major",
				style:
					"background:color-mix(in srgb, var(--status-degraded) 10%, transparent);color:var(--status-degraded-text);border:1px solid color-mix(in srgb, var(--status-degraded) 20%, transparent)",
			};
		case "minor":
		default:
			return { label: "Minor", style: "background:var(--bg-tertiary);color:var(--text-muted);border:1px solid var(--border-secondary)" };
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
	const incidentDate = new Date(date);
	incidentDate.setHours(0, 0, 0, 0);
	const diffDays = Math.floor((today.getTime() - incidentDate.getTime()) / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function escapeHTML(str: string): string {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

function renderIncidentCard(incident: Incident): string {
	const sc = getStatusStyles(incident.status);
	const sev = getSeverityBadgeStyle(incident.severity);
	const isOngoing = incident.resolved_at === null;
	const isExpanded = expandedIncidents.has(incident.id);
	const latestUpdate = incident.updates.length > 0 ? incident.updates[incident.updates.length - 1] : undefined;
	const hasMultipleUpdates = incident.updates.length > 1;
	const ongoingBorderStyle = isOngoing ? "border-color:color-mix(in srgb,var(--status-down) 30%,var(--border-primary))" : "";

	// Build the expanded timeline (all updates except the latest, in reverse-chron for display)
	let timelineHTML = "";
	if (hasMultipleUpdates) {
		const olderUpdates = incident.updates.slice(0, -1).reverse();
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
							<div class="w-2.5 h-2.5 rounded-full ${isOngoing ? "animate-pulse-slow" : ""}" style="${sc.dot}"></div>
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="font-semibold text-base leading-snug" style="color:var(--text-primary)">${escapeHTML(incident.title)}</h3>
							<div class="flex flex-wrap items-center gap-2 mt-2">
								<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style="${sc.badge}">${getStatusLabel(incident.status)}</span>
								<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style="${sev.style}">${sev.label}</span>
								${
									incident.affected_monitors.length > 0
										? `<span class="text-xs" style="color:var(--text-muted)">${incident.affected_monitors.length} affected service${incident.affected_monitors.length > 1 ? "s" : ""}</span>`
										: ""
								}
							</div>
						</div>
					</div>
					<div class="flex-shrink-0 text-right">
						<span class="text-xs" style="color:var(--text-muted)">${formatRelativeTime(incident.updated_at)}</span>
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
					class="cursor-pointer incident-toggle mt-3 ml-[22px] flex items-center gap-1.5 text-xs font-medium transition-colors"
					style="color:var(--accent-primary)"
					data-incident-id="${incident.id}"
				>
					<svg class="w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
					</svg>
					<span>${isExpanded ? "Hide" : "Show"} ${incident.updates.length - 1} earlier update${incident.updates.length - 1 > 1 ? "s" : ""}</span>
				</button>`
						: ""
				}
			</div>

			${
				hasMultipleUpdates
					? `
			<div class="incident-timeline ${isExpanded ? "" : "hidden"}" data-timeline-id="${incident.id}">
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
 * Initialise incidents: fetch the current month once, then render both sections from cache.
 * Call this on page load instead of renderActiveIncidents + renderPastIncidents separately.
 */
export async function initIncidents(): Promise<void> {
	try {
		await getIncidentsForMonth(getCurrentMonthString());
		initialLoadDone = true;
		renderActiveIncidentsFromCache();
		renderPastIncidentsFromCache();
		const paginationEl = document.getElementById("pastIncidentsPagination");
		if (paginationEl) renderPagination(paginationEl);
	} catch (error) {
		console.error("Failed to load incidents:", error);
	}
}

/**
 * Render active (unresolved) incidents into #activeIncidents.
 */
export async function renderActiveIncidents(): Promise<void> {
	const container = document.getElementById("activeIncidents");
	if (!container) return;

	try {
		const incidents = await getIncidentsForMonth(getCurrentMonthString());
		initialLoadDone = true;
		renderActiveIncidentsFromCache(container);
	} catch (error) {
		console.error("Failed to load active incidents:", error);
		container.innerHTML = "";
		container.classList.add("hidden");
	}
}

function renderActiveIncidentsFromCache(container?: HTMLElement): void {
	const el = container || document.getElementById("activeIncidents");
	if (!el) return;

	const cached = monthCache.get(getCurrentMonthString());
	if (!cached) return;

	const ongoing = cached.filter((i) => i.resolved_at === null).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

	if (ongoing.length === 0) {
		el.innerHTML = "";
		el.classList.add("hidden");
		return;
	}

	el.classList.remove("hidden");
	el.innerHTML = `
		<div class="flex items-center gap-2 mb-4">
			<div class="w-2 h-2 rounded-full animate-pulse-slow" style="background:var(--status-down)"></div>
			<h3 class="text-sm font-semibold uppercase tracking-wider" style="color:var(--text-primary)">Active Incidents</h3>
			<span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style="background:color-mix(in srgb,var(--status-down) 15%,transparent);color:var(--status-down-text)">${ongoing.length}</span>
		</div>
		<div class="space-y-3">${ongoing.map((i) => renderIncidentCard(i)).join("")}</div>
	`;
	addIncidentToggleListeners(el);
}

/**
 * Render past incidents with month-based pagination into #pastIncidents.
 */
export async function renderPastIncidents(month?: string): Promise<void> {
	if (month) currentMonth = month;

	const contentEl = document.getElementById("pastIncidentsContent");
	const paginationEl = document.getElementById("pastIncidentsPagination");
	if (!contentEl || !paginationEl) return;

	if (isFetching) return;
	isFetching = true;

	contentEl.innerHTML = `
		<div class="flex items-center justify-center py-8">
			<div class="w-5 h-5 border-2 rounded-full animate-spin" style="border-color:var(--accent-primary);border-top-color:transparent"></div>
			<span class="ml-3 text-sm" style="color:var(--text-muted)">Loading incidents...</span>
		</div>`;

	try {
		const incidents = await getIncidentsForMonth(currentMonth);
		initialLoadDone = true;
		renderPastIncidentsFromCache(contentEl);
		renderPagination(paginationEl);
	} catch (error) {
		console.error("Failed to load past incidents:", error);
		contentEl.innerHTML = `
			<div class="rounded-xl p-6 text-center" style="background:var(--bg-secondary);border:1px solid var(--border-primary)">
				<p class="text-sm" style="color:var(--status-down-text)">Failed to load incidents</p>
				<button id="pastIncidentsRetry" class="cursor-pointer mt-2 text-xs font-medium" style="color:var(--accent-primary)">Retry</button>
			</div>`;
		document.getElementById("pastIncidentsRetry")?.addEventListener("click", () => renderPastIncidents(currentMonth));
	} finally {
		isFetching = false;
	}
}

function renderPastIncidentsFromCache(container?: HTMLElement): void {
	const contentEl = container || document.getElementById("pastIncidentsContent");
	if (!contentEl) return;

	const cached = monthCache.get(currentMonth);
	if (!cached) return;

	const resolved = cached.filter((i) => i.resolved_at !== null).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

	if (resolved.length === 0) {
		contentEl.innerHTML = `
			<div class="rounded-xl p-6 text-center" style="background:var(--bg-secondary);border:1px solid var(--border-primary)">
				<div class="inline-flex items-center justify-center w-10 h-10 rounded-full mb-3" style="background:color-mix(in srgb,var(--status-up) 10%,transparent)">
					<svg class="w-5 h-5" style="color:var(--status-up-text)" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
				</div>
				<p class="text-sm font-medium" style="color:var(--text-secondary)">No resolved incidents in ${formatMonthLabel(currentMonth)}</p>
			</div>`;
		return;
	}

	const byDate = new Map<string, Incident[]>();
	for (const inc of resolved) {
		const key = formatDateGroup(inc.created_at);
		if (!byDate.has(key)) byDate.set(key, []);
		byDate.get(key)!.push(inc);
	}

	let html = "";
	for (const [dateLabel, dateIncidents] of byDate) {
		html += `<div class="mb-4 last:mb-0"><p class="text-xs font-medium mb-2 ml-1" style="color:var(--text-muted)">${dateLabel}</p><div class="space-y-3">${dateIncidents.map((i) => renderIncidentCard(i)).join("")}</div></div>`;
	}

	contentEl.innerHTML = html;
	addIncidentToggleListeners(contentEl);
}

function renderPagination(container: HTMLElement): void {
	const isCurrentMonth = currentMonth === getCurrentMonthString();
	const prev = prevMonth(currentMonth);
	const next = nextMonth(currentMonth);

	container.innerHTML = `
		<div class="flex items-center justify-between pt-4">
			<button id="incidentsPrevMonth" class="incident-nav-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style="background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-primary)">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
				${formatMonthLabel(prev)}
			</button>
			<span class="text-xs font-medium" style="color:var(--text-muted)">${formatMonthLabel(currentMonth)}</span>
			${
				!isCurrentMonth
					? `<button id="incidentsNextMonth" class="incident-nav-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style="background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-primary)">
				${formatMonthLabel(next)}
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
			</button>`
					: `<div></div>`
			}
		</div>`;

	document.getElementById("incidentsPrevMonth")?.addEventListener("click", () => renderPastIncidents(prev));
	document.getElementById("incidentsNextMonth")?.addEventListener("click", () => renderPastIncidents(next));
}

function addIncidentToggleListeners(root: HTMLElement): void {
	root.querySelectorAll(".incident-toggle").forEach((btn) => {
		btn.addEventListener("click", () => {
			const incidentId = (btn as HTMLElement).getAttribute("data-incident-id");
			if (!incidentId) return;
			const timeline = root.querySelector(`[data-timeline-id="${incidentId}"]`);
			if (!timeline) return;
			const wasExpanded = expandedIncidents.has(incidentId);
			if (wasExpanded) {
				expandedIncidents.delete(incidentId);
				timeline.classList.add("hidden");
			} else {
				expandedIncidents.add(incidentId);
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
 * Upsert an incident into the cache for the month it belongs to,
 * then re-render the affected UI sections.
 */
function upsertIncidentInCache(incident: Incident): void {
	const month = getMonthFromDate(incident.created_at);
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

	const idx = cached.findIndex((i) => i.id === incident.id);
	if (idx !== -1) {
		cached[idx] = incident;
	} else {
		cached.push(incident);
	}
}

function removeIncidentFromCache(incidentId: string): void {
	for (const [month, cached] of monthCache) {
		const idx = cached.findIndex((i) => i.id === incidentId);
		if (idx !== -1) {
			cached.splice(idx, 1);
			break;
		}
	}
}

function refreshUI(): void {
	renderActiveIncidentsFromCache();

	// Only refresh past incidents if we are viewing the affected month
	if (currentMonth === getCurrentMonthString()) {
		renderPastIncidentsFromCache();
	}
}

/**
 * Handle "incident-created" WebSocket message.
 * A brand-new incident was created.
 */
export function handleIncidentCreated(message: WSIncidentCreatedMessage): void {
	const incident = message.data.incident;
	console.log(`[WS] Incident created: ${incident.title}`);

	upsertIncidentInCache(incident);

	if (initialLoadDone) {
		refreshUI();
	}

	// Show notification for new incidents
	const severityLabel = incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1);
	showNotification(`${severityLabel} incident: ${incident.title}`, incident.severity === "critical" ? "error" : "warning");
}

/**
 * Handle "incident-updated" WebSocket message.
 * An existing incident's metadata was updated (title, severity, affected_monitors...)
 */
export function handleIncidentUpdated(message: WSIncidentUpdatedMessage): void {
	const incident = message.data.incident;
	console.log(`[WS] Incident updated: ${incident.title}`);

	upsertIncidentInCache(incident);

	if (initialLoadDone) {
		refreshUI();
	}
}

/**
 * Handle "incident-update-added" WebSocket message.
 * A new timeline update was posted on an existing incident.
 */
export function handleIncidentUpdateAdded(message: WSIncidentUpdateAddedMessage): void {
	const incident = message.data.incident;
	console.log(`[WS] Incident update added: ${incident.title} -> ${incident.status}`);

	upsertIncidentInCache(incident);

	if (initialLoadDone) {
		refreshUI();
	}

	// Show notification about the status change
	if (incident.status === "resolved") {
		showNotification(`Resolved: ${incident.title}`, "success");
	} else {
		showNotification(`${getStatusLabel(incident.status)}: ${incident.title}`, "warning");
	}
}

/**
 * Handle "incident-update-deleted" WebSocket message.
 * An incident update was removed.
 */
export function handleIncidentUpdateDeleted(message: WSIncidentUpdateDeletedMessage): void {
	const incidentId = message.data.incidentId;
	const updateId = message.data.updateId;
	const incident = message.data.incident;
	console.log(`[WS] Incident update deleted: ${incidentId} - ${updateId}`);

	upsertIncidentInCache(incident);

	if (initialLoadDone) {
		refreshUI();
	}
}

/**
 * Handle "incident-deleted" WebSocket message.
 * An incident was removed.
 */
export function handleIncidentDeleted(message: WSIncidentDeletedMessage): void {
	const incidentId = message.data.incidentId;
	console.log(`[WS] Incident deleted: ${incidentId}`);

	removeIncidentFromCache(incidentId);

	if (initialLoadDone) {
		refreshUI();
	}
}
