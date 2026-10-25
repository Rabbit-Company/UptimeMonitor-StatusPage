import { afterAll, expect, mock, test } from "bun:test";
import { join } from "path";
import type { StatusData } from "../src/types";

globalThis.BACKEND_URL = "https://api.example.test";
globalThis.STATUS_PAGE_SLUG = "test";
globalThis.DEFAULT_PERIOD = "24h";

mock.module(join(import.meta.dir, "..", "src", "charts.ts"), () => ({ loadGroupHistory() {}, loadMonitorHistory() {} }));

const originalDocument = globalThis.document;
const elements = new Map<
	string,
	{ textContent: string; innerHTML: string; className: string; classList: { add: () => void; remove: () => void }; appendChild: () => void }
>();
globalThis.document = {
	getElementById(id: string) {
		if (!elements.has(id)) {
			elements.set(id, { textContent: "", innerHTML: "", className: "", classList: { add() {}, remove() {} }, appendChild() {} });
		}
		return elements.get(id);
	},
	createElement() {
		return { className: "", innerHTML: "" };
	},
	querySelectorAll() {
		return [];
	},
} as unknown as Document;

const { appState } = await import("../src/state");
const { scheduleStatusRefresh } = await import("../src/status-sync");
const originalFetch = globalThis.fetch;

const snapshot = (status?: "up" | "degraded" | "down"): StatusData => ({
	name: "Status",
	slug: "test",
	reports: false,
	lastUpdated: new Date().toISOString(),
	items: status ? [{ id: "quorum", type: "group", name: "Quorum", status, latency: 0 }] : [],
});

afterAll(() => {
	globalThis.fetch = originalFetch;
	globalThis.document = originalDocument;
	appState.statusData = null;
});

test("refreshes the authoritative group status with a cache-busting URL", async () => {
	appState.statusData = snapshot();
	const requests: Array<{ url: string; cache: RequestCache | undefined }> = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		requests.push({ url: String(input), cache: init?.cache });
		return Response.json(snapshot("degraded"));
	}) as unknown as typeof fetch;

	scheduleStatusRefresh();
	await Bun.sleep(500);

	expect(requests).toHaveLength(1);
	expect(requests[0]!.url).toContain("/v1/status/test?_=");
	expect(requests[0]!.cache).toBe("no-store");
	expect(appState.statusData?.items[0]?.status).toBe("degraded");
	expect(elements.get("overallStatusText")?.textContent).toBe("Degraded Performance");
});

test("ignores an older response when another status change arrives", async () => {
	appState.statusData = snapshot();
	let resolveFirst!: (response: Response) => void;
	let requests = 0;
	globalThis.fetch = (async () => {
		requests++;
		if (requests === 1) return new Promise<Response>((resolve) => (resolveFirst = resolve));
		return Response.json(snapshot("up"));
	}) as unknown as typeof fetch;

	scheduleStatusRefresh();
	await Bun.sleep(400);
	scheduleStatusRefresh();
	resolveFirst(Response.json(snapshot("down")));
	await Bun.sleep(500);

	expect(requests).toBe(2);
	expect(appState.statusData?.items[0]?.status).toBe("up");
});
