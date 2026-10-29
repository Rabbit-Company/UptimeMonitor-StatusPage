import { expect, test } from "bun:test";
import type { StatusItem } from "../src/types";

globalThis.DEFAULT_PERIOD = "24h";

const { appState } = await import("../src/state");

function monitor(id: string, latency: number): StatusItem {
	return { id, type: "monitor", name: id, status: "up", latency };
}

test("recalculates nested group latencies from their direct children", () => {
	const eu = monitor("eu", 100);
	const us = monitor("us", 50);
	const inner: StatusItem = { id: "inner", type: "group", name: "inner", status: "up", latency: 1, children: [eu, us] };
	const outer: StatusItem = { id: "outer", type: "group", name: "outer", status: "up", latency: 1, children: [inner, monitor("db", 225)] };

	const changed = appState.recalculateGroupLatencies([outer]);
	expect(inner.latency).toBe(75);
	expect(outer.latency).toBe(150);
	expect(changed.map((g) => g.id)).toEqual(["inner", "outer"]);

	eu.latency = 200;
	appState.recalculateGroupLatencies([outer]);
	expect(inner.latency).toBe(125);
	expect(outer.latency).toBe(175);

	expect(appState.recalculateGroupLatencies([outer])).toEqual([]);
});
