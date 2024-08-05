import { ActionFunctionArgs, json } from "@remix-run/node";
import { useFetcher, useParams } from "@remix-run/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { authenticator } from "~/services.auth.server";
import {
  boardsTable,
  boardsToUsers,
  requestsTable,
  usersTable,
} from "db/schema";
import { db } from "db";
import { and, count, eq } from "drizzle-orm";
import { Server } from "socket.io";
import { DefaultEventsMap } from "node_modules/socket.io/dist/typed-events";
import { useEffect } from "react";
import { toast } from "sonner";

const inviteSchema = z.object({
  email: z.string().email({ message: "Must be a valid email" }),
});

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (!user) return null;
  const jsonData = await request.json();
  const parsedData = inviteSchema.safeParse(jsonData.values);

  if (!parsedData.success) {
    return json({ message: "Something went wrong", ok: false });
  }

  const { boardId } = jsonData;
  const { email } = parsedData.data;

  if (!boardId) {
    return json({ message: "Something went wrong", ok: false });
  }

  let requestee, invitation;
  try {
    const board = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.id, boardId));

    if (!board) {
      return null; //TODO: throw to error page
    }

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
        message: "Unauthorized to perform this action",
        ok: false,
      });
    }

    requestee = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!requestee[0]) {
      return json({ message: "User does not exist", ok: false });
    }

    const isRequesteeMemberOfBoard = await db
      .select({ count: count() })
      .from(boardsToUsers)
      .where(
        and(
          eq(boardsToUsers.boardId, boardId),
          eq(boardsToUsers.userId, requestee[0].id)
        )
      );
    if (isRequesteeMemberOfBoard[0].count > 0) {
      return json({
        message: "User is already a member of this board!",
        ok: false,
      });
    }

    const requestAlreadyExists = await db
      .select({ count: count() })
      .from(requestsTable)
      .where(
        and(
          eq(requestsTable.boardId, boardId),
          eq(requestsTable.requesteeId, requestee[0].id)
        )
      );

    if (requestAlreadyExists[0].count > 0) {
      return json({
        message: "User has already been invited to this board!",
        ok: false,
      });
    }

    invitation = await db.insert(requestsTable).values({
      boardId: boardId,
      requesteeId: requestee[0].id,
      requesterId: user.id,
    });
  } catch (error) {
    console.error(error);
    return json({ message: "Database error", ok: false });
  }

  // TODO add socket
  const io = context.io as Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    unknown
  >;
  io.emit(requestee[0].id, {
    invitation,
  });
  return json({ message: "Request successfully sent!", ok: true });
}
export function InviteUserModal() {
  const inviteFetcher = useFetcher<typeof action>();
  const { type, onClose, isOpen } = useModalStore();
  const params = useParams();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (!inviteFetcher.data) return;
    toast(inviteFetcher.data.message);
    if (inviteFetcher.data.ok) {
      form.reset();
      onClose();
    }
  }, [inviteFetcher.data, form, onClose]);

  function onSubmit(values: z.infer<typeof inviteSchema>) {
    if (!params.boardId) return;

    inviteFetcher.submit(
      { values: values, boardId: params.boardId },
      {
        method: "post",
        action: "/modal/invite-user",
        encType: "application/json",
      }
    );
  }

  const isModalOpen = isOpen && type === ModalTypes.InviteUser;

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-start">
            Invite a user
          </DialogTitle>
          <DialogDescription className="text-start">
            Invite a user to become a board member by entering their email
            below! Please note that this will give them full board priviledges!
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="johnORjanedoe@email.com" {...field} />
                  </FormControl>
                  <FormDescription className="sr-only">
                    Enter email of user to invite to be member of board
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
