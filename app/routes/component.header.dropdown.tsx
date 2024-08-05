import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { RequestWithDateAsString } from "db/schema";
import { useEffect } from "react";
import { authenticator } from "~/services.auth.server";

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.logout(request, { redirectTo: "/" });
  return null;
}

export function HeaderDropdown({
  icon,
  triggerClassName,
  invitations,
}: {
  icon: React.ReactNode;
  triggerClassName?: string;
  invitations: RequestWithDateAsString[];
}) {
  const { updateInvitations, onOpen } = useModalStore();
  const logOut = useFetcher<typeof action>();

  useEffect(() => {
    updateInvitations(invitations);
  }, [invitations, updateInvitations]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="hover:cursor-pointer"
          onClick={() => onOpen(ModalTypes.Invitations, { invitations })}
        >
          Board Invitations{" "}
          <span className="ml-3 bg-sky-500 h-4 w-4 rounded-full text-center text-xs">
            {invitations.length}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            logOut.submit(null, {
              method: "post",
              action: "/component/header/dropdown",
            })
          }
        >
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
