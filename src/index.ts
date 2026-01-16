import type { StatusData, Period } from "./types";
import { BACKEND_URL, STATUS_PAGE_SLUG, DEFAULT_PERIOD } from "./config";
import { appState } from "./state";
import { initWebSocket, cleanupWebSocket } from "./websocket";
import { renderPage, changeUptimePeriod, openHistoryModal, closeHistoryModal, loadModalHistory } from "./ui";

/**
 * Initialize the application
 */
async function init(): Promise<void> {
	try {
		const response = await fetch(`${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}`);
		if (!response.ok) throw new Error("Failed to fetch status data");

		appState.statusData = (await response.json()) as StatusData;

		// Set initial uptime period selector value
		(document.getElementById("uptimePeriodSelector") as HTMLSelectElement).value = appState.selectedUptimePeriod;

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
			<div class="text-red-500 mb-4">
				<svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
			</div>
			<p class="text-gray-400">Failed to load status data</p>
			<p class="text-gray-500 text-sm mt-2">${message}</p>
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
