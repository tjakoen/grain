// mill/index.ts — MILL's public entry: the framework-agnostic core + the default
// BATCH+GRAIN adapter. A non-GRAIN consumer imports only ./core and supplies its own adapter.
export * from "./core/index.ts";
export {
  createGrainAdapter, renderGrainDocument,
} from "./adapters/grain/grain-adapter.ts";
export type { GrainAdapterOptions } from "./adapters/grain/grain-adapter.ts";
