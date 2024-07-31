import { json, useFetcher, useParams } from "@remix-run/react";
import { ActionFunctionArgs } from "@remix-run/node";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { Input } from "@/components/ui/input";
import { authenticator } from "~/services.auth.server";
import { db } from "db";
import { activitiesTable, boardsToUsers, cardsTable } from "db/schema";
import { useEffect } from "react";
import { and, count, eq } from "drizzle-orm";

const newCardSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(256),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  const formData = await request.json();
  const jsonData = newCardSchema.safeParse(formData.values);

  if (!jsonData.success) {
    return json({ message: "Something went wrong...", ok: false });
  }
  const data = jsonData.data;
  const listId = formData.listId;
  const cardsListLength = formData.cardsListLength;
  const boardId = formData.boardId;
  const listName = formData.listName;

  if (!listId || typeof cardsListLength !== "number") {
    return json({ message: "Something went wrong", ok: false });
  }

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

    const newCard = await db
      .insert(cardsTable)
      .values({
        listId: listId,
        name: data.name,
        description: data.description,
        position: cardsListLength,
      })
      .returning();

    await db.insert(activitiesTable).values({
      cardId: newCard[0].id,
      description: `added this card to ${listName}`,
      userId: user.id,
      userName: user.name || "",
    });
  } catch (error) {
    console.error(error);
    json({ message: "Database error", ok: false });
  }

  return json({ message: "Card successfully added!", ok: true });
}

export function AddCardModal() {
  const params = useParams();
  const { isOpen, onClose, type, data } = useModalStore();
  const createCard = useFetcher<typeof action>();
  const form = useForm<z.infer<typeof newCardSchema>>({
    resolver: zodResolver(newCardSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof newCardSchema>) {
    if (
      !data?.listId ||
      !data.listName ||
      !params.boardId ||
      data?.cardsListLength === undefined
    )
      return;

    createCard.submit(
      {
        values,
        boardId: params.boardId,
        listId: data.listId,
        cardsListLength: data.cardsListLength,
        listName: data.listName,
      },
      { method: "post", action: "/modal/add-card", encType: "application/json" }
    );
    form.reset();
  }

  useEffect(() => {
    if (!createCard.data) return;
    console.log(createCard.data);
    if (createCard.data.ok) {
      onClose();
    }
  }, [createCard.data, onClose]);

  const isModalOpen = isOpen && type === ModalTypes.AddCard;
  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Add a Card</DialogTitle>
          <DialogDescription>Add a new card to this list.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Rework payment system"
                      {...field}
                      className="text-base sm:text-sm"
                    />
                  </FormControl>
                  <FormDescription className="sr-only">
                    Enter your card name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="We are going to switch over to stripe"
                      {...field}
                      className="text-base sm:text-sm"
                    />
                  </FormControl>
                  <FormDescription className="sr-only">
                    Enter your card description
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
