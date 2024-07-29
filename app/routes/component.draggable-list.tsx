import { Dispatch, SetStateAction, useEffect, useId, useState } from "react";
import { ActionFunctionArgs } from "@remix-run/node";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";

import { listsTable, ListWithDateAsStringAndCards } from "db/schema";
import { ListComponent } from "~/routes/component.list";
import { authenticator } from "~/services.auth.server";
import { json, useFetcher, useParams } from "@remix-run/react";
import { db } from "db";
import { and, eq, gt, lt, sql } from "drizzle-orm";

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const { oldIndex, newIndex, boardId, listId } = jsonData;

  console.log(oldIndex, newIndex, boardId);
  if (
    typeof oldIndex !== "number" ||
    typeof newIndex !== "number" ||
    !boardId ||
    !listId
  ) {
    return json({ message: "Something went wrong.", ok: false });
  }

  const decrement = oldIndex < newIndex;
  let minIndex = oldIndex,
    maxIndex = newIndex;
  if (maxIndex < minIndex) {
    const temp = minIndex;
    minIndex = maxIndex;
    maxIndex = temp;
    // this accounts for inclusivity (i.e when list moves from pos 1 -> 0, we need to shift the element in pos 1 over by one to right)
    minIndex--;
  } else {
    // this accounts for inclusivity (i.e when list moves from pos 0 -> 1, we need to shift the element in pos 1 over by one to left)
    maxIndex++;
  }

  try {
    // TODO: Check if user is member of board
    // I was trying to to conditional operator inside sql tag for +- 1 but it doesn't seem to work :(
    if (decrement) {
      await db
        .update(listsTable)
        .set({
          position: sql`${listsTable.position} - 1`,
        })
        .where(
          and(
            and(
              lt(listsTable.position, maxIndex),
              gt(listsTable.position, minIndex)
            ),
            eq(listsTable.boardId, boardId)
          )
        );
    } else {
      await db
        .update(listsTable)
        .set({
          position: sql`${listsTable.position} + 1`,
        })
        .where(
          and(
            and(
              lt(listsTable.position, maxIndex),
              gt(listsTable.position, minIndex)
            ),
            eq(listsTable.boardId, boardId)
          )
        );
    }

    await db
      .update(listsTable)
      .set({ position: newIndex })
      .where(eq(listsTable.id, listId));
  } catch (error) {
    console.error(error);
    json({ message: "Database error.", ok: false });
  }

  return json({ message: "Card positions successfully updated!", ok: true });
}

export function DraggableList({
  listWithCards,
  setLists,
}: {
  listWithCards: ListWithDateAsStringAndCards[];
  setLists: Dispatch<SetStateAction<ListWithDateAsStringAndCards[]>>;
}) {
  const updatePositions = useFetcher<typeof action>();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [activeElement, setActiveElement] =
    useState<ListWithDateAsStringAndCards | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const params = useParams();
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function updateCardPositions(oldIndex: number, newIndex: number, id: string) {
    if (!params.boardId) return;
    updatePositions.submit(
      { oldIndex, newIndex, boardId: params.boardId, listId: id },
      {
        method: "post",
        action: "/component/draggable-list",
        encType: "application/json",
      }
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    for (let i = 0; i < listWithCards.length; i++) {
      if (listWithCards[i].id === active.id) {
        setActiveElement(listWithCards[i]);
        setActiveIndex(i);
        break;
      }
    }
    setActiveId(active.id);
  }

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

        updateCardPositions(oldIndex, newIndex, listWithCards[oldIndex].id);

        return arrayMove(listWithCards, oldIndex, newIndex);
      });
    }

    setActiveId(null);
    setActiveIndex(null);
    setActiveElement(null);
  }

  useEffect(() => {
    if (!updatePositions.data) return;
    console.log(updatePositions.data);
  }, [updatePositions.data]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      id={id}
      modifiers={[restrictToHorizontalAxis]}
    >
      <SortableContext
        items={listWithCards}
        strategy={horizontalListSortingStrategy}
      >
        <main className="h-full">
          <div className="flex gap-x-2 px-4 h-full overflow-y-hidden scrollbar-zinc-900 scrollbar-zinc-600 scrollbar-thin">
            {listWithCards &&
              listWithCards.map((list: ListWithDateAsStringAndCards, index) => (
                <ListComponent
                  key={list.list.id}
                  id={list.list.id}
                  listWithCards={list}
                  index={index}
                />
              ))}
          </div>
        </main>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <ListComponent
            id={activeId as string}
            listWithCards={activeElement!}
            index={activeIndex!}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
