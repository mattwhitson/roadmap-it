import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModalTypes, useModalStore } from "@/hooks/use-modal-store";

export function ListDropdown({
  icon,
  triggerClassName = "",
  listId,
}: {
  icon: JSX.Element;
  triggerClassName?: string;
  listId: string;
}) {
  const { onOpen } = useModalStore();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>
        {icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          className="hover:cursor-pointer"
          onClick={() => onOpen(ModalTypes.AddCard, { listId })}
        >
          Add card
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Delete List</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
