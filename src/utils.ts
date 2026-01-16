import type { Period, HistoryType, HistoryDataPoint, GroupHistoryDataPoint, StatusItem } from "./types";

/**
 * Get the appropriate history type for a given period
 */
export function getHistoryTypeForPeriod(period: Period): HistoryType {
	switch (period) {
		case "1h":
		case "24h":
			return "raw";
		case "7d":
			return "hourly";
		case "30d":
		case "90d":
		case "365d":
			return "daily";
		default:
			return "hourly";
	}
}

/**
 * Get the time range cutoff for filtering data based on period
 */
export function getTimeRangeForPeriod(period: Period): number {
	const now = Date.now();
	switch (period) {
		case "1h":
			return now - 60 * 60 * 1000;
		case "24h":
			return now - 24 * 60 * 60 * 1000;
		case "7d":
			return now - 7 * 24 * 60 * 60 * 1000;
		case "30d":
			return now - 30 * 24 * 60 * 60 * 1000;
		case "90d":
			return now - 90 * 24 * 60 * 60 * 1000;
		case "365d":
			return now - 365 * 24 * 60 * 60 * 1000;
		default:
			return now - 24 * 60 * 60 * 1000;
	}
}

/**
 * Parse timestamp string to Date object
 */
export function parseTimestamp(timestamp: string): Date {
	// Handle date-only format (YYYY-MM-DD)
	if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
		const [year, month, day] = timestamp.split("-").map(Number) as [number, number, number];
		return new Date(year, month - 1, day);
	}
	return new Date(timestamp);
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateOnly(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Format time as HH:MM or HH:MM:SS
 */
export function getTime(date: Date | string | number, seconds: boolean = true): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, "0");
	const h = pad(d.getHours());
	const m = pad(d.getMinutes());
	const s = pad(d.getSeconds());
	return seconds ? `${h}:${m}:${s}` : `${h}:${m}`;
}

/**
 * Format date as YYYY-MM-DD
 */
export function getDate(date: Date | string | number): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, "0");
	const year = d.getFullYear();
	const month = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	return `${year}-${month}-${day}`;
}

/**
 * Format date and time as YYYY-MM-DD HH:MM:SS
 */
export function getDateTime(date: Date | string | number, seconds: boolean = true): string {
	const d = new Date(date);
	const pad = (n: number) => String(n).padStart(2, "0");
	const year = d.getFullYear();
	const month = pad(d.getMonth() + 1);
	const day = pad(d.getDate());
	const hours = pad(d.getHours());
	const minutes = pad(d.getMinutes());
	const secs = pad(d.getSeconds());
	return seconds ? `${year}-${month}-${day} ${hours}:${minutes}:${secs}` : `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Get appropriate label format based on period
 */
export function formatLabelForPeriod(timestamp: string, period: Period): string {
	const date = parseTimestamp(timestamp);
	switch (period) {
		case "1h":
		case "24h":
			return getTime(date, false);
		case "7d":
			return getDateTime(date, false);
		case "30d":
		case "90d":
		case "365d":
			return getDate(date);
		default:
			return getDateTime(date, false);
	}
}

/**
 * Get uptime value for a specific period from a status item
 */
export function getUptimeValue(item: StatusItem, period: string): number | undefined {
	switch (period) {
		case "1h":
			return item.uptime1h;
		case "24h":
			return item.uptime24h;
		case "7d":
			return item.uptime7d;
		case "30d":
			return item.uptime30d;
		case "90d":
			return item.uptime90d;
		case "365d":
			return item.uptime365d;
		default:
			return item.uptime24h;
	}
}

/**
 * Fill missing intervals in history data with 0 uptime and null latencies
 * Handles cases where monitoring hasn't been running for the full period
 */
export function fillMissingIntervals<T extends { timestamp: string; uptime: number }>(data: T[], period: Period, historyType: HistoryType): T[] {
	if (historyType === "raw") {
		return data;
	}

	const now = new Date();
	const cutoffTime = getTimeRangeForPeriod(period);
	const intervalMs = historyType === "hourly" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

	// Build a map of existing data points
	const dataMap = new Map<string, T>();
	for (const point of data) {
		const date = parseTimestamp(point.timestamp);
		let key: string;
		if (historyType === "hourly") {
			key = `${formatDateOnly(date)}-${String(date.getHours()).padStart(2, "0")}`;
		} else {
			key = formatDateOnly(date);
		}
		dataMap.set(key, point);
	}

	const filledData: T[] = [];

	// Determine start date
	const startDate = new Date(cutoffTime);
	if (historyType === "hourly") {
		startDate.setMinutes(0, 0, 0);
	} else {
		startDate.setHours(0, 0, 0, 0);
	}

	// Determine end date
	let endDate: Date;
	if (historyType === "hourly") {
		endDate = new Date(now);
		endDate.setMinutes(0, 0, 0);
		endDate.setHours(endDate.getHours() - 1);
	} else {
		endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	}

	let currentTime = startDate.getTime();
	const endTime = endDate.getTime();

	// Fill in missing intervals
	while (currentTime <= endTime) {
		const currentDate = new Date(currentTime);
		let key: string;
		if (historyType === "hourly") {
			key = `${formatDateOnly(currentDate)}-${String(currentDate.getHours()).padStart(2, "0")}`;
		} else {
			key = formatDateOnly(currentDate);
		}

		const existingPoint = dataMap.get(key);

		if (existingPoint) {
			filledData.push(existingPoint);
		} else {
			const placeholderTimestamp = historyType === "daily" ? formatDateOnly(currentDate) : currentDate.toISOString();
			const placeholderPoint = {
				timestamp: placeholderTimestamp,
				uptime: 0,
			} as T;
			filledData.push(placeholderPoint);
		}

		currentTime += intervalMs;
	}

	// Add current interval if it has data
	const currentIntervalDate = new Date(now);
	if (historyType === "hourly") {
		currentIntervalDate.setMinutes(0, 0, 0);
	} else {
		currentIntervalDate.setHours(0, 0, 0, 0);
	}

	let currentKey: string;
	if (historyType === "hourly") {
		currentKey = `${formatDateOnly(currentIntervalDate)}-${String(currentIntervalDate.getHours()).padStart(2, "0")}`;
	} else {
		currentKey = formatDateOnly(currentIntervalDate);
	}

	const currentIntervalPoint = dataMap.get(currentKey);
	if (currentIntervalPoint) {
		filledData.push(currentIntervalPoint);
	}

	return filledData;
}

/**
 * Aggregate raw 1-minute data into 10-minute intervals for 24h period
 * This reduces ~1440 data points to ~144 for better chart performance
 */
export function aggregateTo10MinIntervals<T extends HistoryDataPoint | GroupHistoryDataPoint>(data: T[]): T[] {
	if (data.length === 0) return data;

	// Group data points by 10-minute buckets
	const buckets = new Map<string, T[]>();

	for (const point of data) {
		const date = parseTimestamp(point.timestamp);
		// Round down to nearest 10-minute interval
		const minutes = Math.floor(date.getMinutes() / 10) * 10;
		date.setMinutes(minutes, 0, 0);
		const bucketKey = date.toISOString();

		if (!buckets.has(bucketKey)) {
			buckets.set(bucketKey, []);
		}
		buckets.get(bucketKey)!.push(point);
	}

	const aggregated: T[] = [];

	for (const [bucketKey, points] of buckets) {
		if (points.length === 0) continue;

		const uptimeSum = points.reduce((sum, p) => sum + p.uptime, 0);
		const uptimeAvg = uptimeSum / points.length;

		const aggregatedPoint: any = {
			timestamp: bucketKey,
			uptime: uptimeAvg,
		};

		// Aggregate latency values
		const latencyMinValues = points.map((p) => p.latency_min).filter((v): v is number => v !== undefined && v !== null);
		const latencyMaxValues = points.map((p) => p.latency_max).filter((v): v is number => v !== undefined && v !== null);
		const latencyAvgValues = points.map((p) => p.latency_avg).filter((v): v is number => v !== undefined && v !== null);

		if (latencyMinValues.length > 0) {
			aggregatedPoint.latency_min = Math.min(...latencyMinValues);
		}
		if (latencyMaxValues.length > 0) {
			aggregatedPoint.latency_max = Math.max(...latencyMaxValues);
		}
		if (latencyAvgValues.length > 0) {
			aggregatedPoint.latency_avg = latencyAvgValues.reduce((sum, v) => sum + v, 0) / latencyAvgValues.length;
		}

		// Aggregate custom metrics if present (only for HistoryDataPoint)
		const firstPoint = points[0] as any;
		if ("custom1_avg" in firstPoint) {
			aggregateCustomMetric(points, aggregatedPoint, "custom1");
			aggregateCustomMetric(points, aggregatedPoint, "custom2");
			aggregateCustomMetric(points, aggregatedPoint, "custom3");
		}

		aggregated.push(aggregatedPoint as T);
	}

	// Sort by timestamp
	aggregated.sort((a, b) => parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime());

	return aggregated;
}

/**
 * Helper function to aggregate a custom metric
 */
function aggregateCustomMetric(points: any[], aggregatedPoint: any, metricName: string): void {
	const minValues = points.map((p) => p[`${metricName}_min`]).filter((v): v is number => v !== undefined && v !== null);
	const maxValues = points.map((p) => p[`${metricName}_max`]).filter((v): v is number => v !== undefined && v !== null);
	const avgValues = points.map((p) => p[`${metricName}_avg`]).filter((v): v is number => v !== undefined && v !== null);

	if (minValues.length > 0) {
		aggregatedPoint[`${metricName}_min`] = Math.min(...minValues);
	}
	if (maxValues.length > 0) {
		aggregatedPoint[`${metricName}_max`] = Math.max(...maxValues);
	}
	if (avgValues.length > 0) {
		aggregatedPoint[`${metricName}_avg`] = avgValues.reduce((sum, v) => sum + v, 0) / avgValues.length;
	}
}
