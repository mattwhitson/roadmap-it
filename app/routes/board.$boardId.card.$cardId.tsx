import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useNavigate, useParams } from "@remix-run/react";
import { db } from "db";
import {
  activitiesTable,
  ActivityWIthDateAsStringAndUser,
  attachmentsTable,
  boardsTable,
  boardsToUsers,
  cardsTable,
  listsTable,
  usersTable,
} from "db/schema";
import { and, count, eq, sql } from "drizzle-orm";
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
import { useState } from "react";

import { useBoardContext } from "@/components/providers/board-provider";
import { DescriptionComponent } from "./component.description";
import { AttachmentComponent } from "./component.attachment";

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

export default function CardPage() {
  const data = useLoaderData<typeof loader>();
  const [isOpen, setIsOpen] = useState(true);

  const { boardData } = useBoardContext();

  const navigate = useNavigate();
  const params = useParams();
  const card = data?.card;
  const list = data?.list;

  function onClickOutside() {
    setIsOpen(false);
    setTimeout(
      () => navigate(`/board/${params.boardId}`, { replace: true }),
      150
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
                boardData={boardData}
                attachments={data?.attachments}
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
                <Button className="w-full" variant="destructive">
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
