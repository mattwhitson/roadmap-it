import { create } from "zustand";

export enum ModalTypes {
  AddList,
  AddCard,
}

export interface DataType {
  listId?: string;
  boardCount?: number;
}

interface ModalState {
  type: ModalTypes | null;
  isOpen: boolean;
  data?: DataType;
  onOpen: (type: ModalTypes, data?: DataType) => void;
  onClose: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  type: null,
  isOpen: false,
  data: {} as DataType,
  onOpen: (type: ModalTypes, data?: DataType) =>
    set({ type: type, isOpen: true, data: data }),
  onClose: () => set({ type: null, isOpen: false }),
}));
