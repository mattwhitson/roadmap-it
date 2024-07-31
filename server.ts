import express from "express";
import { createRequestHandler } from "@remix-run/express";
import { ServerBuild } from "@remix-run/node";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();
app.use(
  viteDevServer ? viteDevServer.middlewares : express.static("build/client")
);

const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
  : await import("./build/server/index.js");

const finalBuild = build as unknown as ServerBuild;
app.all("*", createRequestHandler({ build: finalBuild }));

app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
