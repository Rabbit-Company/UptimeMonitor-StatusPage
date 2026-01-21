import type { StatusData, Period } from "./types";
import { BACKEND_URL, STATUS_PAGE_SLUG } from "./config";
import { appState } from "./state";
import { initWebSocket, cleanupWebSocket } from "./websocket";
import { renderPage, changeUptimePeriod, openHistoryModal, closeHistoryModal, loadModalHistory } from "./ui";
import { initTheme, applyTheme, getTheme, getCurrentTheme } from "./themes";

/**
 * Initialize the application
 */
async function init(): Promise<void> {
	// Initialize theme first (before content loads)
	initTheme();

	try {
		const response = await fetch(`${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}`);
		if (!response.ok) throw new Error("Failed to fetch status data");

		appState.statusData = (await response.json()) as StatusData;

		// Set initial uptime period selector value
		(document.getElementById("uptimePeriodSelector") as HTMLSelectElement).value = appState.selectedUptimePeriod;

		// Set initial theme selector value
		const currentTheme = getCurrentTheme();
		const themeSelector = document.getElementById("themeSelector") as HTMLSelectElement;
		if (themeSelector) {
			themeSelector.value = currentTheme.name;
		}

		// Show content, hide loading
		document.getElementById("loading")!.classList.add("hidden");
		document.getElementById("content")!.classList.remove("hidden");

		setupEventListeners();
		renderPage();

		// Initialize WebSocket for real-time updates
		initWebSocket();
	} catch (error: any) {
		console.error("Error loading status data:", error);
		showLoadError(error.message);
	}
}

/**
 * Show error state when loading fails
 */
function showLoadError(message: string): void {
	document.getElementById("loading")!.innerHTML = `
		<div class="text-center">
			<div class="text-[var(--status-down)] mb-4">
				<svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
			</div>
			<p class="text-[var(--text-muted)]">Failed to load status data</p>
			<p class="text-[var(--text-muted)] text-sm mt-2">${message}</p>
		</div>
	`;
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
	// Uptime period selector
	const uptimePeriodSelector = document.getElementById("uptimePeriodSelector") as HTMLSelectElement;
	if (uptimePeriodSelector) {
		uptimePeriodSelector.addEventListener("change", (e) => {
			const target = e.target as HTMLSelectElement;
			changeUptimePeriod(target.value);
		});
	}

	// Theme selector
	const themeSelector = document.getElementById("themeSelector") as HTMLSelectElement;
	if (themeSelector) {
		themeSelector.addEventListener("change", (e) => {
			const target = e.target as HTMLSelectElement;
			const theme = getTheme(target.value);
			applyTheme(theme);
			// Update charts with new theme colors
			if (appState.currentModalItem) {
				loadModalHistory(appState.currentModalItem, appState.currentModalPeriod);
			}
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
			if (period && appState.currentModalItem) {
				await loadModalHistory(appState.currentModalItem, period);
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

/**
 * Cleanup on page unload
 */
function cleanup(): void {
	cleanupWebSocket();
}

// Register cleanup handlers
window.addEventListener("beforeunload", cleanup);
window.addEventListener("unload", cleanup);

// Expose functions for HTML onclick handlers (if needed)
(window as any).openHistoryModal = openHistoryModal;
(window as any).closeHistoryModal = closeHistoryModal;

// Start the application
init();
