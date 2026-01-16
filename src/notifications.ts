type NotificationType = "success" | "error" | "warning";

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
	success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
	error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
	warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
};

const NOTIFICATION_STYLES: Record<NotificationType, string> = {
	success: "bg-emerald-900/90 border-emerald-700 text-emerald-100",
	error: "bg-red-900/90 border-red-700 text-red-100",
	warning: "bg-yellow-900/90 border-yellow-700 text-yellow-100",
};

const NOTIFICATION_DURATION = 5000; // 5 seconds

/**
 * Show a notification toast
 */
export function showNotification(message: string, type: NotificationType): void {
	const container = document.getElementById("notificationContainer");
	if (!container) return;

	const notification = document.createElement("div");
	notification.className = `notification flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 transform translate-x-full ${NOTIFICATION_STYLES[type]}`;

	notification.innerHTML = `${NOTIFICATION_ICONS[type]}<span class="text-sm font-medium">${message}</span>`;

	container.appendChild(notification);

	// Animate in
	requestAnimationFrame(() => {
		notification.classList.remove("translate-x-full");
	});

	// Remove after duration
	setTimeout(() => {
		notification.classList.add("translate-x-full");
		setTimeout(() => {
			if (notification.parentNode) {
				notification.parentNode.removeChild(notification);
			}
		}, 300);
	}, NOTIFICATION_DURATION);
}
