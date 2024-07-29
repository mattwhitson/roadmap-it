import { json, useFetcher } from "@remix-run/react";
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
import { cardsTable } from "db/schema";
import { useEffect } from "react";

const newCardSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(256),
});

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  const formData = await request.json();
  const jsonData = newCardSchema.safeParse(formData.values);

  if (!jsonData.success) {
    return json({ message: "Something went wrong...", ok: false });
  }

  const data = jsonData.data;
  const boardId = formData.boardId;

  if (!boardId) {
    return json({ message: "Something went wrong", ok: false });
  }

  try {
    // TODO Add activity and make sure user is member of board
    await db.insert(cardsTable).values({
      listId: boardId,
      name: data.name,
      description: data.description,
    });
  } catch (error) {
    console.error(error);
    json({ message: "Database error", ok: false });
  }

  return json({ message: "Card successfully added!", ok: true });
}

export function AddCardModal() {
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
    console.log(values);
    if (!data?.listId) return;
    createCard.submit(
      { values, boardId: data.listId },
      { method: "post", action: "/modal/add-card", encType: "application/json" }
    );
    form.reset();
  }

  useEffect(() => {
    if (!createCard.data) return;
    //TODO add toast
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
