// grain/ai/webllm.test.ts — UNIT: the WebGPU probe. loadEngine itself does a real CDN dynamic import,
// so it isn't unit-tested (no network in tests); webgpuAvailable is pure logic over a probed navigator,
// so we drive it with a fake navigator on globalThis and prove every gate. Each test restores the
// original navigator so the suite stays order-independent.
import { test, expect, afterEach } from "bun:test";
import { webgpuAvailable } from "./webllm.ts";

const g = globalThis as unknown as { navigator?: unknown };
const original = g.navigator;
afterEach(() => { g.navigator = original; });

function withNavigator(n: unknown): void { g.navigator = n; }

test("webgpuAvailable: no navigator → false", async () => {
  withNavigator(undefined);
  expect(await webgpuAvailable()).toBe(false);
});

test("webgpuAvailable: no gpu on navigator → false", async () => {
  withNavigator({});
  expect(await webgpuAvailable()).toBe(false);
});

test("webgpuAvailable: gpu.requestAdapter returns an adapter → true", async () => {
  withNavigator({ gpu: { requestAdapter: async () => ({}) } });
  expect(await webgpuAvailable()).toBe(true);
});

test("webgpuAvailable: gpu present but no adapter → false", async () => {
  withNavigator({ gpu: { requestAdapter: async () => null } });
  expect(await webgpuAvailable()).toBe(false);
});

test("webgpuAvailable: a known-low deviceMemory rules it out up front", async () => {
  withNavigator({ deviceMemory: 2, gpu: { requestAdapter: async () => ({}) } });
  expect(await webgpuAvailable()).toBe(false);
});

test("webgpuAvailable: absent deviceMemory never blocks (Firefox/Safari don't report it)", async () => {
  withNavigator({ gpu: { requestAdapter: async () => ({}) } });   // no deviceMemory key
  expect(await webgpuAvailable()).toBe(true);
});

test("webgpuAvailable: a throwing requestAdapter degrades to false, not a hang", async () => {
  withNavigator({ gpu: { requestAdapter: async () => { throw new Error("no device"); } } });
  expect(await webgpuAvailable()).toBe(false);
});
