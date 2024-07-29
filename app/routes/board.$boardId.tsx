import { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { and, count, eq, sql } from "drizzle-orm";

import { db } from "db";
import {
  boardsTable,
  boardsToUsers,
  cardsTable,
  CardWithDateAsString,
  listsTable,
} from "db/schema";
import { PlusIcon } from "lucide-react";
import { authenticator } from "~/services.auth.server";
import { Button } from "@/components/ui/button";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { DraggableList } from "~/routes/component.draggable-list";
import { useEffect, useState } from "react";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const boardId = params.boardId;

  if (typeof boardId !== "string") {
    // TODO: redirect to error page
    return null;
  }

  let board, isUserMemberOfBoard, lists;
  try {
    board = await db
      .select({
        board: boardsTable,
      })
      .from(boardsTable)
      .leftJoin(listsTable, eq(listsTable.boardId, boardId))
      .where(eq(boardsTable.id, boardId));

    lists = await db
      .select({
        list: listsTable,
        cards: sql<
          CardWithDateAsString[]
        >`json_agg(json_build_object('id', ${cardsTable.id}, 'name', ${cardsTable.name},
            'description', ${cardsTable.description})) FILTER (WHERE ${cardsTable.id} IS NOT NULL)`,
      })
      .from(listsTable)
      .leftJoin(cardsTable, eq(cardsTable.listId, listsTable.id))
      .where(eq(listsTable.boardId, boardId))
      .groupBy(listsTable.id);

    if (!board[0].board.public) {
      isUserMemberOfBoard = await db
        .select({ count: count() })
        .from(boardsToUsers)
        .where(
          and(
            eq(boardsToUsers.boardId, boardId),
            eq(boardsToUsers.userId, user.id)
          )
        );

      if (isUserMemberOfBoard[0].count === 0) {
        // TODO: redirect this to custom page saying uh oh you're not a member
        return null;
      }
    }
  } catch (error) {
    console.error(error);
    return null;
  }

  for (const list of lists) {
    if (list.cards === null) {
      list.cards = [];
    }
  }

  lists.sort((a, b) => a.list.position - b.list.position);

  return {
    board: board[0],
    lists,
    isMember: isUserMemberOfBoard?.[0].count
      ? isUserMemberOfBoard[0].count > 0
      : false,
  };
}

export default function BoardPage() {
  const data = useLoaderData<typeof loader>();
  const { onOpen } = useModalStore();

  const boardData = data?.board;
  const listsData = data?.lists;
  const isMemberOfBoard = data?.isMember;
  const { board } = boardData!;
  const [listsState, setListsState] = useState(
    listsData?.map((list) => ({ ...list, id: list.list.id })) || []
  );

  useEffect(() => {
    setListsState(
      listsData?.map((list) => ({ ...list, id: list.list.id })) || []
    );
  }, [listsData]);
  console.log(listsState);
  return (
    <>
      <div className="w-full pt-[4.5rem] h-[calc(100%-4rem)]">
        <div className="py-4 px-4 backdrop-blur-sm flex items-center overflow-hidden">
          <h1 className="text-2xl font-semibold text-nowrap">{board.name}</h1>
          <p className="mx-4 sm:ml-8 overflow-hidden text-ellipsis text-nowrap">
            {board.description}
          </p>
          {isMemberOfBoard && (
            <Button
              variant="ghost"
              className="p-1 ml-auto min-w-8 min-h-8 w-8 h-8"
              onClick={() =>
                onOpen(ModalTypes.AddList, { listCount: listsState.length })
              }
            >
              <PlusIcon className="" />
            </Button>
          )}
        </div>
        {listsState && listsState.length ? (
          <DraggableList listWithCards={listsState} setLists={setListsState} />
        ) : null}
      </div>
      <Outlet />
    </>
  );
}
