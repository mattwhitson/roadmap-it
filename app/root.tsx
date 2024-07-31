import { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from "@remix-run/react";
import {
  ThemeProvider,
  useTheme,
  PreventFlashOnWrongTheme,
  Theme,
} from "remix-themes";
import { cn } from "@/lib/utils";

import { themeSessionResolver } from "~/sessions.server";
import { Header } from "~/routes/component.header";
import { authenticator } from "~/services.auth.server";

import styles from "~/globals.css?url";
import { ModalProvider } from "@/components/providers/modal-provider";
import { BoardProvider } from "@/components/providers/board-provider";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles, as: "style" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { getTheme } = await themeSessionResolver(request);
  const user = await authenticator.isAuthenticated(request);
  return {
    theme: getTheme(),
    user,
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");

  return (
    <ThemeProvider
      specifiedTheme={data?.theme as Theme}
      themeAction="/action/set-theme"
    >
      <InnerLayout ssrTheme={Boolean(data?.theme)}>{children}</InnerLayout>
    </ThemeProvider>
  );
}

export function InnerLayout({
  ssrTheme,
  children,
}: {
  ssrTheme: boolean;
  children: React.ReactNode;
}) {
  const [theme] = useTheme();
  return (
    <html lang="en" className={cn(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <PreventFlashOnWrongTheme ssrTheme={ssrTheme} />
        <Meta />
        <Links />
      </head>
      <body className="font-Poppins">
        <BoardProvider>
          {children}
          <ModalProvider />
        </BoardProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
