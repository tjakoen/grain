// grain/ai/webllm.test.ts — UNIT: the WebGPU probe. loadEngine itself does a real CDN dynamic import,
// so it isn't unit-tested (no network in tests); webgpuAvailable is pure logic over a probed navigator,
// so we drive it with a fake navigator on globalThis and prove every gate. Each test restores the
// original navigator so the suite stays order-independent.
import { test, expect, afterEach } from "bun:test";
import { webgpuAvailable, probeDevice, canRunModel } from "./webllm.ts";

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

test("probeDevice: reports webgpu true + the raw deviceMemory (for a tiering caller)", async () => {
  withNavigator({ deviceMemory: 8, gpu: { requestAdapter: async () => ({}) } });
  expect(await probeDevice()).toEqual({ webgpu: true, deviceMemory: 8 });
});

test("probeDevice: absent deviceMemory → undefined, never a fabricated number", async () => {
  withNavigator({ gpu: { requestAdapter: async () => ({}) } });
  expect(await probeDevice()).toEqual({ webgpu: true, deviceMemory: undefined });
});

test("probeDevice: reports deviceMemory even when WebGPU is absent (a caller still tiers/logs)", async () => {
  withNavigator({ deviceMemory: 4 });
  expect(await probeDevice()).toEqual({ webgpu: false, deviceMemory: 4 });
});

test("probeDevice: a throwing requestAdapter degrades to webgpu:false, keeping deviceMemory", async () => {
  withNavigator({ deviceMemory: 8, gpu: { requestAdapter: async () => { throw new Error("no device"); } } });
  expect(await probeDevice()).toEqual({ webgpu: false, deviceMemory: 8 });
});

test("canRunModel: pure gate — webgpu AND not a known-tiny device", () => {
  expect(canRunModel({ webgpu: true, deviceMemory: 8 })).toBe(true);
  expect(canRunModel({ webgpu: true, deviceMemory: 2 })).toBe(false);   // known-tiny → OOM even for the smallest
  expect(canRunModel({ webgpu: true })).toBe(true);                     // unknown memory never blocks
  expect(canRunModel({ webgpu: false, deviceMemory: 8 })).toBe(false);  // no adapter → no model
});
