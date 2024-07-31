import { z } from "zod";

import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  json,
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
import { ActivityIcon, FolderIcon, NotebookTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { useBoardContext } from "@/components/providers/board-provider";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const { boardId, cardId } = params;
  if (!boardId || !cardId) {
    return null; //TODO : throw to error page
  }

  let cardsWithActivities, list;
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
  };
}

const newDescriptionSchema = z.object({
  description: z.string().max(256),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const formData = newDescriptionSchema.safeParse(jsonData.values);

  if (!formData.success) {
    return json({ message: "Something went wrong.", ok: false });
  }

  const cardId = jsonData.cardId;
  if (!cardId) {
    return json({ message: "Something went wrong.", ok: false });
  }

  //TODO: Make sure user is authorized to do this
  try {
    await db
      .update(cardsTable)
      .set({
        description: formData.data.description,
      })
      .where(eq(cardsTable.id, cardId));

    await db.insert(activitiesTable).values({
      cardId: cardId,
      description: "updated the description",
      userId: user.id,
      userName: user.name || "",
    });
  } catch (error) {
    console.error(error);
    return json({ message: "Database error.", ok: false });
  }

  return json({ message: "Description successfully changed!", ok: true });
}

export default function CardPage() {
  const data = useLoaderData<typeof loader>();
  const editDescription = useFetcher<typeof action>();
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(data?.card.description || "");

  const { boardData } = useBoardContext();

  const navigate = useNavigate();
  const params = useParams();
  const card = data?.card;
  const list = data?.list;
  // console.log(card?.activities);
  useEffect(() => {
    if (!editDescription.data) return;
    console.log(editDescription.data);
    //TODO: Add toast bruh
    // TODO: if update failed for whatever reason, roll back description
  }, [editDescription.data]);

  useEffect(() => {
    setDescription(data?.card.description || "");
  }, [data?.card.description]);

  function onClickOutside() {
    setIsOpen(false);
    setTimeout(
      () => navigate(`/board/${params.boardId}`, { replace: true }),
      150
    );
  }

  function onDescriptionEditSubmit(
    values: z.infer<typeof newDescriptionSchema>
  ) {
    setError(null);
    if (!isEditing) return;
    if (!params.cardId) return;

    if (description === data?.card.description) {
      setError("Description hasn't changed!");
      return;
    }

    if (description.length > 256) {
      setError("Description cannot be longer than 256 characters");
      return;
    }

    editDescription.submit(
      { values, cardId: params.cardId },
      {
        method: "post",
        encType: "application/json",
      }
    );
    setIsEditing(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClickOutside}>
      <DialogContent
        onInteractOutside={onClickOutside}
        className="rounded-md w-[95%] sm:max-w-3xl"
      >
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
        <div className="flex flex-col sm:flex-row sm:gap-x-12 justify-between">
          <section className="flex flex-col space-y-10 w-full">
            <article>
              <div className="flex items-end">
                <div className="w-full">
                  <div className="flex gap-x-4 items-center">
                    <NotebookTextIcon className="min-w-6 min-h-6" />
                    <h4 className="text-lg font-semibold">Description</h4>
                  </div>
                  {!isEditing ? (
                    <p className="ml-10 text-sm text-muted-foreground">
                      {editDescription.state !== "idle"
                        ? description
                        : card?.description}
                    </p>
                  ) : (
                    <AutosizeTextarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full mt-2"
                    />
                  )}
                  {error && (
                    <p className="text-destructive text-sm ml-2">{error}</p>
                  )}
                </div>
                {boardData.isMemberOfBoard && (
                  <Button
                    onClick={() => {
                      setError(null);
                      setIsEditing((prev) => !prev);
                      setDescription(data?.card.description || "");
                    }}
                    className="ml-4"
                    variant="secondary"
                  >
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                )}
              </div>
            </article>
            <article>
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
                          className="relative rounded-full overflow-hidden w-7 h-7 bg-background hover:bg-background mr-2"
                        >
                          <img
                            className="absolute object-cover w-7 h-7"
                            src={activity.user.image || undefined}
                            alt="Log out"
                            referrerPolicy="no-referrer"
                          />
                        </Link>
                        <p className="text-sm text-muted-foreground text-nowrap overflow-ellipsis">
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
            </article>
          </section>
          <section className="mt-10 flex flex-col justify-end items-end space-y-2">
            {boardData.isMemberOfBoard && (
              <>
                <Button className="w-full" variant="destructive">
                  Delete Card
                </Button>
                <Button
                  className="w-full"
                  onClick={() => onDescriptionEditSubmit({ description })}
                >
                  Save Changes
                </Button>
              </>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
