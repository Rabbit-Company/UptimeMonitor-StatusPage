export type ThemeName = "midnight" | "ocean" | "forest" | "sunset" | "lavender" | "monochrome" | "cyberpunk" | "nord" | "dracula";

export interface ThemeColors {
	// Base colors
	bgPrimary: string;
	bgSecondary: string;
	bgTertiary: string;
	bgHover: string;

	// Border colors
	borderPrimary: string;
	borderSecondary: string;

	// Text colors
	textPrimary: string;
	textSecondary: string;
	textMuted: string;

	// Status colors
	statusUp: string;
	statusUpText: string;
	statusDown: string;
	statusDownText: string;
	statusDegraded: string;
	statusDegradedText: string;

	// Accent colors
	accentPrimary: string;
	accentSecondary: string;
	accentTertiary: string;

	// Chart colors
	chartUptime: string;
	chartUptimeWarning: string;
	chartUptimeCritical: string;
	chartLatency: string;
	chartLatencyMin: string;
	chartLatencyMax: string;
	chartCustom1: string;
	chartCustom2: string;
	chartCustom3: string;

	// Scrollbar
	scrollbarTrack: string;
	scrollbarThumb: string;
	scrollbarThumbHover: string;

	// Notification colors
	notificationSuccess: string;
	notificationSuccessBorder: string;
	notificationError: string;
	notificationErrorBorder: string;
	notificationWarning: string;
	notificationWarningBorder: string;
}

export interface Theme {
	name: ThemeName;
	displayName: string;
	colors: ThemeColors;
}

// Midnight Theme (Current Default - Dark with Emerald accents)
const midnightTheme: Theme = {
	name: "midnight",
	displayName: "Midnight",
	colors: {
		bgPrimary: "#030712", // gray-950
		bgSecondary: "rgba(17, 24, 39, 0.5)", // gray-900/50
		bgTertiary: "rgba(31, 41, 55, 0.5)", // gray-800/50
		bgHover: "#1f2937", // gray-800

		borderPrimary: "#1f2937", // gray-800
		borderSecondary: "#374151", // gray-700

		textPrimary: "#ffffff",
		textSecondary: "#f3f4f6", // gray-100
		textMuted: "#9ca3af", // gray-400

		statusUp: "#10b981", // emerald-500
		statusUpText: "#34d399", // emerald-400
		statusDown: "#ef4444", // red-500
		statusDownText: "#f87171", // red-400
		statusDegraded: "#f59e0b", // amber-500
		statusDegradedText: "#fbbf24", // amber-400

		accentPrimary: "#10b981", // emerald-500
		accentSecondary: "#059669", // emerald-600
		accentTertiary: "#34d399", // emerald-400

		chartUptime: "rgba(16, 185, 129, 0.8)",
		chartUptimeWarning: "rgba(251, 191, 36, 0.8)",
		chartUptimeCritical: "rgba(239, 68, 68, 0.8)",
		chartLatency: "rgba(59, 130, 246, 1)",
		chartLatencyMin: "rgba(16, 185, 129, 0.5)",
		chartLatencyMax: "rgba(239, 68, 68, 0.5)",
		chartCustom1: "rgba(59, 130, 246, 1)",
		chartCustom2: "rgba(168, 85, 247, 1)",
		chartCustom3: "rgba(6, 182, 212, 1)",

		scrollbarTrack: "#161b22",
		scrollbarThumb: "#1e2939",
		scrollbarThumbHover: "#374151",

		notificationSuccess: "rgba(6, 78, 59, 0.9)",
		notificationSuccessBorder: "#047857",
		notificationError: "rgba(127, 29, 29, 0.9)",
		notificationErrorBorder: "#b91c1c",
		notificationWarning: "rgba(120, 53, 15, 0.9)",
		notificationWarningBorder: "#b45309",
	},
};

// Ocean Theme - Deep Blue with Cyan accents
const oceanTheme: Theme = {
	name: "ocean",
	displayName: "Ocean",
	colors: {
		bgPrimary: "#0c1222",
		bgSecondary: "rgba(15, 23, 42, 0.5)",
		bgTertiary: "rgba(30, 41, 59, 0.5)",
		bgHover: "#1e3a5f",

		borderPrimary: "#1e3a5f",
		borderSecondary: "#2563eb",

		textPrimary: "#ffffff",
		textSecondary: "#e0f2fe",
		textMuted: "#7dd3fc",

		statusUp: "#06b6d4",
		statusUpText: "#22d3ee",
		statusDown: "#f43f5e",
		statusDownText: "#fb7185",
		statusDegraded: "#f59e0b",
		statusDegradedText: "#fbbf24",

		accentPrimary: "#06b6d4",
		accentSecondary: "#0891b2",
		accentTertiary: "#22d3ee",

		chartUptime: "rgba(6, 182, 212, 0.8)",
		chartUptimeWarning: "rgba(251, 191, 36, 0.8)",
		chartUptimeCritical: "rgba(244, 63, 94, 0.8)",
		chartLatency: "rgba(56, 189, 248, 1)",
		chartLatencyMin: "rgba(6, 182, 212, 0.5)",
		chartLatencyMax: "rgba(244, 63, 94, 0.5)",
		chartCustom1: "rgba(56, 189, 248, 1)",
		chartCustom2: "rgba(129, 140, 248, 1)",
		chartCustom3: "rgba(45, 212, 191, 1)",

		scrollbarTrack: "#0c1222",
		scrollbarThumb: "#1e3a5f",
		scrollbarThumbHover: "#2563eb",

		notificationSuccess: "rgba(8, 51, 68, 0.9)",
		notificationSuccessBorder: "#0891b2",
		notificationError: "rgba(76, 29, 36, 0.9)",
		notificationErrorBorder: "#be123c",
		notificationWarning: "rgba(120, 53, 15, 0.9)",
		notificationWarningBorder: "#b45309",
	},
};

// Forest Theme - Dark Green with Lime accents
const forestTheme: Theme = {
	name: "forest",
	displayName: "Forest",
	colors: {
		bgPrimary: "#052e16",
		bgSecondary: "rgba(5, 46, 22, 0.7)",
		bgTertiary: "rgba(20, 83, 45, 0.5)",
		bgHover: "#166534",

		borderPrimary: "#166534",
		borderSecondary: "#22c55e",

		textPrimary: "#ffffff",
		textSecondary: "#dcfce7",
		textMuted: "#86efac",

		statusUp: "#84cc16",
		statusUpText: "#a3e635",
		statusDown: "#ef4444",
		statusDownText: "#f87171",
		statusDegraded: "#eab308",
		statusDegradedText: "#facc15",

		accentPrimary: "#84cc16",
		accentSecondary: "#65a30d",
		accentTertiary: "#a3e635",

		chartUptime: "rgba(132, 204, 22, 0.8)",
		chartUptimeWarning: "rgba(234, 179, 8, 0.8)",
		chartUptimeCritical: "rgba(239, 68, 68, 0.8)",
		chartLatency: "rgba(74, 222, 128, 1)",
		chartLatencyMin: "rgba(132, 204, 22, 0.5)",
		chartLatencyMax: "rgba(239, 68, 68, 0.5)",
		chartCustom1: "rgba(74, 222, 128, 1)",
		chartCustom2: "rgba(190, 242, 100, 1)",
		chartCustom3: "rgba(45, 212, 191, 1)",

		scrollbarTrack: "#052e16",
		scrollbarThumb: "#166534",
		scrollbarThumbHover: "#22c55e",

		notificationSuccess: "rgba(20, 83, 45, 0.9)",
		notificationSuccessBorder: "#16a34a",
		notificationError: "rgba(127, 29, 29, 0.9)",
		notificationErrorBorder: "#b91c1c",
		notificationWarning: "rgba(113, 63, 18, 0.9)",
		notificationWarningBorder: "#a16207",
	},
};

// Sunset Theme - Warm Orange/Red tones
const sunsetTheme: Theme = {
	name: "sunset",
	displayName: "Sunset",
	colors: {
		bgPrimary: "#1c1410",
		bgSecondary: "rgba(41, 28, 24, 0.5)",
		bgTertiary: "rgba(68, 44, 36, 0.5)",
		bgHover: "#78350f",

		borderPrimary: "#78350f",
		borderSecondary: "#f59e0b",

		textPrimary: "#ffffff",
		textSecondary: "#fef3c7",
		textMuted: "#fcd34d",

		statusUp: "#f97316",
		statusUpText: "#fb923c",
		statusDown: "#dc2626",
		statusDownText: "#f87171",
		statusDegraded: "#eab308",
		statusDegradedText: "#facc15",

		accentPrimary: "#f97316",
		accentSecondary: "#ea580c",
		accentTertiary: "#fb923c",

		chartUptime: "rgba(249, 115, 22, 0.8)",
		chartUptimeWarning: "rgba(234, 179, 8, 0.8)",
		chartUptimeCritical: "rgba(220, 38, 38, 0.8)",
		chartLatency: "rgba(251, 146, 60, 1)",
		chartLatencyMin: "rgba(249, 115, 22, 0.5)",
		chartLatencyMax: "rgba(220, 38, 38, 0.5)",
		chartCustom1: "rgba(251, 146, 60, 1)",
		chartCustom2: "rgba(253, 186, 116, 1)",
		chartCustom3: "rgba(252, 211, 77, 1)",

		scrollbarTrack: "#1c1410",
		scrollbarThumb: "#78350f",
		scrollbarThumbHover: "#f59e0b",

		notificationSuccess: "rgba(124, 45, 18, 0.9)",
		notificationSuccessBorder: "#c2410c",
		notificationError: "rgba(127, 29, 29, 0.9)",
		notificationErrorBorder: "#b91c1c",
		notificationWarning: "rgba(113, 63, 18, 0.9)",
		notificationWarningBorder: "#a16207",
	},
};

// Lavender Theme - Purple/Violet tones
const lavenderTheme: Theme = {
	name: "lavender",
	displayName: "Lavender",
	colors: {
		bgPrimary: "#1e1b2e",
		bgSecondary: "rgba(46, 39, 72, 0.5)",
		bgTertiary: "rgba(76, 61, 114, 0.5)",
		bgHover: "#4c1d95",

		borderPrimary: "#4c1d95",
		borderSecondary: "#8b5cf6",

		textPrimary: "#ffffff",
		textSecondary: "#ede9fe",
		textMuted: "#c4b5fd",

		statusUp: "#a855f7",
		statusUpText: "#c084fc",
		statusDown: "#f43f5e",
		statusDownText: "#fb7185",
		statusDegraded: "#f59e0b",
		statusDegradedText: "#fbbf24",

		accentPrimary: "#a855f7",
		accentSecondary: "#9333ea",
		accentTertiary: "#c084fc",

		chartUptime: "rgba(168, 85, 247, 0.8)",
		chartUptimeWarning: "rgba(251, 191, 36, 0.8)",
		chartUptimeCritical: "rgba(244, 63, 94, 0.8)",
		chartLatency: "rgba(192, 132, 252, 1)",
		chartLatencyMin: "rgba(168, 85, 247, 0.5)",
		chartLatencyMax: "rgba(244, 63, 94, 0.5)",
		chartCustom1: "rgba(192, 132, 252, 1)",
		chartCustom2: "rgba(232, 121, 249, 1)",
		chartCustom3: "rgba(129, 140, 248, 1)",

		scrollbarTrack: "#1e1b2e",
		scrollbarThumb: "#4c1d95",
		scrollbarThumbHover: "#8b5cf6",

		notificationSuccess: "rgba(76, 29, 149, 0.9)",
		notificationSuccessBorder: "#7c3aed",
		notificationError: "rgba(76, 29, 36, 0.9)",
		notificationErrorBorder: "#be123c",
		notificationWarning: "rgba(120, 53, 15, 0.9)",
		notificationWarningBorder: "#b45309",
	},
};

// Monochrome Theme - Pure grayscale
const monochromeTheme: Theme = {
	name: "monochrome",
	displayName: "Monochrome",
	colors: {
		bgPrimary: "#0a0a0a",
		bgSecondary: "rgba(23, 23, 23, 0.5)",
		bgTertiary: "rgba(38, 38, 38, 0.5)",
		bgHover: "#262626",

		borderPrimary: "#262626",
		borderSecondary: "#404040",

		textPrimary: "#ffffff",
		textSecondary: "#e5e5e5",
		textMuted: "#a3a3a3",

		statusUp: "#d4d4d4",
		statusUpText: "#e5e5e5",
		statusDown: "#737373",
		statusDownText: "#a3a3a3",
		statusDegraded: "#a3a3a3",
		statusDegradedText: "#d4d4d4",

		accentPrimary: "#ffffff",
		accentSecondary: "#e5e5e5",
		accentTertiary: "#d4d4d4",

		chartUptime: "rgba(229, 229, 229, 0.8)",
		chartUptimeWarning: "rgba(163, 163, 163, 0.8)",
		chartUptimeCritical: "rgba(115, 115, 115, 0.8)",
		chartLatency: "rgba(212, 212, 212, 1)",
		chartLatencyMin: "rgba(229, 229, 229, 0.5)",
		chartLatencyMax: "rgba(115, 115, 115, 0.5)",
		chartCustom1: "rgba(212, 212, 212, 1)",
		chartCustom2: "rgba(163, 163, 163, 1)",
		chartCustom3: "rgba(115, 115, 115, 1)",

		scrollbarTrack: "#0a0a0a",
		scrollbarThumb: "#262626",
		scrollbarThumbHover: "#404040",

		notificationSuccess: "rgba(38, 38, 38, 0.9)",
		notificationSuccessBorder: "#525252",
		notificationError: "rgba(23, 23, 23, 0.9)",
		notificationErrorBorder: "#404040",
		notificationWarning: "rgba(38, 38, 38, 0.9)",
		notificationWarningBorder: "#525252",
	},
};

// Cyberpunk Theme - Neon pink/cyan on dark
const cyberpunkTheme: Theme = {
	name: "cyberpunk",
	displayName: "Cyberpunk",
	colors: {
		bgPrimary: "#0d0d0d",
		bgSecondary: "rgba(20, 10, 25, 0.7)",
		bgTertiary: "rgba(40, 20, 50, 0.5)",
		bgHover: "#2d1f3d",

		borderPrimary: "#ff00ff40",
		borderSecondary: "#00ffff40",

		textPrimary: "#ffffff",
		textSecondary: "#f0f0f0",
		textMuted: "#ff69b4",

		statusUp: "#00ffff",
		statusUpText: "#00ffff",
		statusDown: "#ff0066",
		statusDownText: "#ff3385",
		statusDegraded: "#ffff00",
		statusDegradedText: "#ffff66",

		accentPrimary: "#ff00ff",
		accentSecondary: "#00ffff",
		accentTertiary: "#ff69b4",

		chartUptime: "rgba(0, 255, 255, 0.8)",
		chartUptimeWarning: "rgba(255, 255, 0, 0.8)",
		chartUptimeCritical: "rgba(255, 0, 102, 0.8)",
		chartLatency: "rgba(255, 0, 255, 1)",
		chartLatencyMin: "rgba(0, 255, 255, 0.5)",
		chartLatencyMax: "rgba(255, 0, 102, 0.5)",
		chartCustom1: "rgba(255, 0, 255, 1)",
		chartCustom2: "rgba(0, 255, 255, 1)",
		chartCustom3: "rgba(255, 105, 180, 1)",

		scrollbarTrack: "#0d0d0d",
		scrollbarThumb: "#ff00ff40",
		scrollbarThumbHover: "#ff00ff80",

		notificationSuccess: "rgba(0, 80, 80, 0.9)",
		notificationSuccessBorder: "#00ffff",
		notificationError: "rgba(80, 0, 40, 0.9)",
		notificationErrorBorder: "#ff0066",
		notificationWarning: "rgba(80, 80, 0, 0.9)",
		notificationWarningBorder: "#ffff00",
	},
};

// Nord Theme - Arctic, north-bluish color palette
const nordTheme: Theme = {
	name: "nord",
	displayName: "Nord",
	colors: {
		bgPrimary: "#2e3440",
		bgSecondary: "rgba(59, 66, 82, 0.5)",
		bgTertiary: "rgba(67, 76, 94, 0.5)",
		bgHover: "#434c5e",

		borderPrimary: "#3b4252",
		borderSecondary: "#4c566a",

		textPrimary: "#eceff4",
		textSecondary: "#e5e9f0",
		textMuted: "#d8dee9",

		statusUp: "#a3be8c",
		statusUpText: "#a3be8c",
		statusDown: "#bf616a",
		statusDownText: "#bf616a",
		statusDegraded: "#ebcb8b",
		statusDegradedText: "#ebcb8b",

		accentPrimary: "#88c0d0",
		accentSecondary: "#81a1c1",
		accentTertiary: "#5e81ac",

		chartUptime: "rgba(163, 190, 140, 0.8)",
		chartUptimeWarning: "rgba(235, 203, 139, 0.8)",
		chartUptimeCritical: "rgba(191, 97, 106, 0.8)",
		chartLatency: "rgba(136, 192, 208, 1)",
		chartLatencyMin: "rgba(163, 190, 140, 0.5)",
		chartLatencyMax: "rgba(191, 97, 106, 0.5)",
		chartCustom1: "rgba(136, 192, 208, 1)",
		chartCustom2: "rgba(180, 142, 173, 1)",
		chartCustom3: "rgba(129, 161, 193, 1)",

		scrollbarTrack: "#2e3440",
		scrollbarThumb: "#3b4252",
		scrollbarThumbHover: "#4c566a",

		notificationSuccess: "rgba(67, 76, 82, 0.9)",
		notificationSuccessBorder: "#a3be8c",
		notificationError: "rgba(67, 55, 58, 0.9)",
		notificationErrorBorder: "#bf616a",
		notificationWarning: "rgba(76, 71, 58, 0.9)",
		notificationWarningBorder: "#ebcb8b",
	},
};

// Dracula Theme - Official Dracula color palette
const draculaTheme: Theme = {
	name: "dracula",
	displayName: "Dracula",
	colors: {
		// Base colors
		bgPrimary: "#282A36", // Background
		bgSecondary: "rgba(40, 42, 54, 0.7)",
		bgTertiary: "rgba(68, 71, 90, 0.5)", // Selection
		bgHover: "#44475A",

		// Borders
		borderPrimary: "#44475A",
		borderSecondary: "#6272A4", // Current line / comment

		// Text
		textPrimary: "#F8F8F2", // Foreground
		textSecondary: "#EDEDED",
		textMuted: "#6272A4", // Comment

		// Status
		statusUp: "#50FA7B", // Green
		statusUpText: "#50FA7B",
		statusDown: "#FF5555", // Red
		statusDownText: "#FF5555",
		statusDegraded: "#F1FA8C", // Yellow
		statusDegradedText: "#F1FA8C",

		// Accents
		accentPrimary: "#BD93F9", // Purple
		accentSecondary: "#FF79C6", // Pink
		accentTertiary: "#8BE9FD", // Cyan

		// Charts
		chartUptime: "rgba(80, 250, 123, 0.8)", // Green
		chartUptimeWarning: "rgba(241, 250, 140, 0.8)", // Yellow
		chartUptimeCritical: "rgba(255, 85, 85, 0.8)", // Red
		chartLatency: "rgba(139, 233, 253, 1)", // Cyan
		chartLatencyMin: "rgba(80, 250, 123, 0.5)",
		chartLatencyMax: "rgba(255, 85, 85, 0.5)",
		chartCustom1: "rgba(189, 147, 249, 1)", // Purple
		chartCustom2: "rgba(255, 121, 198, 1)", // Pink
		chartCustom3: "rgba(255, 184, 108, 1)", // Orange

		// Scrollbar
		scrollbarTrack: "#282A36",
		scrollbarThumb: "#44475A",
		scrollbarThumbHover: "#6272A4",

		// Notifications
		notificationSuccess: "rgba(80, 250, 123, 0.15)",
		notificationSuccessBorder: "#50FA7B",
		notificationError: "rgba(255, 85, 85, 0.15)",
		notificationErrorBorder: "#FF5555",
		notificationWarning: "rgba(241, 250, 140, 0.15)",
		notificationWarningBorder: "#F1FA8C",
	},
};

// All available themes
export const themes: Record<ThemeName, Theme> = {
	midnight: midnightTheme,
	ocean: oceanTheme,
	forest: forestTheme,
	sunset: sunsetTheme,
	lavender: lavenderTheme,
	monochrome: monochromeTheme,
	cyberpunk: cyberpunkTheme,
	nord: nordTheme,
	dracula: draculaTheme,
};

// Valid theme names for validation
export const validThemeNames: ThemeName[] = ["midnight", "ocean", "forest", "sunset", "lavender", "monochrome", "cyberpunk", "nord", "dracula"];

/**
 * Get theme by name, falling back to midnight if invalid
 */
export function getTheme(name: string): Theme {
	if (validThemeNames.includes(name as ThemeName)) {
		return themes[name as ThemeName];
	}
	return themes.midnight;
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
	const root = document.documentElement;
	const colors = theme.colors;

	// Set CSS custom properties
	root.style.setProperty("--bg-primary", colors.bgPrimary);
	root.style.setProperty("--bg-secondary", colors.bgSecondary);
	root.style.setProperty("--bg-tertiary", colors.bgTertiary);
	root.style.setProperty("--bg-hover", colors.bgHover);

	root.style.setProperty("--border-primary", colors.borderPrimary);
	root.style.setProperty("--border-secondary", colors.borderSecondary);

	root.style.setProperty("--text-primary", colors.textPrimary);
	root.style.setProperty("--text-secondary", colors.textSecondary);
	root.style.setProperty("--text-muted", colors.textMuted);

	root.style.setProperty("--status-up", colors.statusUp);
	root.style.setProperty("--status-up-text", colors.statusUpText);
	root.style.setProperty("--status-down", colors.statusDown);
	root.style.setProperty("--status-down-text", colors.statusDownText);
	root.style.setProperty("--status-degraded", colors.statusDegraded);
	root.style.setProperty("--status-degraded-text", colors.statusDegradedText);

	root.style.setProperty("--accent-primary", colors.accentPrimary);
	root.style.setProperty("--accent-secondary", colors.accentSecondary);
	root.style.setProperty("--accent-tertiary", colors.accentTertiary);

	root.style.setProperty("--scrollbar-track", colors.scrollbarTrack);
	root.style.setProperty("--scrollbar-thumb", colors.scrollbarThumb);
	root.style.setProperty("--scrollbar-thumb-hover", colors.scrollbarThumbHover);

	root.style.setProperty("--notification-success", colors.notificationSuccess);
	root.style.setProperty("--notification-success-border", colors.notificationSuccessBorder);
	root.style.setProperty("--notification-error", colors.notificationError);
	root.style.setProperty("--notification-error-border", colors.notificationErrorBorder);
	root.style.setProperty("--notification-warning", colors.notificationWarning);
	root.style.setProperty("--notification-warning-border", colors.notificationWarningBorder);

	// Store the current theme name
	root.setAttribute("data-theme", theme.name);

	// Save to localStorage for persistence
	try {
		localStorage.setItem("uptimemonitor-theme", theme.name);
	} catch (e) {
		// localStorage might not be available
	}
}

/**
 * Get the current theme from localStorage or default
 */
export function getCurrentTheme(): Theme {
	try {
		const saved = localStorage.getItem("uptimemonitor-theme");
		if (saved && validThemeNames.includes(saved as ThemeName)) {
			return themes[saved as ThemeName];
		}
	} catch (e) {
		// localStorage might not be available
	}

	// Return the configured default theme
	const defaultTheme = (typeof globalThis !== "undefined" && globalThis.DEFAULT_THEME) || "midnight";
	return getTheme(defaultTheme);
}

/**
 * Initialize theme system
 */
export function initTheme(): void {
	const theme = getCurrentTheme();
	applyTheme(theme);
}

/**
 * Create theme selector HTML
 */
export function createThemeSelectorHTML(): string {
	return `
		<select id="themeSelector" class="cursor-pointer bg-[var(--bg-hover)] text-[var(--text-muted)] text-xs rounded px-2 py-1 border border-[var(--border-secondary)] focus:outline-none focus:border-[var(--accent-primary)]">
			${validThemeNames.map((name) => `<option value="${name}">${themes[name].displayName}</option>`).join("")}
		</select>
	`;
}
