/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition } from "react";
import { hydrateRoot } from "react-dom/client";

// Turned off strict mode because it would cause some weird glitches with @dnd-kit that completely disappeared once it was turned off
startTransition(() => {
  hydrateRoot(document, <RemixBrowser />);
});
