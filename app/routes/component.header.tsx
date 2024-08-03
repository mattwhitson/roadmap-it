import { Link, useFetcher, useRouteLoaderData } from "@remix-run/react";
import { ModeToggle } from "@/components/theme-toggle";
import { loader as RootLoader } from "~/root";
import { HeaderDropdown } from "./component.header.dropdown";
import { LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services.auth.server";
import { db } from "db";
import { requestsTable, RequestWithDateAsString } from "db/schema";
import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/use-socket";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  let invitations;
  try {
    invitations = await db
      .select()
      .from(requestsTable)
      .where(eq(requestsTable.requesteeId, user.id));
  } catch (error) {
    console.error(error);
    return null;
  }
  console.log(invitations);
  return {
    invitations,
  };
}

export function Header() {
  const data = useRouteLoaderData<typeof RootLoader>("root");
  const [invitations, setInvitations] = useState<RequestWithDateAsString[]>([]);
  const invitationsData = useFetcher<typeof loader>();

  useSocket({ queryKey: data?.user?.id, setInvitationsState: setInvitations });

  useEffect(() => {
    if (invitationsData.state === "idle" && !invitationsData.data) {
      invitationsData.load("/component/header");
    }
  }, [invitationsData]);

  useEffect(() => {
    if (!invitationsData.data) return;
    setInvitations(
      (invitationsData.data.invitations as RequestWithDateAsString[]) || []
    );
  }, [invitationsData.data]);

  return (
    <header className="w-full bg-background border-b-[1px] shadow-lg dark:shadow-neutral-950 dark:border-zinc-900 fixed z-10">
      <nav className="p-4 flex items-center">
        <Link to="/">
          <h3 className="text-2xl font-bold text-nowrap">RoadMap It.</h3>
        </Link>
        <div className="ml-auto flex items-center gap-x-2 relative">
          <ModeToggle />
          {data?.user && (
            <HeaderDropdown
              invitations={invitations}
              triggerClassName="relative rounded-full overflow-hidden w-10 h-10 bg-background hover:bg-background"
              icon={
                <img
                  className="object-cover w-10 h-10"
                  src={data.user.image || undefined}
                  alt="Log out"
                  referrerPolicy="no-referrer"
                />
              }
            />
          )}
          {data?.user && invitations.length > 0 && (
            <span className="absolute top-0 right-0 w-3 h-3 text-xs flex flex-col justify-center items-center rounded-full bg-cyan-500">
              {invitations.length}
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
