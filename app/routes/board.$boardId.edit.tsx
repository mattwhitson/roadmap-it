import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import { db } from "db";
import {
  boardsTable,
  boardsToUsers,
  CardWithDateAsStringAndAttachments,
  usersTable,
} from "db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { authenticator } from "~/services.auth.server";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useBoardContext } from "@/components/providers/board-provider";
import { DescriptionComponent } from "./component.description";
import { deleteCardAttachments } from "@/components/reusable-api-functions";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const { boardId } = params;
  if (!boardId) {
    return null; //TODO : throw to error page
  }

  let board;
  try {
    board = await db
      .select({
        id: boardsTable.id,
        name: boardsTable.name,
        createdAt: boardsTable.createdAt,
        description: boardsTable.description,
        public: boardsTable.public,
        user: usersTable,
      })
      .from(boardsTable)
      .leftJoin(usersTable, eq(boardsTable.createdBy, usersTable.id))
      .where(eq(boardsTable.id, boardId))
      .groupBy(boardsTable.id, usersTable.id);

    if (!board) {
      return null; //TODO: throw to error page
    }

    if (!board[0].public) {
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
        return null;
      }
    }
  } catch (error) {
    // TODO: throw to error page
    console.log(error);
    return null;
  }
  return {
    board: board[0],
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const { boardId } = jsonData;

  if (typeof boardId !== "string") {
    return json({ message: "Something went wrong...", ok: false });
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
      return json({
        message: "You don't have permission to perform this action",
        ok: false,
      });
    }

    const lists = await db.execute(sql`
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
          left join (select card_id, jsonb_agg(a) attachment from attachments a GROUP BY card_id) a
            on a.card_id = c.id WHERE l.board_id = ${boardId}
          group by l.id
          ORDER BY l.position ASC
        `);

    const attachmentKeys: string[] = [];
    for (const row of lists.rows) {
      const cards: CardWithDateAsStringAndAttachments[] =
        row.cards as unknown as CardWithDateAsStringAndAttachments[];
      for (const card of cards) {
        if (card.attachment) {
          card.attachment.forEach((attachment) =>
            attachmentKeys.push(attachment.url)
          );
        }
      }
    }

    deleteCardAttachments(attachmentKeys);

    await db.delete(boardsTable).where(eq(boardsTable.id, boardId));
  } catch (error) {
    console.error(error);
    return json({ message: "Database error", ok: false });
  }

  return json({ message: "Board successfully deleted", ok: true });
}

export default function CardPage() {
  const data = useLoaderData<typeof loader>();
  const deleteBoard = useFetcher<typeof action>();
  const [isOpen, setIsOpen] = useState(true);
  const { boardData } = useBoardContext();

  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    if (!deleteBoard.data) return;
    console.log(deleteBoard.data);
    //TODO: Add toast bruh and redirect to home
    // TODO: if update failed for whatever reason, roll back description
  }, [deleteBoard.data]);

  function onClickOutside() {
    setIsOpen(false);
    setTimeout(
      () => navigate(`/board/${params.boardId}`, { replace: true }),
      150
    );
  }

  function handleDelete() {
    if (!params.boardId) return;

    deleteBoard.submit(
      { boardId: params.boardId },
      {
        method: "delete",
        encType: "application/json",
      }
    );
  }

  const board = data?.board;

  return (
    <Dialog open={isOpen} onOpenChange={onClickOutside}>
      <DialogContent
        onInteractOutside={onClickOutside}
        className="rounded-md w-[95%] sm:max-w-3xl"
      >
        <div className="flex flex-col sm:flex-row w-full">
          <div className="flex flex-col w-full">
            <DialogHeader className="space-y-0 mb-6 text-start">
              <div className="flex gap-x-4 items-center w-full">
                <FolderIcon className="min-w-6 min-h-6" />

                <DialogTitle className="text-xl font-bold w-full">
                  {board?.name}
                </DialogTitle>
              </div>
              <DialogDescription className="ml-10 text-start">
                Created by {board?.user?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="sm:mr-12">
              <DescriptionComponent boardData={boardData} board={board} />
            </div>
          </div>
          <section className="mt-10 flex items-center justify-end flex-col gap-y-2">
            {boardData.isMemberOfBoard && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDelete}
              >
                Delete Board
              </Button>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
