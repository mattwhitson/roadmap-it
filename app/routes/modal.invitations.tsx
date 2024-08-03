import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";
import { LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { db } from "db";
import { boardsTable, requestsTable, User, usersTable } from "db/schema";
import { eq, sql } from "drizzle-orm";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { authenticator } from "~/services.auth.server";

type LimitedBoard = {
  id: string;
  name: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  try {
    const requests = await db
      .select({
        id: requestsTable.id,
        board: sql<LimitedBoard[]>`jsonb_agg(jsonb_build_object(
            'id', ${boardsTable.id}, 'name', ${boardsTable.name}))`,
        user: sql<User[]>`jsonb_agg(jsonb_build_object(
            'id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'image', ${usersTable.image}))`,
      })
      .from(requestsTable)
      .leftJoin(usersTable, eq(usersTable.id, requestsTable.requesterId))
      .leftJoin(boardsTable, eq(boardsTable.id, requestsTable.boardId))
      .where(eq(requestsTable.requesteeId, user.id))
      .groupBy(requestsTable.id);
    console.log(requests);
    return {
      requests,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

type Invitations = {
  id: string;
  user: User[];
  board: LimitedBoard[];
};

export function InvitationsModal() {
  const fetchInviteData = useFetcher<typeof loader>();
  const { isOpen, type, onClose, data } = useModalStore();
  const invitationsData = data?.invitations;
  const [invitationsUpdated, setInvitationsUpdated] = useState(false);
  const [invitations, setInvitations] = useState<Invitations[]>([]);

  useEffect(() => {
    if (!invitationsUpdated) return;

    fetchInviteData.load("/modal/invitations");
    setInvitationsUpdated(false);
  }, [fetchInviteData, invitationsUpdated]);

  useEffect(() => {
    setInvitationsUpdated(true);
  }, [invitationsData]);

  useEffect(() => {
    if (!fetchInviteData.data) return;
    setInvitations(fetchInviteData.data.requests);
  }, [fetchInviteData.data]);

  const isModalOpen = isOpen && type === ModalTypes.Invitations;
  if (!isModalOpen) return null;

  console.log(invitations);

  if (!fetchInviteData.data) {
    return (
      <Dialog open={isModalOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogTitle className="text-xl text-start">Invitations</DialogTitle>
          <DialogDescription className="sr-only">
            Loading symbol
          </DialogDescription>
          <div className="flex flex-col justify-center items-center">
            <Loader2 className="animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  console.log;
  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl text-start">Invitations</DialogTitle>
          <DialogDescription className="text-start">
            You have received inviations to these boards!
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
