import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "db";
import {
  boardsTable,
  boardsToUsers,
  cardsTable,
  CardWithDateAsString,
  listsTable,
} from "db/schema";
import { InfoIcon, PlusIcon } from "lucide-react";
import { authenticator } from "~/services.auth.server";
import { Button } from "@/components/ui/button";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { DraggableList } from "~/routes/component.draggable-list";
import { useEffect, useState } from "react";
import { useBoardContext } from "@/components/providers/board-provider";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const boardId = params.boardId;

  if (typeof boardId !== "string") {
    // TODO: redirect to error page
    return null;
  }

  let board, isUserMemberOfBoard, lists, attachments;
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
            'description', ${cardsTable.description}, 'position', ${cardsTable.position}) ORDER BY ${cardsTable.position} ASC) FILTER (WHERE ${cardsTable.id} IS NOT NULL)`,
      })
      .from(listsTable)
      .leftJoin(cardsTable, eq(cardsTable.listId, listsTable.id))
      .where(eq(listsTable.boardId, boardId))
      .orderBy(asc(listsTable.position))
      .groupBy(listsTable.id);

    // don't ask me how i figured this out
    attachments = await db.execute(sql`
    select 
        l.*,
        jsonb_agg(jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'position', c.position,
          'attachment', a.attachment) ORDER BY c.position ASC) FILTER(WHERE c.id IS NOT NULL) cards
        from list l
        left join card c
          on c.list_id = l.id
        left join (select card_id, created_at, jsonb_agg(a) attachment from attachments a GROUP BY card_id, a.created_at) a
          on a.card_id = c.id WHERE a IS NULL OR a.created_at = (SELECT MAX(created_at) FROM attachments WHERE attachments.card_id = c.id) AND l.board_id = ${boardId}
        group by l.id
        ORDER BY l.position ASC
        
      `);

    isUserMemberOfBoard = await db
      .select({ count: count() })
      .from(boardsToUsers)
      .where(
        and(
          eq(boardsToUsers.boardId, boardId),
          eq(boardsToUsers.userId, user.id)
        )
      );
    if (!board[0].board.public) {
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

  return {
    board: board[0],
    lists,
    isMember: isUserMemberOfBoard?.[0].count
      ? isUserMemberOfBoard[0].count > 0
      : false,
    attachments,
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
  const { setBoardData } = useBoardContext();

  useEffect(() => {
    setBoardData({ isMemberOfBoard: isMemberOfBoard || false });
  }, [isMemberOfBoard, setBoardData]);

  useEffect(() => {
    setListsState(
      listsData?.map((list) => ({ ...list, id: list.list.id })) || []
    );
  }, [listsData]);
  //console.log(listsState);
  console.log(data?.attachments.rows);
  return (
    <>
      <div className="w-full pt-[4.5rem] h-[calc(100%-4rem)]">
        <div className="py-4 px-4 backdrop-blur-sm flex items-center overflow-hidden">
          <h1 className="text-2xl font-semibold text-nowrap">{board.name}</h1>
          <Link to={`/board/${board.id}/edit`}>
            <Button variant="ghost" asChild className="h-8 w-8 p-1 ml-2">
              <InfoIcon />
            </Button>
          </Link>
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
          <DraggableList
            listWithCards={listsState}
            setLists={setListsState}
            isMemberOfBoard={isMemberOfBoard || false}
          />
        ) : null}
      </div>
      <Outlet />
    </>
  );
}
