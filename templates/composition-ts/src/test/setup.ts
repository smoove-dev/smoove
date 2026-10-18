// Runs before every test file. The server renderer's Node backend: a skia
// canvas plus Node font and media loaders, so Font nodes (and Video) load in
// tests the same way they do in a server render. Must run before any
// composition is built.
import "@smoove/renderer/register";
