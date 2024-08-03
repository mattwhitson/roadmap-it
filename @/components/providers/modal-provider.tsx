import { AddCardModal } from "~/routes/modal.add-card";
import { AddListModal } from "~/routes/modal.add-list";
import { InvitationsModal } from "~/routes/modal.invitations";
import { InviteUserModal } from "~/routes/modal.invite-user";

export function ModalProvider() {
  return (
    <>
      <AddListModal />
      <AddCardModal />
      <InviteUserModal />
      <InvitationsModal />
    </>
  );
}
