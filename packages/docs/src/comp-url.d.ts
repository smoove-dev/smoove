// The `?comp-url` import query (see @smoove/vite) compiles a demo composition to
// a standalone player module and resolves to its served URL — like Vite's built-in
// `?url`, which vite/client types but doesn't cover this custom suffix.
declare module "*?comp-url" {
  const src: string;
  export default src;
}
