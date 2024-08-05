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
import { SocketProvider } from "@/components/providers/socket-provider";
import { User } from "db/schema";
import { Toaster } from "@/components/ui/sonner";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles, as: "style" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { getTheme } = await themeSessionResolver(request);
  const user = await authenticator.isAuthenticated(request);
  return {
    theme: getTheme(),
    user,
    envVariables: {
      HOST_URL: process.env.HOST_URL!,
    },
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");

  return (
    <ThemeProvider
      specifiedTheme={data?.theme as Theme}
      themeAction="/action/set-theme"
    >
      <InnerLayout
        user={data?.user || undefined}
        ssrTheme={Boolean(data?.theme)}
        envVariables={data?.envVariables}
      >
        {children}
      </InnerLayout>
    </ThemeProvider>
  );
}

export function InnerLayout({
  ssrTheme,
  user,
  children,
  envVariables,
}: {
  ssrTheme: boolean;
  user?: User | undefined;
  children: React.ReactNode;
  envVariables: { [key: string]: string } | undefined;
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
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(envVariables)}`,
          }}
        />
      </head>
      <body className="font-Poppins">
        <SocketProvider user={user}>
          <BoardProvider>
            {children}
            <ModalProvider />
          </BoardProvider>
        </SocketProvider>
        <Toaster />
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
