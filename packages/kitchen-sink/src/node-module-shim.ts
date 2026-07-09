export function createRequire(_url: string | URL): (id: string) => unknown {
  return () => {
    throw new Error("createRequire called in browser (shimmed)");
  };
}
