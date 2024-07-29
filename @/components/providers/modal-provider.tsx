import { AddCardModal } from "~/routes/modal.add-card";
import { AddListModal } from "~/routes/modal.add-list";

export function ModalProvider() {
  return (
    <>
      <AddListModal />
      <AddCardModal />
    </>
  );
}
