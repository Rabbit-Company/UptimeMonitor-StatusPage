import type { StatusData, Period } from "./types";
import { BACKEND_URL, STATUS_PAGE_SLUG } from "./config";
import { appState } from "./state";
import { initWebSocket, cleanupWebSocket } from "./websocket";
import { renderPage, changeUptimePeriod, openHistoryModal, closeHistoryModal, loadModalHistory } from "./ui";
import { initTheme, applyTheme, getTheme, getCurrentTheme } from "./themes";
import { getAuthHeaders, isAuthError, storePassword, clearStoredPassword } from "./auth";
import Blake2b from "@rabbit-company/blake2b";

/**
 * Show the password modal
 */
function showPasswordModal(isRetry: boolean = false): void {
	const modal = document.getElementById("passwordModal")!;
	const errorMsg = document.getElementById("passwordError")!;
	const input = document.getElementById("passwordInput") as HTMLInputElement;

	if (isRetry) {
		errorMsg.textContent = "Incorrect password. Please try again.";
		errorMsg.classList.remove("hidden");
	} else {
		errorMsg.classList.add("hidden");
	}

	input.value = "";
	modal.classList.remove("hidden");
	document.body.style.overflow = "hidden";

	// Focus the input
	setTimeout(() => input.focus(), 100);
}

/**
 * Hide the password modal
 */
function hidePasswordModal(): void {
	const modal = document.getElementById("passwordModal")!;
	modal.classList.add("hidden");
	document.body.style.overflow = "auto";
}

/**
 * Handle password submission
 */
async function handlePasswordSubmit(): Promise<void> {
	const input = document.getElementById("passwordInput") as HTMLInputElement;
	const password = input.value.trim();

	if (!password) {
		const errorMsg = document.getElementById("passwordError")!;
		errorMsg.textContent = "Please enter a password.";
		errorMsg.classList.remove("hidden");
		return;
	}

	// Store the password and retry loading
	storePassword(Blake2b.hash(password));
	hidePasswordModal();

	// Show loading state again
	document.getElementById("loading")!.classList.remove("hidden");
	document.getElementById("content")!.classList.add("hidden");

	// Retry initialization
	await init();
}

/**
 * Fetch status data with authentication
 */
async function fetchStatusData(): Promise<{ data: StatusData | null; authRequired: boolean }> {
	try {
		const response = await fetch(`${BACKEND_URL}/v1/status/${STATUS_PAGE_SLUG}`, {
			headers: getAuthHeaders(),
		});

		if (isAuthError(response)) {
			return { data: null, authRequired: true };
		}

		if (!response.ok) {
			throw new Error(`Failed to fetch status data: ${response.status}`);
		}

		const data = (await response.json()) as StatusData;
		return { data, authRequired: false };
	} catch (error) {
		throw error;
	}
}

/**
 * Initialize the application
 */
async function init(): Promise<void> {
	// Initialize theme first (before content loads)
	initTheme();

	try {
		const { data, authRequired } = await fetchStatusData();

		if (authRequired) {
			// Hide loading, show password modal
			document.getElementById("loading")!.classList.add("hidden");

			// Check if we had a stored password that failed
			const hadStoredPassword = !!localStorage.getItem(`uptimemonitor-password-${STATUS_PAGE_SLUG}`);
			if (hadStoredPassword) {
				clearStoredPassword();
			}

			showPasswordModal(hadStoredPassword);
			return;
		}

		if (!data) {
			throw new Error("No data received");
		}

		appState.statusData = data;

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

	// Password modal event listeners
	setupPasswordModalListeners();
}

/**
 * Setup password modal event listeners
 */
function setupPasswordModalListeners(): void {
	const passwordForm = document.getElementById("passwordForm");
	if (passwordForm) {
		passwordForm.addEventListener("submit", (e) => {
			e.preventDefault();
			handlePasswordSubmit();
		});
	}

	const passwordSubmitBtn = document.getElementById("passwordSubmitBtn");
	if (passwordSubmitBtn) {
		passwordSubmitBtn.addEventListener("click", (e) => {
			e.preventDefault();
			handlePasswordSubmit();
		});
	}

	// Allow Enter key to submit
	const passwordInput = document.getElementById("passwordInput");
	if (passwordInput) {
		passwordInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handlePasswordSubmit();
			}
		});
	}
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

// Setup password modal listeners immediately (before init)
document.addEventListener("DOMContentLoaded", () => {
	setupPasswordModalListeners();
});

// Start the application
init();
