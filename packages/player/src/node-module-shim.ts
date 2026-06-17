// Browser shim for `node:module`, used only by the standalone bundle via a
// Vite alias. flexily's logger detection calls `createRequire(...)` and then
// invokes the returned `require`; returning a lazily-throwing require lets that
// detection fail gracefully and fall back to a no-op logger (instead of Vite's
// default stub, where `createRequire` is undefined and throws at module eval).
export function createRequire(_url: string | URL): (id: string) => unknown {
  return () => {
    throw new Error("createRequire called in browser (shimmed)");
  };
}
