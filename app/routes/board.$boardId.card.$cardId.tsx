import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import { db } from "db";
import {
  activitiesTable,
  ActivityWIthDateAsStringAndUser,
  attachmentsTable,
  boardsTable,
  boardsToUsers,
  cardsTable,
  CardWithDateAsStringAndActivities,
  listsTable,
  usersTable,
} from "db/schema";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { format } from "date-fns";
import { authenticator } from "~/services.auth.server";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ActivityIcon, FolderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";

import { useBoardContext } from "@/components/providers/board-provider";
import { DescriptionComponent } from "./component.description";
import { AttachmentComponent } from "./component.attachment";
import { deleteCardAttachments } from "@/components/reusable-api-functions";
import { Server } from "socket.io";
import { DefaultEventsMap } from "node_modules/socket.io/dist/typed-events";
import { useSocket } from "@/hooks/use-socket";
import { toast } from "sonner";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const { boardId, cardId } = params;
  if (!boardId || !cardId) {
    return null; //TODO : throw to error page
  }

  let cardsWithActivities, attachments, list;
  try {
    const board = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, boardId));

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

    cardsWithActivities = await db
      .select({
        id: cardsTable.id,
        listId: cardsTable.listId,
        name: cardsTable.name,
        description: cardsTable.description,
        position: cardsTable.position,

        activities: sql<
          ActivityWIthDateAsStringAndUser[]
        >`json_agg(json_build_object('id', ${activitiesTable.id}, 'userName', ${activitiesTable.userName},
            'description', ${activitiesTable.description}, 'createdAt', ${activitiesTable.createdAt}, 'user', ${usersTable}) ORDER BY ${activitiesTable.createdAt} DESC) FILTER (WHERE ${activitiesTable.id} IS NOT NULL)`,
      })
      .from(cardsTable)
      .leftJoin(activitiesTable, eq(activitiesTable.cardId, cardId))
      .leftJoin(usersTable, eq(usersTable.id, activitiesTable.userId))
      .where(eq(cardsTable.id, cardId))
      .groupBy(cardsTable.id);

    attachments = await db
      .select()
      .from(attachmentsTable)
      .where(eq(attachmentsTable.cardId, cardsWithActivities[0].id));

    list = await db
      .select()
      .from(listsTable)
      .where(eq(listsTable.id, cardsWithActivities[0].listId));
  } catch (error) {
    // TODO: throw to error page
    console.log(error);
    return null;
  }
  return {
    card: cardsWithActivities[0],
    list: list[0],
    attachments,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  const jsonData = await request.json();
  const { cardId, boardId, listId, attachmentKeys } = jsonData;

  if (
    typeof cardId !== "string" ||
    typeof boardId !== "string" ||
    typeof listId !== "string" ||
    !attachmentKeys
  ) {
    return json({ message: "Something went wrong...", ok: false });
  }

  let deletedPosition;
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

    deleteCardAttachments(attachmentKeys);

    const deletedCard = await db
      .delete(cardsTable)
      .where(eq(cardsTable.id, cardId))
      .returning();

    deletedPosition = deletedCard[0].position;
    await db
      .update(cardsTable)
      .set({
        position: sql`${cardsTable.position} - 1`,
      })
      .where(
        and(
          gt(cardsTable.position, deletedPosition),
          eq(cardsTable.listId, listId)
        )
      );
  } catch (error) {
    console.error(error);
    return json({ message: "Database error", ok: false });
  }

  const io = context.io as Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    unknown
  >;
  io.emit(boardId, {
    type: "DeleteCard",
    deletedPosition,
    cardId,
    listId,
  });
  return json({ message: "Card successfully deleted", ok: true });
}

export default function CardPage() {
  const data = useLoaderData<typeof loader>();
  const deleteCard = useFetcher<typeof action>();
  const [isOpen, setIsOpen] = useState(true);

  const { boardData } = useBoardContext();

  const navigate = useNavigate();
  const params = useParams();
  const cardData = data?.card;
  const list = data?.list;

  const [card, setCard] = useState(
    cardData || ({} as CardWithDateAsStringAndActivities)
  );
  const [attachments, setAttachments] = useState(data?.attachments || []);

  useSocket({
    queryKey: params.cardId,
    setAttachmentState: setAttachments,
    setCardState: setCard,
  });

  const onClickOutside = useCallback(() => {
    setIsOpen(false);
    setTimeout(
      () => navigate(`/board/${params.boardId}`, { replace: true }),
      150
    );
  }, [navigate, params.boardId]);

  useEffect(() => {
    if (!deleteCard.data) return;
    toast(deleteCard.data.message);
    if (deleteCard.data.ok) {
      onClickOutside();
    }
  }, [deleteCard.data, onClickOutside]);

  function handleDelete() {
    if (!params.cardId || !params.boardId || !list?.id) return null;
    const attachmentKeys = data?.attachments.map(
      (attachment) => attachment.url
    );
    deleteCard.submit(
      {
        cardId: params.cardId,
        boardId: params.boardId,
        listId: list?.id,
        attachmentKeys: attachmentKeys || [],
      },
      {
        method: "delete",
        encType: "application/json",
      }
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClickOutside}>
      <DialogContent
        onInteractOutside={onClickOutside}
        className="rounded-md w-[95%] overflow-y-auto scrollbar-zinc-900 scrollbar-zinc-600 scrollbar-thin h-fit max-h-[80%] sm:max-w-3xl sm:max-h-[75%]"
      >
        <div className="flex flex-col sm:flex-row sm:gap-x-12 justify-between">
          <div className="flex flex-col w-full gap-y-4">
            <DialogHeader className="space-y-0 mb-6 text-start">
              <div className="flex gap-x-4 items-center w-full">
                <FolderIcon className="min-w-6 min-h-6" />
                <DialogTitle className="text-xl font-bold">
                  {card?.name}
                </DialogTitle>
              </div>
              <DialogDescription className="ml-10 text-start">
                in {list?.name}
              </DialogDescription>
            </DialogHeader>
            <section className="flex flex-col space-y-10 w-full">
              <DescriptionComponent card={card} boardData={boardData} />
              <AttachmentComponent
                listId={list?.id}
                boardData={boardData}
                attachments={attachments}
              />

              <section>
                <div className="flex gap-x-4 items-center">
                  <ActivityIcon className="min-w-6 min-h-6" />
                  <h4 className="text-lg font-semibold">Activity</h4>
                </div>
                <div className="flex flex-col mt-4 space-y-2">
                  {card?.activities &&
                    card?.activities.map((activity) => (
                      <article key={activity.id}>
                        <div className="ml-1 flex relative items-center">
                          <Link
                            to={`/user/${activity.user.id}`}
                            className="relative rounded-full overflow-hidden w-7 h-7 min-w-7 min-h-7 bg-background hover:bg-background mr-2"
                          >
                            <img
                              className="absolute object-cover w-7 h-7"
                              src={activity.user.image || undefined}
                              alt="Log out"
                              referrerPolicy="no-referrer"
                            />
                          </Link>
                          <p className="text-sm text-muted-foreground overflow-ellipsis">
                            <em className="not-italic font-semibold">
                              {activity.user.name}
                            </em>{" "}
                            {activity.description}
                          </p>
                        </div>
                        <p className="ml-10 text-xs font-light text-muted-foreground ">
                          {format(
                            new Date(activity.createdAt).getTime() -
                              new Date().getTimezoneOffset() * 60 * 1000,

                            "PPpp"
                          )}
                        </p>
                      </article>
                    ))}
                </div>
              </section>
            </section>
          </div>
          <section className="mt-6 sm:mt-0 flex flex-col justify-end items-end space-y-2">
            {boardData.isMemberOfBoard && (
              <>
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={handleDelete}
                >
                  Delete Card
                </Button>
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
