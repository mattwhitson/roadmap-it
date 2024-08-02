import {
  ActionFunctionArgs,
  json,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import {
  Link,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import { and, count, eq, sql } from "drizzle-orm";

import { db } from "db";
import {
  boardsTable,
  boardsToUsers,
  CardWithDateAsStringAndAttachments,
  listsTable,
  ListWithDateAsString,
  ListWithDateAsStringAndCards,
} from "db/schema";
import { InfoIcon, PlusIcon } from "lucide-react";
import { authenticator } from "~/services.auth.server";
import { Button } from "@/components/ui/button";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { DraggableList } from "~/routes/component.draggable-list";
import { useEffect, useRef, useState } from "react";
import { useBoardContext } from "@/components/providers/board-provider";

import { Input } from "@/components/ui/input";
import { useSocket } from "@/hooks/use-socket";

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

    if (!board[0]) {
      return redirect("/home");
    }

    // don't ask me how i figured this out
    lists = await db.execute(sql`
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

  const finalList: ListWithDateAsStringAndCards[] = [];
  if (lists.rows.length > 0) {
    for (const row of lists.rows) {
      finalList.push({
        id: row.id as string,
        cards: (row.cards || []) as CardWithDateAsStringAndAttachments[],
        list: {
          id: row.id,
          createdAt: row.created_at,
          createdBy: row.created_by,
          name: row.name,
          position: row.position,
          boardId: row.boardId,
        } as ListWithDateAsString,
      });
    }
  }

  return {
    board: board[0],
    lists: finalList,
    isMember: isUserMemberOfBoard?.[0].count
      ? isUserMemberOfBoard[0].count > 0
      : false,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/home",
  });

  const jsonData = await request.json();
  const { name, boardId } = jsonData;

  if (!boardId || !name || name === "") {
    return json({ message: "Something went wrong.", ok: false });
  }
  if (name.length > 128) {
    return json({
      message: "Board name cannot be longer than 128 characters",
      ok: false,
    });
  }

  try {
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
      // TODO: redirect this to custom page saying uh oh you're not a member
      return json({
        message: "You are not authorized to perform this action",
        ok: false,
      });
    }

    await db
      .update(boardsTable)
      .set({ name: name })
      .where(eq(boardsTable.id, boardId));
  } catch (error) {
    console.error(error);
    return json({ message: "Database error", ok: false });
  }
  return json({ message: "List title successfully changed!", ok: true });
}

export default function BoardPage() {
  const editBoardName = useFetcher<typeof action>();
  const data = useLoaderData<typeof loader>();
  const { onOpen } = useModalStore();
  const navigate = useNavigate();
  const params = useParams();

  const boardData = data?.board;

  if (boardData === undefined || boardData.board === undefined) {
    navigate("/home");
  }

  const listsData = data?.lists;
  const isMemberOfBoard = data?.isMember;
  const { board } = boardData!;

  const [boardName, setBoardName] = useState(board.name);
  const [isEditing, setIsEditing] = useState(false);
  const [inputWidth, setInputWidth] = useState<number | null>(null);

  const headerRef = useRef<HTMLDivElement>(null);
  const inputDivRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [listsState, setListsState] = useState(listsData || []);
  const { setBoardData } = useBoardContext();

  useSocket({
    queryKey: board.id,
    route: `/board/${params.boardId}`,
    setListState: setListsState,
  });

  useEffect(() => {
    setBoardData({ isMemberOfBoard: isMemberOfBoard || false });
  }, [isMemberOfBoard, setBoardData]);

  useEffect(() => {
    setListsState(listsData || []);
  }, [listsData]);

  useEffect(() => {
    const detectClickOutsideElement = (e: MouseEvent) => {
      if (headerRef.current && headerRef.current.contains(e.target as Node)) {
        setBoardName(board.name);
        setIsEditing(true);
      } else if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        inputRef.current !== document.activeElement
      ) {
        setIsEditing(false);
        setBoardName(board.name);
        setInputWidth(null);
      }
    };

    window.addEventListener("click", detectClickOutsideElement);

    return () => {
      window.removeEventListener("click", detectClickOutsideElement);
    };
  }, [board]);

  useEffect(() => {
    if (!editBoardName.data) return;
    console.log(editBoardName.data);
    // TODO: add toast bruh
    // also show toasts for errors
  }, [editBoardName.data]);

  function getTextWidth() {
    if (inputDivRef.current && inputRef.current) {
      inputDivRef.current.innerText = boardName;

      if (inputDivRef.current.clientWidth > inputRef.current.clientWidth) {
        setInputWidth(inputDivRef.current.clientWidth);
      }
    }
  }

  function handleNameUpdate() {
    if (boardName === board.name) return;
    if (boardName === "") return; // TODO maybe show toast here
    if (!params.boardId) return;

    editBoardName.submit(
      { name: boardName, boardId: params.boardId },
      {
        method: "post",
        encType: "application/json",
      }
    );

    setIsEditing(false);
  }

  return (
    <>
      <div className="w-full pt-[4.5rem] h-[calc(100%-4rem)]">
        <div className="px-4 backdrop-blur-sm flex items-center overflow-hidden">
          {!isEditing && (
            <div ref={headerRef} className="py-4">
              <h1 className="text-2xl font-semibold text-nowrap">
                {editBoardName.state !== "idle" ? boardName : board.name}
              </h1>
            </div>
          )}
          {isEditing && (
            <>
              <div
                ref={inputDivRef}
                className="invisible w-auto inline-block fixed overflow-auto text-2xl font-semibold px-2"
              ></div>
              <Input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                ref={inputRef}
                className="h-8 focus-visible:ring-offset-0 text-2xl font-semibold p-0 mt-4 mr-1 w-fit max-w-full mb-4"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleNameUpdate();
                  }
                  getTextWidth();
                }}
                style={{
                  width: inputWidth ? `${inputWidth}px` : "content-fit",
                }}
              />
            </>
          )}
          <Link to={`/board/${board.id}/edit`}>
            <Button variant="ghost" asChild className="h-8 w-8 p-1 ml-2">
              <InfoIcon />
            </Button>
          </Link>
          <p className="mx-4 py-4 sm:ml-8 overflow-hidden text-ellipsis text-nowrap">
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
