// Browser shim for `node:module`, wired up via a Vite alias. flexily's logger
// detection calls `createRequire(...)` and then invokes the returned `require`;
// returning a lazily-throwing require lets that detection fail gracefully and
// fall back to a no-op logger (instead of Vite's default stub, where
// `createRequire` is undefined and throws at module eval).
export function createRequire(_url) {
  return () => {
    throw new Error("createRequire called in browser (shimmed)");
  };
}
