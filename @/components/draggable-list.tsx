import { Dispatch, SetStateAction, useId } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

import { ListWithDateAsStringAndCards } from "db/schema";
import { ListComponent } from "~/routes/component.list";

export function DraggableList({
  listWithCards,
  setLists,
}: {
  listWithCards: ListWithDateAsStringAndCards[];
  setLists: Dispatch<SetStateAction<ListWithDateAsStringAndCards[]>>;
}) {
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLists((listWithCards) => {
        const oldIndex = listWithCards.findIndex(
          (listWithCard) => listWithCard.list.id === active.id
        )!;
        const newIndex = listWithCards.findIndex(
          (listWithCard) => listWithCard.list.id === over.id
        )!;

        return arrayMove(listWithCards, oldIndex, newIndex);
      });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      id={id}
      modifiers={[restrictToHorizontalAxis]}
    >
      <SortableContext
        items={listWithCards}
        strategy={horizontalListSortingStrategy}
      >
        <main className="h-[calc(100%-1.5rem)]">
          <div className="flex gap-x-2 px-4 overflow-x-auto h-full">
            {listWithCards &&
              listWithCards.map((list: ListWithDateAsStringAndCards, index) => (
                <ListComponent
                  key={list.list.id}
                  listWithCards={list}
                  index={index}
                />
              ))}
          </div>
        </main>
      </SortableContext>
    </DndContext>
  );
}
