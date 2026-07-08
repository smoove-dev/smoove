// app.d.ts
import "@react-router/node"; // or the adapter you are using

declare module "react-router" {
  // Augment the existing AppLoadContext interface
  interface AppLoadContext {}
}
