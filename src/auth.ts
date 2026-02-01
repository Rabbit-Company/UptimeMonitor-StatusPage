import { STATUS_PAGE_SLUG } from "./config";

const STORAGE_KEY_PREFIX = "uptimemonitor-password-";

/**
 * Get the storage key for the current status page
 */
function getStorageKey(): string {
	return `${STORAGE_KEY_PREFIX}${STATUS_PAGE_SLUG}`;
}

/**
 * Get stored password for the current status page
 */
export function getStoredPassword(): string | null {
	try {
		return localStorage.getItem(getStorageKey());
	} catch (e) {
		return null;
	}
}

/**
 * Store password for the current status page
 */
export function storePassword(password: string): void {
	try {
		localStorage.setItem(getStorageKey(), password);
	} catch (e) {}
}

/**
 * Clear stored password for the current status page
 */
export function clearStoredPassword(): void {
	try {
		localStorage.removeItem(getStorageKey());
	} catch (e) {}
}

/**
 * Create authorization header with password if available
 */
export function getAuthHeaders(): HeadersInit {
	const password = getStoredPassword();
	if (password) {
		return {
			Authorization: `Bearer ${password}`,
		};
	}
	return {};
}

/**
 * Check if a response indicates authentication failure
 */
export function isAuthError(response: Response): boolean {
	return response.status === 401;
}
