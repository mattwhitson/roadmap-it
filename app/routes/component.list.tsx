import { Button } from "@/components/ui/button";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListWithDateAsStringAndCards } from "db/schema";
import { GripHorizontal, Settings } from "lucide-react";
import { ListDropdown } from "./component.list.dropdown";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CardComponent } from "./component.card";
import { useDroppable } from "@dnd-kit/core";

export function ListComponent({
  listWithCards,
  id,
  index,
  isListActive = false,
}: {
  listWithCards: ListWithDateAsStringAndCards;
  id: string;
  index: number;
  isListActive?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    activeIndex,
    isDragging,
    active,
  } = useSortable({
    id: id,
    data: {
      modifiers: [restrictToHorizontalAxis],
      isList: true,
    },
  });
  const { setNodeRef: emptyNodeRef } = useDroppable({
    id: `emptygrid-${index}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const cards = listWithCards.cards;
  const list = listWithCards.list;

  return (
    <section
      ref={setNodeRef}
      className="w-72 min-w-72 px-2 pb-1 pt-2 rounded-md dark:bg-neutral-900 mt-1 static self-start max-h-[calc(100vh-9.8rem)]"
      style={{
        ...style,
        visibility: index === activeIndex ? "hidden" : "visible",
      }}
    >
      <div
        className="flex items-center"
        style={{ marginBottom: `${cards && cards.length ? "0.5rem" : "0rem"}` }}
      >
        <h4 className="font-semibold text-sm p-1.5">{list.name}</h4>
        <ListDropdown
          listId={list.id}
          cardsListLength={cards.length}
          triggerClassName="ml-auto"
          icon={
            <Button
              variant="ghost"
              className="h-8 w-8 p-1 outline-none hover:outline-none active:outline-none hover:cursor-pointer"
              asChild
            >
              <Settings />
            </Button>
          }
        />
        <Button
          variant="ghost"
          className="h-8 w-8 p-1 outline-none hover:outline-none active:outline-none focus-visible:ring-offset-0 rounded-sm"
          asChild
          {...attributes}
          {...listeners}
        >
          <GripHorizontal />
        </Button>
      </div>

      <section
        className="flex flex-col gap-y-2 overflow-y-auto mb-1 max-h-[calc(100vh-13.3rem)] scrollbar-zinc-900 scrollbar-zinc-600 scrollbar-thin relative"
        style={{ overflowY: active ? "hidden" : "auto" }}
      >
        <SortableContext
          items={cards}
          strategy={verticalListSortingStrategy}
          disabled={isListActive}
        >
          {cards.map((card, cardIndex) => (
            <CardComponent
              card={card}
              key={card.id}
              isParentListActive={isDragging}
              parentIndex={index}
              index={cardIndex}
            />
          ))}
          {cards.length === 0 && (
            <div
              className="h-1 bg-inherit mt-[-0.2rem]"
              ref={emptyNodeRef}
            ></div>
          )}
        </SortableContext>
      </section>
    </section>
  );
}
