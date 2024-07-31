import { z } from "zod";

import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
} from "@remix-run/react";
import { db } from "db";
import { boardsTable, boardsToUsers, User, usersTable } from "db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { authenticator } from "~/services.auth.server";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderIcon, NotebookTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { useBoardContext } from "@/components/providers/board-provider";
import { Input } from "@/components/ui/input";

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

const newDescriptionSchema = z.object({
  description: z.string().max(256),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  return null;
}

export default function CardPage() {
  const data = useLoaderData<typeof loader>();
  const editBoardInfo = useFetcher<typeof action>();
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(data?.board.description || "");
  const [name, setName] = useState(data?.board.name || "");

  const { boardData } = useBoardContext();

  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    if (!editBoardInfo.data) return;
    console.log(editBoardInfo.data);
    //TODO: Add toast bruh
    // TODO: if update failed for whatever reason, roll back description
  }, [editBoardInfo.data]);

  useEffect(() => {
    setDescription(data?.board.description || "");
  }, [data?.board.description]);

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

    if (description === data?.board.description) {
      setError("Description hasn't changed!");
      return;
    }

    if (description.length > 256) {
      setError("Description cannot be longer than 256 characters");
      return;
    }

    editBoardInfo.submit(
      { values, cardId: params.cardId },
      {
        method: "post",
        encType: "application/json",
      }
    );
    setIsEditing(false);
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
                {!isEditing && (
                  <DialogTitle className="text-xl font-bold w-full">
                    {board?.name}
                  </DialogTitle>
                )}
                {isEditing && (
                  <Input
                    className="text-base sm:text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}
              </div>
              <DialogDescription className="ml-10 text-start">
                Created by {board?.user?.name}
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
                          {editBoardInfo.state !== "idle" &&
                          description !== board?.description
                            ? description
                            : board?.description}
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
                  </div>
                </article>
              </section>
            </div>
          </div>
          <section className="mt-10 flex items-center flex-col gap-y-2">
            {boardData.isMemberOfBoard && (
              <>
                <Button
                  className="w-full"
                  onClick={() => {
                    setError(null);
                    setIsEditing((prev) => !prev);
                    setDescription(data?.board.description || "");
                  }}
                  variant="secondary"
                >
                  {isEditing ? "Cancel" : "Edit"}
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
