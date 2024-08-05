import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { db } from "db";
import {
  boardsTable,
  boardsToUsers,
  requestsTable,
  User,
  usersTable,
} from "db/schema";
import { and, eq, sql } from "drizzle-orm";
import { CheckIcon, Loader2, XIcon } from "lucide-react";
import { DefaultEventsMap } from "node_modules/socket.io/dist/typed-events";
import { useEffect, useState } from "react";
import { Server } from "socket.io";
import { authenticator } from "~/services.auth.server";

type LimitedBoard = {
  id: string;
  name: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  try {
    const requests = await db
      .select({
        id: requestsTable.id,
        board: sql<LimitedBoard[]>`jsonb_agg(jsonb_build_object(
            'id', ${boardsTable.id}, 'name', ${boardsTable.name}))`,
        user: sql<User[]>`jsonb_agg(jsonb_build_object(
            'id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'image', ${usersTable.image}))`,
      })
      .from(requestsTable)
      .leftJoin(usersTable, eq(usersTable.id, requestsTable.requesterId))
      .leftJoin(boardsTable, eq(boardsTable.id, requestsTable.boardId))
      .where(eq(requestsTable.requesteeId, user.id))
      .groupBy(requestsTable.id);
    return {
      requests,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const { accepted, boardId } = jsonData;

  if (accepted === undefined || boardId === undefined) {
    return json({ message: "Something went wrong", ok: false });
  }
  console.log(accepted, boardId);
  try {
    await db
      .delete(requestsTable)
      .where(
        and(
          eq(requestsTable.boardId, boardId),
          eq(requestsTable.requesteeId, user.id)
        )
      );

    if (accepted) {
      await db.insert(boardsToUsers).values({
        boardId: boardId,
        userId: user.id,
      });

      const board = await db
        .select({
          id: boardsTable.id,
          name: boardsTable.name,
        })
        .from(boardsTable)
        .where(eq(boardsTable.id, boardId));

      const io = context.io as Server<
        DefaultEventsMap,
        DefaultEventsMap,
        DefaultEventsMap,
        unknown
      >;
      io.emit(user.id, {
        type: "UpdateBoardsList",
        board: {
          name: board[0].name,
          id: board[0].id,
        },
      });
    }

    return json({ message: "You have joined a new board!", ok: true });
  } catch (error) {
    console.error(error);
    return json({ message: "Database error", ok: false });
  }
}

type Invitations = {
  id: string;
  user: User[];
  board: LimitedBoard[];
};

export function InvitationsModal() {
  const fetchInviteData = useFetcher<typeof loader>();
  const responseToRequest = useFetcher<typeof action>();
  const { isOpen, type, onClose, data } = useModalStore();
  const [invitationsUpdated, setInvitationsUpdated] = useState(true);
  const [invitations, setInvitations] = useState<Invitations[] | null>(null);

  useEffect(() => {
    if (!invitationsUpdated) return;

    fetchInviteData.load("/modal/invitations");
    setInvitationsUpdated(false);
  }, [fetchInviteData, invitationsUpdated]);

  useEffect(() => {
    setInvitationsUpdated(true);
  }, [data?.invitations]);

  useEffect(() => {
    if (!fetchInviteData.data) return;
    setInvitations(fetchInviteData.data.requests);
  }, [fetchInviteData.data]);

  useEffect(() => {
    if (!responseToRequest.data) return;
    console.log(responseToRequest.data); // TODO you know
  }, [responseToRequest]);

  const isModalOpen = isOpen && type === ModalTypes.Invitations;
  if (!isModalOpen) return null;

  if (!invitations) {
    return (
      <Dialog open={isModalOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogTitle className="text-xl text-start">Invitations</DialogTitle>
          <DialogDescription className="sr-only">
            Loading symbol
          </DialogDescription>
          <div className="flex flex-col justify-center items-center">
            <Loader2 className="animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  function handleRequestResponse(accepted: boolean, boardId: string) {
    responseToRequest.submit(
      { accepted, boardId },
      {
        method: "post",
        action: "/modal/invitations",
        encType: "application/json",
      }
    );
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95%] sm:w-full overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl text-start">Invitations</DialogTitle>
          <DialogDescription className="text-start">
            You have received inviations to these boards!
          </DialogDescription>
        </DialogHeader>
        <section className="overflow-hidden flex flex-col gap-y-4">
          {invitations.map((invitation) => (
            <article key={invitation.id} className="flex items-center">
              <div className="flex flex-col space-y-1">
                <p className="not-italic text-xl font-semibold">
                  {invitation.board[0].name}
                </p>
                <div className="flex items-center text-sm">
                  From:{" "}
                  <div className="h-6 w-6 min-h-6 min-w-6 rounded-full overflow-hidden text-sm ml-4">
                    <img
                      src={invitation.user[0].image || undefined}
                      alt="user profile pic"
                    />
                  </div>
                  <p className="font-semibold ml-2 overflow-hidden text-ellipsis">
                    {invitation.user[0].name}
                    <span className="ml-2 italic">
                      {invitation.user[0].email}
                    </span>
                  </p>
                </div>
              </div>
              <div className="ml-auto flex space-x-1">
                <Button
                  variant="ghost"
                  className="p-1 h-6 w-6"
                  onClick={() =>
                    handleRequestResponse(false, invitation.board[0].id)
                  }
                >
                  <XIcon className="min-h-5 h-5 min-w-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  className="p-1 h-6 w-6"
                  onClick={() =>
                    handleRequestResponse(true, invitation.board[0].id)
                  }
                >
                  <CheckIcon className="min-h-5 h-5 min-w-5 w-5" />
                </Button>
              </div>
            </article>
          ))}
        </section>
      </DialogContent>
    </Dialog>
  );
}
