import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { renderToPipeableStream } from "react-dom/server";
import { type EntryContext, type RouterContextProvider, ServerRouter } from "react-router";

/**
 * SPA build only prerenders the root shell to index.html in Node, so we always
 * wait for the full tree (onAllReady) and skip bot detection.
 */
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    let status = responseStatusCode;
    const { pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          pipe(body);
          resolve(new Response(stream, { headers: responseHeaders, status }));
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          status = 500;
          if (shellRendered) console.error(error);
        },
      },
    );
  });
}
