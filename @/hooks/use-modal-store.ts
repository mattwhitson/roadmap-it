import { RequestWithDateAsString, User } from "db/schema";
import { create } from "zustand";

export enum ModalTypes {
  AddList,
  AddCard,
  InviteUser,
  Invitations,
}

export interface DataType {
  listId?: string;
  listCount?: number;
  listName?: string;
  cardsListLength?: number;
  user?: User;
  invitations?: RequestWithDateAsString[];
}

interface ModalState {
  type: ModalTypes | null;
  isOpen: boolean;
  data?: DataType;
  onOpen: (type: ModalTypes, data?: DataType) => void;
  onClose: () => void;
  updateInvitations: (invitations: RequestWithDateAsString[]) => void;
}

export const useModalStore = create<ModalState>((set) => ({
  type: null,
  isOpen: false,
  data: {} as DataType,
  onOpen: (type: ModalTypes, data?: DataType) =>
    set({ type: type, isOpen: true, data: data }),
  onClose: () => set({ type: null, isOpen: false }),
  updateInvitations: (invitations: RequestWithDateAsString[]) =>
    set({ data: { invitations: invitations } }),
}));
