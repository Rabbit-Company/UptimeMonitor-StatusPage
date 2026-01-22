import {
	Chart,
	LineController,
	LineElement,
	BarController,
	BarElement,
	PointElement,
	LinearScale,
	CategoryScale,
	TimeScale,
	Tooltip,
	Legend,
	Filler,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import type { CustomMetricConfig, HistoryDataPoint, GroupHistoryDataPoint, MonitorHistoryResponse, GroupHistoryResponse, Period, StatusItem } from "./types";
import { BACKEND_URL, UPTIME_PRECISION } from "./config";
import { appState } from "./state";
import {
	getHistoryTypeForPeriod,
	getTimeRangeForPeriod,
	parseTimestamp,
	formatLabelForPeriod,
	fillMissingIntervals,
	aggregateTo10MinIntervals,
	getDateTime,
} from "./utils";
import { getCurrentTheme, type Theme } from "./themes";

// Register Chart.js components
Chart.register(
	LineController,
	LineElement,
	BarController,
	BarElement,
	PointElement,
	LinearScale,
	CategoryScale,
	TimeScale,
	Tooltip,
	Legend,
	Filler,
	zoomPlugin,
);

/**
 * Get current theme colors for charts
 */
function getChartColors(): Theme["colors"] {
	return getCurrentTheme().colors;
}

/**
 * Common chart options for zoom plugin
 */
const zoomOptions = {
	pan: {
		enabled: true,
		mode: "x" as const,
	},
	zoom: {
		wheel: {
			enabled: true,
			speed: 0.1,
		},
		pinch: {
			enabled: true,
		},
		mode: "x" as const,
	},
	limits: {
		x: {
			min: "original" as const,
			max: "original" as const,
			minRange: 10,
		},
	},
};

/**
 * Get common scale options with theme colors
 */
function getXScaleOptions() {
	const colors = getChartColors();
	return {
		ticks: {
			color: colors.textMuted,
			maxRotation: 45,
			minRotation: 45,
		},
		grid: {
			display: false,
		},
	};
}

/**
 * Create uptime chart
 */
function createUptimeChart(ctx: CanvasRenderingContext2D, labels: string[], uptimeData: number[]): Chart {
	const colors = getChartColors();

	return new Chart(ctx, {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Uptime %",
					data: uptimeData,
					backgroundColor: uptimeData.map((v) => (v >= 99 ? colors.chartUptime : v >= 95 ? colors.chartUptimeWarning : colors.chartUptimeCritical)),
					borderColor: uptimeData.map((v) =>
						v >= 99
							? colors.chartUptime.replace("0.8", "1")
							: v >= 95
								? colors.chartUptimeWarning.replace("0.8", "1")
								: colors.chartUptimeCritical.replace("0.8", "1"),
					),
					borderWidth: 1,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					display: false,
				},
				tooltip: {
					callbacks: {
						label: function (context) {
							return `Uptime: ${context.parsed.y?.toFixed(UPTIME_PRECISION)}%`;
						},
					},
				},
				zoom: zoomOptions,
			},
			scales: {
				y: {
					beginAtZero: true,
					max: 100,
					ticks: {
						callback: function (value) {
							return value + "%";
						},
						color: colors.textMuted,
					},
					grid: {
						color: colors.textMuted + "1A", // 10% opacity
					},
				},
				x: getXScaleOptions(),
			},
		},
	});
}

/**
 * Create latency chart
 */
function createLatencyChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	latencyMinData: (number | null)[],
	latencyAvgData: (number | null)[],
	latencyMaxData: (number | null)[],
): Chart {
	const colors = getChartColors();

	return new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: "Min Latency",
					data: latencyMinData,
					borderColor: colors.chartLatencyMin,
					borderDash: [5, 5],
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: "Avg Latency",
					data: latencyAvgData,
					borderColor: colors.chartLatency,
					backgroundColor: colors.chartLatency.replace("1)", "0.1)"),
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: "Max Latency",
					data: latencyMaxData,
					borderColor: colors.chartLatencyMax,
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
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					labels: {
						color: colors.textMuted,
						usePointStyle: true,
						pointStyle: "line",
					},
				},
				tooltip: {
					mode: "index",
					intersect: false,
					callbacks: {
						label: function (context) {
							const value = context.parsed.y;
							if (value === null || value === undefined) return "";
							return `${context.dataset.label}: ${value.toFixed(LATENCY_PRECISION)}ms`;
						},
					},
				},
				zoom: zoomOptions,
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						callback: function (value) {
							return value + "ms";
						},
						color: colors.textMuted,
					},
					grid: {
						color: colors.textMuted + "1A",
					},
				},
				x: getXScaleOptions(),
			},
		},
	});
}

/**
 * Create custom metric chart
 */
export function createCustomMetricChart(
	ctx: CanvasRenderingContext2D,
	labels: string[],
	minData: (number | null)[],
	avgData: (number | null)[],
	maxData: (number | null)[],
	config: CustomMetricConfig,
	chartColorKey: "chartCustom1" | "chartCustom2" | "chartCustom3",
): Chart {
	const colors = getChartColors();
	const unit = config.unit || "";
	const mainColor = colors[chartColorKey];

	return new Chart(ctx, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: `Min ${config.name}`,
					data: minData,
					borderColor: colors.chartLatencyMin,
					borderDash: [5, 5],
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: `Avg ${config.name}`,
					data: avgData,
					borderColor: mainColor,
					backgroundColor: mainColor.replace("1)", "0.1)"),
					tension: 0.3,
					fill: false,
					pointRadius: 0,
				},
				{
					label: `Max ${config.name}`,
					data: maxData,
					borderColor: colors.chartLatencyMax,
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
			interaction: {
				mode: "index",
				intersect: false,
			},
			plugins: {
				legend: {
					labels: {
						color: colors.textMuted,
						usePointStyle: true,
						pointStyle: "line",
					},
				},
				tooltip: {
					mode: "index",
					intersect: false,
					callbacks: {
						label: function (context) {
							const value = context.parsed.y;
							if (value === null || value === undefined) return "";
							return `${context.dataset.label}: ${Math.round(value)} ${unit}`;
						},
					},
				},
				zoom: zoomOptions,
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						callback: function (value) {
							return `${value} ${unit}`;
						},
						color: colors.textMuted,
					},
					grid: {
						color: colors.textMuted + "1A",
					},
				},
				x: getXScaleOptions(),
			},
		},
	});
}

/**
 * Setup chart synchronization for zoom/pan
 */
function setupChartSync(): void {
	const allCharts = [
		appState.modalCharts.uptime,
		appState.modalCharts.latency,
		appState.modalCharts.custom1,
		appState.modalCharts.custom2,
		appState.modalCharts.custom3,
	].filter(Boolean) as Chart[];

	const syncCharts = (sourceChart: Chart) => {
		const { min, max } = sourceChart.scales.x!;
		for (const chart of allCharts) {
			if (chart !== sourceChart) {
				chart.zoomScale("x", { min, max }, "none");
			}
		}
	};

	for (const chart of allCharts) {
		chart.options.plugins!.zoom!.zoom!.onZoomComplete = function ({ chart: c }) {
			syncCharts(c);
		};
		chart.options.plugins!.zoom!.pan!.onPanComplete = function ({ chart: c }) {
			syncCharts(c);
		};
	}
}

/**
 * Load and display group history
 */
export async function loadGroupHistory(item: StatusItem, period: Period): Promise<void> {
	const historyType = getHistoryTypeForPeriod(period);

	let endpoint: string;
	switch (historyType) {
		case "raw":
			endpoint = `${BACKEND_URL}/v1/groups/${item.id}/history`;
			break;
		case "hourly":
			endpoint = `${BACKEND_URL}/v1/groups/${item.id}/history/hourly`;
			break;
		case "daily":
			endpoint = `${BACKEND_URL}/v1/groups/${item.id}/history/daily`;
			break;
	}

	const response = await fetch(endpoint);
	if (!response.ok) throw new Error(`Failed to fetch group history`);

	const historyData: GroupHistoryResponse = await response.json();

	const cutoffTime = getTimeRangeForPeriod(period);
	let filteredData = historyData.data.filter((d) => parseTimestamp(d.timestamp).getTime() >= cutoffTime);

	if (period === "24h" && historyType === "raw") {
		filteredData = aggregateTo10MinIntervals(filteredData);
	}

	const filledData = fillMissingIntervals(filteredData, period, historyType);

	const labels = filledData.map((d) => formatLabelForPeriod(d.timestamp, period));
	const uptimeData = filledData.map((d) => d.uptime);
	const latencyMinData = filledData.map((d) => d.latency_min ?? null);
	const latencyMaxData = filledData.map((d) => d.latency_max ?? null);
	const latencyAvgData = filledData.map((d) => d.latency_avg ?? null);

	appState.destroyAllCharts();

	const uptimeCtx = (document.getElementById("modal-uptime-chart") as HTMLCanvasElement).getContext("2d")!;
	appState.modalCharts.uptime = createUptimeChart(uptimeCtx, labels, uptimeData);

	const hasLatencyData = latencyAvgData.some((v) => v !== null);
	if (hasLatencyData) {
		const latencyCtx = (document.getElementById("modal-latency-chart") as HTMLCanvasElement).getContext("2d")!;
		appState.modalCharts.latency = createLatencyChart(latencyCtx, labels, latencyMinData, latencyAvgData, latencyMaxData);
	}

	document.getElementById("custom1-chart-container")!.classList.add("hidden");
	document.getElementById("custom2-chart-container")!.classList.add("hidden");
	document.getElementById("custom3-chart-container")!.classList.add("hidden");

	setupChartSync();
	updateModalStats(item);
}

/**
 * Load and display monitor history
 */
export async function loadMonitorHistory(item: StatusItem, period: Period): Promise<void> {
	const historyType = getHistoryTypeForPeriod(period);

	let endpoint: string;
	switch (historyType) {
		case "raw":
			endpoint = `${BACKEND_URL}/v1/monitors/${item.id}/history`;
			break;
		case "hourly":
			endpoint = `${BACKEND_URL}/v1/monitors/${item.id}/history/hourly`;
			break;
		case "daily":
			endpoint = `${BACKEND_URL}/v1/monitors/${item.id}/history/daily`;
			break;
	}

	const response = await fetch(endpoint);
	if (!response.ok) throw new Error(`Failed to fetch monitor history`);

	const historyData: MonitorHistoryResponse = await response.json();

	const cutoffTime = getTimeRangeForPeriod(period);
	let filteredData = historyData.data.filter((d) => parseTimestamp(d.timestamp).getTime() >= cutoffTime);

	if (period === "24h" && historyType === "raw") {
		filteredData = aggregateTo10MinIntervals(filteredData);
	}

	const filledData = fillMissingIntervals(filteredData, period, historyType);

	const labels = filledData.map((d) => formatLabelForPeriod(d.timestamp, period));
	const uptimeData = filledData.map((d) => d.uptime);
	const latencyMinData = filledData.map((d) => d.latency_min ?? null);
	const latencyMaxData = filledData.map((d) => d.latency_max ?? null);
	const latencyAvgData = filledData.map((d) => d.latency_avg ?? null);

	appState.destroyAllCharts();

	const uptimeCtx = (document.getElementById("modal-uptime-chart") as HTMLCanvasElement).getContext("2d")!;
	appState.modalCharts.uptime = createUptimeChart(uptimeCtx, labels, uptimeData);

	const latencyCtx = (document.getElementById("modal-latency-chart") as HTMLCanvasElement).getContext("2d")!;
	appState.modalCharts.latency = createLatencyChart(latencyCtx, labels, latencyMinData, latencyAvgData, latencyMaxData);

	const customMetrics = historyData.customMetrics;

	createCustomMetricChartIfAvailable("custom1", customMetrics?.custom1, filledData, "chartCustom1");
	createCustomMetricChartIfAvailable("custom2", customMetrics?.custom2, filledData, "chartCustom2");
	createCustomMetricChartIfAvailable("custom3", customMetrics?.custom3, filledData, "chartCustom3");

	setupChartSync();
	updateModalStats(item);
}

/**
 * Create custom metric chart if data is available
 */
function createCustomMetricChartIfAvailable(
	metricKey: "custom1" | "custom2" | "custom3",
	config: CustomMetricConfig | undefined,
	filledData: HistoryDataPoint[],
	chartColorKey: "chartCustom1" | "chartCustom2" | "chartCustom3",
): void {
	const container = document.getElementById(`${metricKey}-chart-container`)!;
	const labels = filledData.map((d) => formatLabelForPeriod(d.timestamp, appState.currentModalPeriod));

	const minKey = `${metricKey}_min` as keyof HistoryDataPoint;
	const maxKey = `${metricKey}_max` as keyof HistoryDataPoint;
	const avgKey = `${metricKey}_avg` as keyof HistoryDataPoint;

	if (config && filledData.some((d) => d[avgKey] !== undefined)) {
		const minData = filledData.map((d) => (d[minKey] as number) ?? null);
		const maxData = filledData.map((d) => (d[maxKey] as number) ?? null);
		const avgData = filledData.map((d) => (d[avgKey] as number) ?? null);

		document.getElementById(`${metricKey}-chart-title`)!.textContent = `${config.name} History`;
		container.classList.remove("hidden");

		const ctx = (document.getElementById(`modal-${metricKey}-chart`) as HTMLCanvasElement).getContext("2d")!;
		appState.modalCharts[metricKey] = createCustomMetricChart(ctx, labels, minData, avgData, maxData, config, chartColorKey);
	} else {
		container.classList.add("hidden");
	}
}

/**
 * Update modal stats display
 */
function updateModalStats(item: StatusItem): void {
	const colors = getChartColors();

	const getUptimeClass = (value: number) => {
		if (value > 99) return `color: ${colors.statusUpText}`;
		if (value > 95) return `color: ${colors.statusDegradedText}`;
		return `color: ${colors.statusDownText}`;
	};

	const statsHtml = `
		<div class="bg-[var(--bg-tertiary)] rounded-lg p-4">
			<p class="text-xs text-[var(--text-muted)] mb-1">Last Check</p>
			<p class="text-sm text-[var(--text-muted)]">${item.lastCheck ? getDateTime(item.lastCheck) : "-"}</p>
		</div>
		<div class="bg-[var(--bg-tertiary)] rounded-lg p-4">
			<p class="text-xs text-[var(--text-muted)] mb-1">1 Day Uptime</p>
			<p class="text-sm font-semibold" style="${getUptimeClass(item.uptime24h || 0)}">
				${item.uptime24h?.toFixed(UPTIME_PRECISION) || "-"}%
			</p>
		</div>
		<div class="bg-[var(--bg-tertiary)] rounded-lg p-4">
			<p class="text-xs text-[var(--text-muted)] mb-1">30 Day Uptime</p>
			<p class="text-sm font-semibold" style="${getUptimeClass(item.uptime30d || 0)}">
				${item.uptime30d?.toFixed(UPTIME_PRECISION) || "-"}%
			</p>
		</div>
		<div class="bg-[var(--bg-tertiary)] rounded-lg p-4">
			<p class="text-xs text-[var(--text-muted)] mb-1">365 Day Uptime</p>
			<p class="text-sm font-semibold" style="${getUptimeClass(item.uptime365d || 0)}">
				${item.uptime365d?.toFixed(UPTIME_PRECISION) || "-"}%
			</p>
		</div>
	`;

	document.getElementById("modalStats")!.innerHTML = statsHtml;
}
