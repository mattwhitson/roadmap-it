import { z } from "zod";

import { AutosizeTextarea } from "@/components/ui/autosize-text-area";
import { Button } from "@/components/ui/button";
import {
  ClientActionFunctionArgs,
  json,
  useFetcher,
  useParams,
} from "@remix-run/react";
import { db } from "db";
import {
  activitiesTable,
  ActivityWIthDateAsStringAndUser,
  boardsTable,
  BoardWithDateAsStringAndUser,
  cardsTable,
  CardWithDateAsString,
} from "db/schema";
import { eq } from "drizzle-orm";
import { NotebookTextIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { authenticator } from "~/services.auth.server";
import { BoardData } from "@/components/providers/board-provider";

const newDescriptionSchema = z.object({
  description: z.string().max(256),
});

export async function action({ request }: ClientActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const formData = newDescriptionSchema.safeParse(jsonData.values);

  if (!formData.success) {
    return json({ message: "Something went wrong.", ok: false });
  }

  if (jsonData.type === "Card") {
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
  } else if (jsonData.type === "Board") {
    const boardId = jsonData.boardId;

    if (!boardId) {
      return json({ message: "Something went wrong.", ok: false });
    }

    try {
      await db
        .update(boardsTable)
        .set({
          description: formData.data.description,
        })
        .where(eq(boardsTable.id, boardId));

      // TODO: Add activites for boards?
      // await db.insert(activitiesTable).values({
      //   cardId: cardId,
      //   description: "updated the description",
      //   userId: user.id,
      //   userName: user.name || "",
      // });
    } catch (error) {
      console.error(error);
      return json({ message: "Database error.", ok: false });
    }
  }
}

export type DataType =
  | (Omit<CardWithDateAsString, "createdAt" | "createdBy" | "position"> & {
      activities: ActivityWIthDateAsStringAndUser[];
    })
  | undefined;

export function DescriptionComponent({
  card,
  board,
  boardData,
}: {
  card?: DataType;
  board?: BoardWithDateAsStringAndUser | undefined;
  boardData: BoardData;
}) {
  const editDescription = useFetcher<typeof action>();
  const params = useParams();

  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(
    card?.description || board?.description || ""
  );

  const data = card || board;

  useEffect(() => {
    if (!editDescription.data) return;
    console.log(editDescription.data);
    //TODO: Add toast bruh
    // TODO: if update failed for whatever reason, roll back description
  }, [editDescription.data]);

  useEffect(() => {
    setDescription(data?.description || "");
  }, [data?.description]);

  function onDescriptionEditSubmit(
    values: z.infer<typeof newDescriptionSchema>
  ) {
    setError(null);
    if (!isEditingDescription) return;
    if (!params.cardId) return;

    if (description === card?.description) {
      setError("Description hasn't changed!");
      return;
    }

    if (description.length > 256) {
      setError("Description cannot be longer than 256 characters");
      return;
    }

    if (card) {
      editDescription.submit(
        { values, cardId: params.cardId, type: "Card" },
        {
          method: "post",
          encType: "application/json",
          action: "/component/description",
        }
      );
      setIsEditingDescription(false);
    }
  }
  return (
    <article>
      <div className="flex items-end">
        <div className="w-full">
          <div className="flex gap-x-4 items-center">
            <NotebookTextIcon className="min-w-6 min-h-6" />
            <h4 className="text-lg font-semibold">Description</h4>
            {boardData.isMemberOfBoard && (
              <Button
                onClick={() => {
                  setError(null);
                  setIsEditingDescription((prev) => !prev);
                  setDescription(data?.description || "");
                }}
                className="ml-auto h-8 w-12"
                variant="secondary"
                style={{
                  width: isEditingDescription ? "4rem" : "",
                }}
              >
                {isEditingDescription ? "Cancel" : "Edit"}
              </Button>
            )}
          </div>
          {!isEditingDescription ? (
            <p className="ml-10 text-sm text-muted-foreground">
              {editDescription.state !== "idle"
                ? description
                : data?.description}
            </p>
          ) : (
            <>
              <AutosizeTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-2"
              />
              <Button
                className="w-12 h-8 mt-2"
                variant="secondary"
                onClick={() => onDescriptionEditSubmit({ description })}
              >
                Save
              </Button>
            </>
          )}
          {error && <p className="text-destructive text-sm ml-2">{error}</p>}
        </div>
      </div>
    </article>
  );
}
