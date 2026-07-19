// mill/index.ts — MILL's public entry: the framework-agnostic core + the default
// BATCH+GRAIN adapter + the live content route (the BATCH hosting adapter). A non-GRAIN
// consumer imports only ./core and supplies its own adapter.
export * from "./core/index.ts";
export {
  createGrainAdapter, renderGrainDocument,
} from "./adapters/grain/grain-adapter.ts";
export type { GrainAdapterOptions } from "./adapters/grain/grain-adapter.ts";
export { createMillRoutes, dirSource, packageDocsSource } from "./serve.ts";
export type {
  ContentSource, MillCollection, MillServeDeps, MillRequestHandler, PageChrome, PageInput,
} from "./serve.ts";
