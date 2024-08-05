import { ActionFunctionArgs } from "@remix-run/node";
import { json, useFetcher, useParams } from "@remix-run/react";

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
import { db } from "db";
import { listsTable } from "db/schema";
import { authenticator } from "~/services.auth.server";
import { useEffect } from "react";
import { useRevalidate } from "@/hooks/use-revalidate";
import { DefaultEventsMap } from "node_modules/socket.io/dist/typed-events";
import { Server } from "socket.io";
import { toast } from "sonner";

const newListSchema = z.object({
  name: z.string().min(1).max(256),
});

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const io = context.io as Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    unknown
  >;

  const formData = await request.json();
  const jsonData = newListSchema.safeParse(formData.values);

  if (!jsonData.success) {
    return json({ message: "Something went wrong...", ok: false });
  }

  const name = jsonData.data.name;
  const boardId = formData.boardId;
  const listCount = formData.listCount;

  if (!boardId || typeof listCount !== "number") {
    return json({ message: "Something went wrong", ok: false });
  }

  let newList;
  try {
    // TODO: make sure user is member of board and add activity
    newList = await db
      .insert(listsTable)
      .values({
        boardId: boardId,
        createdBy: user.id,
        name: name,
        position: listCount,
      })
      .returning();
  } catch (error) {
    console.error(error);
    return json({ message: "Database erorr", ok: false });
  }

  if (newList?.[0]) {
    io.emit(boardId, {
      type: "AddList",
      newList: {
        list: newList[0],
        cards: [],
        id: newList[0].id,
      },
    });
  }
  return json({ message: "List successfully created!", ok: true });
}

export function AddListModal() {
  const { isOpen, onClose, type, data } = useModalStore();
  const addList = useFetcher<typeof action>();
  const params = useParams();
  const revalidator = useRevalidate(`/board/${params.boardId}`);

  const form = useForm<z.infer<typeof newListSchema>>({
    resolver: zodResolver(newListSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(values: z.infer<typeof newListSchema>) {
    if (
      !params.boardId ||
      (!data?.listCount && typeof data?.listCount !== "number")
    )
      return;
    addList.submit(
      { values, boardId: params.boardId, listCount: data?.listCount },
      {
        method: "post",
        encType: "application/json",
        action: "/modal/add-list",
      }
    );
  }

  useEffect(() => {
    if (!addList.data) return;
    toast(addList.data.message);
    if (addList.data.ok) {
      onClose();
    }
    //setTimeout(() => revalidator(), 1000);
  }, [addList.data, revalidator, onClose]);

  const isModalOpen = isOpen && type === ModalTypes.AddList;
  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Add a list</DialogTitle>
          <DialogDescription>Add a new list to this board.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Board name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Upcoming"
                      {...field}
                      className="text-base sm:text-sm"
                    />
                  </FormControl>
                  <FormDescription className="sr-only">
                    Enter your list name
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
