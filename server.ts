import express from "express";
import { createRequestHandler } from "@remix-run/express";
import { ServerBuild } from "@remix-run/node";
import { createServer } from "http";
import { Server } from "socket.io";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer);

// then list to the connection event and get a socket object
io.on("connection", (socket) => {
  // here you can do whatever you want with the socket of the client, in this
  // example I'm logging the socket.id of the client
  console.log(socket.id, "connected");
  // and I emit an event to the client called `event` with a simple message
  socket.emit("event", "connected!");
  // and I start listening for the event `something`
  socket.on("something", (data) => {
    // log the data together with the socket.id who send it
    console.log(socket.id, data);
    // and emeit the event again with the message pong
    socket.emit("event", "pong");
  });
});

app.use(
  viteDevServer ? viteDevServer.middlewares : express.static("build/client")
);

const build = viteDevServer
  ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
  : await import("./build/server/index.js");

const finalBuild = build as unknown as ServerBuild;
app.all(
  "*",
  createRequestHandler({
    build: finalBuild,
    getLoadContext() {
      return { io: io };
    },
  })
);

httpServer.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
