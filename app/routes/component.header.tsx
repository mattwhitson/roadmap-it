import { Link, useFetcher, useRouteLoaderData } from "@remix-run/react";
import { ModeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services.auth.server";
import { loader } from "~/root";

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.logout(request, { redirectTo: "/" });
  return null;
}

export function Header() {
  const logOut = useFetcher<typeof action>();
  const data = useRouteLoaderData<typeof loader>("root");

  return (
    <header className="w-full bg-background border-b-[1px] shadow-lg dark:shadow-neutral-950 dark:border-zinc-900 fixed z-10">
      <nav className="max-w-5xl mx-auto p-4 flex items-center">
        <Link to="/">
          <h3 className="text-2xl font-bold text-nowrap">RoadMap It.</h3>
        </Link>
        <div className="ml-auto flex items-center gap-x-2">
          <ModeToggle />
          {data?.user && (
            <Button
              className="relative rounded-full overflow-hidden w-10 h-10 bg-background hover:bg-background"
              onClick={() =>
                logOut.submit(null, {
                  method: "post",
                  action: "/component/header",
                })
              }
            >
              <img
                className="absolute object-cover w-12 h-12"
                src={data.user.image || undefined}
                alt="Log out"
                referrerPolicy="no-referrer"
              />
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
