import { afterAll, expect, mock, test } from "bun:test";
import { join } from "path";
import type { StatusData } from "../src/types";

globalThis.BACKEND_URL = "https://api.example.test";
globalThis.STATUS_PAGE_SLUG = "test";
globalThis.DEFAULT_PERIOD = "24h";

mock.module(join(import.meta.dir, "..", "src", "charts.ts"), () => ({ loadGroupHistory() {}, loadMonitorHistory() {} }));

const originalDocument = globalThis.document;
const elements = new Map<string, { textContent: string; innerHTML: string; className: string; classList: { add: () => void; remove: () => void } }>();
globalThis.document = {
	getElementById(id: string) {
		if (!elements.has(id)) {
			elements.set(id, { textContent: "", innerHTML: "", className: "", classList: { add() {}, remove() {} } });
		}
		return elements.get(id);
	},
} as unknown as Document;

const { appState } = await import("../src/state");
const { renderStatusSnapshot } = await import("../src/ui");

afterAll(() => {
	globalThis.document = originalDocument;
	appState.statusData = null;
});

test("shows a neutral pending state when no check has a status", () => {
	appState.statusData = {
		name: "Status",
		slug: "test",
		reports: false,
		items: [],
		lastUpdated: new Date().toISOString(),
	} satisfies StatusData;

	renderStatusSnapshot();

	expect(elements.get("overallStatusText")?.textContent).toBe("Awaiting checks");
	expect(elements.get("overallStatusIndicator")?.className).toContain("--text-muted");
	expect(elements.get("servicesList")?.innerHTML).toContain("Waiting for the first checks");
	expect(elements.get("servicesUp")?.textContent).toBe("0");
	expect(elements.get("servicesDown")?.textContent).toBe("0");
});
