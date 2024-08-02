import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { ActionFunctionArgs } from "@remix-run/node";
import { json, useFetcher, useParams } from "@remix-run/react";
import { db } from "db";
import { boardsToUsers, listsTable } from "db/schema";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { DefaultEventsMap } from "node_modules/socket.io/dist/typed-events";
import { useEffect } from "react";
import { Server } from "socket.io";
import { authenticator } from "~/services.auth.server";

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const { listId, boardId } = jsonData;

  if (typeof boardId !== "string" || typeof listId !== "string") {
    return json({ message: "Something went wrong", ok: false });
  }

  let deletedPosition;
  try {
    //TODO: if we add admins, make sure they admin
    const isUserMemberOfBoard = await db
      .select({ count: count() })
      .from(boardsToUsers)
      .where(
        and(
          eq(boardsToUsers.boardId, boardId),
          eq(boardsToUsers.userId, user.id)
        )
      );

    if (isUserMemberOfBoard[0].count === 0) {
      // TODO: tell them they don't have permission
      return null;
    }

    const deletedList = await db
      .delete(listsTable)
      .where(eq(listsTable.id, listId))
      .returning();
    deletedPosition = deletedList[0].position;

    await db
      .update(listsTable)
      .set({
        position: sql`${listsTable.position} - 1`,
      })
      .where(
        and(
          gt(listsTable.position, deletedPosition),
          eq(listsTable.boardId, boardId)
        )
      );
  } catch (error) {
    console.error(error);
    return json({ message: "Database error.", ok: false });
  }

  const io = context.io as Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    unknown
  >;

  io.emit(boardId, {
    type: "DeleteList",
    listId,
    deletedPosition,
  });
  return json({ message: "List successfully deleted!", ok: true });
}

export function ListDropdown({
  icon,
  triggerClassName = "",
  cardsListLength,
  listId,
  listName,
}: {
  icon: JSX.Element;
  triggerClassName?: string;
  cardsListLength: number;
  listId: string;
  listName: string;
}) {
  const params = useParams();
  const deleteList = useFetcher<typeof action>();
  const { onOpen } = useModalStore();

  useEffect(() => {
    if (!deleteList.data) return;
    console.log(deleteList.data);
    // TODO: ADD TOAST ON SUCCESS/ERROR
  }, [deleteList.data]);

  function handleListDelete() {
    if (!params.boardId) return;
    deleteList.submit(
      { boardId: params.boardId, listId },
      {
        method: "post",
        action: "/component/list/dropdown",
        encType: "application/json",
      }
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="hover:cursor-pointer"
          onClick={() =>
            onOpen(ModalTypes.AddCard, { listId, cardsListLength, listName })
          }
        >
          Add card
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleListDelete}>
          Delete List
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
