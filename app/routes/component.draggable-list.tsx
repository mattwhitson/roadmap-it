import { Dispatch, SetStateAction, useEffect, useId, useState } from "react";
import { ActionFunctionArgs } from "@remix-run/node";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  Active,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import {
  cardsTable,
  CardWithDateAsString,
  listsTable,
  ListWithDateAsStringAndCards,
} from "db/schema";
import { ListComponent } from "~/routes/component.list";
import { authenticator } from "~/services.auth.server";
import { json, useFetcher, useParams } from "@remix-run/react";
import { db } from "db";
import { and, eq, gt, gte, lt, ne, sql } from "drizzle-orm";
import { CardComponent } from "./component.card";

function getRangeOfIndicesToAlter(oldIndex: number, newIndex: number) {
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

  return { decrement, minIndex, maxIndex };
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const { type } = jsonData;
  if (type === "List") {
    const { oldIndex, newIndex, boardId, listId } = jsonData;

    if (
      typeof oldIndex !== "number" ||
      typeof newIndex !== "number" ||
      !boardId ||
      !listId
    ) {
      return json({ message: "Something went wrong.", ok: false });
    }

    const { decrement, minIndex, maxIndex } = getRangeOfIndicesToAlter(
      oldIndex,
      newIndex
    );
    try {
      // TODO: Check if user is member of board
      let posQuery = sql`${listsTable.position} + 1`;
      if (decrement) {
        posQuery = sql`${listsTable.position} - 1`;
      }

      await db
        .update(listsTable)
        .set({
          position: posQuery,
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

      await db
        .update(listsTable)
        .set({ position: newIndex })
        .where(eq(listsTable.id, listId));
    } catch (error) {
      console.error(error);
      json({ message: "Database error.", ok: false });
    }

    return json({ message: "List positions successfully updated!", ok: true });
  } else {
    const { values, boardId, movedInSameList, initialIndex, initialListId } =
      jsonData;

    if (
      !values === undefined ||
      boardId === undefined ||
      initialIndex === undefined ||
      initialListId === undefined
    ) {
      return json({ message: "Something went wrong.", ok: false });
    }

    try {
      if (movedInSameList) {
        const { decrement, minIndex, maxIndex } = getRangeOfIndicesToAlter(
          initialIndex,
          values.finalCardIndex
        );

        let posQuery = sql`${cardsTable.position} + 1`;
        if (decrement) {
          posQuery = sql`${cardsTable.position} - 1`;
        }

        await db
          .update(cardsTable)
          .set({
            position: posQuery,
          })
          .where(
            and(
              and(
                lt(cardsTable.position, maxIndex),
                gt(cardsTable.position, minIndex)
              ),
              eq(cardsTable.listId, values.listId)
            )
          );
      } else {
        console.log(values.finalCardIndex);
        await db
          .update(cardsTable)
          .set({
            position: sql`${cardsTable.position} + 1`,
          })
          .where(
            and(
              and(
                gte(cardsTable.position, values.finalCardIndex),
                eq(cardsTable.listId, values.listId)
              ),
              ne(cardsTable.id, values.cardId)
            )
          );

        await db
          .update(cardsTable)
          .set({
            position: sql`${cardsTable.position} - 1`,
          })
          .where(
            and(
              gt(cardsTable.position, initialIndex),
              eq(cardsTable.listId, initialListId)
            )
          );
      }

      await db
        .update(cardsTable)
        .set({
          position: values.finalCardIndex,
          listId: values.listId,
        })
        .where(eq(cardsTable.id, values.cardId));
    } catch (error) {
      console.error(error);
      return json({ message: "Database error", ok: false });
    }
    return json({ message: "Card positions successfully updated!", ok: true });
  }
}

export function DraggableList({
  listWithCards,
  setLists,
  isMemberOfBoard,
}: {
  listWithCards: ListWithDateAsStringAndCards[];
  setLists: Dispatch<SetStateAction<ListWithDateAsStringAndCards[]>>;
  isMemberOfBoard: boolean;
}) {
  const updatePositions = useFetcher<typeof action>();
  const [initialCardPosition, setInitialCardPosition] = useState<
    number[] | null
  >(null);
  const [activeDraggable, setActiveDraggable] = useState<Active | null>(null);
  const [activeElement, setActiveElement] = useState<
    ListWithDateAsStringAndCards | CardWithDateAsString | null
  >(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const params = useParams();
  const id = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function findCardInList(id: string) {
    for (let i = 0; i < listWithCards.length; i++) {
      const index = listWithCards[i].cards.findIndex((card) => card.id === id);
      if (index !== -1) {
        return i;
      }
    }
    return null;
  }

  function updateListPositions(oldIndex: number, newIndex: number, id: string) {
    if (!params.boardId) return;
    updatePositions.submit(
      {
        oldIndex,
        newIndex,
        boardId: params.boardId,
        listId: id,
        type: "List",
      },
      {
        method: "post",
        action: "/component/draggable-list",
        encType: "application/json",
      }
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    if (active.data.current?.isList) {
      for (let i = 0; i < listWithCards.length; i++) {
        if (listWithCards[i].id === active.id) {
          setActiveElement(listWithCards[i]);
          setActiveIndex(i);
          break;
        }
      }
    } else {
      for (let i = 0; i < listWithCards.length; i++) {
        for (let j = 0; j < listWithCards[i].cards.length; j++) {
          if (listWithCards[i].cards[j].id === active.id) {
            setActiveElement(listWithCards[i].cards[j]);
            setInitialCardPosition([i, j]);
            break;
          }
        }
      }
    }
    setActiveDraggable(active);
  }

  function handleDragOver(event: DragOverEvent) {
    if (activeDraggable?.data.current?.isList) return;

    const { active, over } = event;
    const fromListIndex = findCardInList(active.id as string);
    const toListIndex = findCardInList(over?.id as string);
    // console.log("overId", over?.id);
    //console.log(JSON.parse(JSON.stringify(listWithCards)));
    if (
      toListIndex === null &&
      fromListIndex !== null &&
      over?.id.toString().startsWith("emptygrid")
    ) {
      const id = Number(over?.id.toString().split("-")[1]);

      // this means the card has already been put in this empty grid, in that case we don't want to do anything
      if (listWithCards[id].cards.length > 0) return;
      console.log(active.id, over.id);
      setLists((prev) => {
        const result = [...prev];

        const activeIndex = listWithCards[fromListIndex].cards.findIndex(
          (card) => card.id === active.id
        );

        result[id] = {
          ...result[id],
          cards: [listWithCards[fromListIndex].cards[activeIndex]],
        };

        result[fromListIndex].cards = [
          ...result[fromListIndex].cards.filter(
            (card) => card.id !== active.id
          ),
        ];
        // console.log("FROM_LIST-TO", fromListIndex, id);
        // console.log(JSON.parse(JSON.stringify(result)));
        return result;
      });
    }

    if (
      fromListIndex === null ||
      toListIndex === null ||
      fromListIndex === toListIndex
    )
      return;

    setLists((prev) => {
      // console.log("hola senor");
      const fromList = listWithCards[fromListIndex].cards;
      const toList = listWithCards[toListIndex].cards;

      const activeIndex = fromList.findIndex((card) => card.id === active.id);
      const overIndex = toList.findIndex((card) => card.id === over?.id);

      if (activeIndex === -1 || overIndex === -1) return [...prev];

      let isBottom = 0;
      if (
        over?.rect.top &&
        active.rect.current.translated &&
        over.rect.top + (over.rect.bottom - over.rect.top) / 2 <
          active.rect.current.translated.top
      )
        isBottom++;

      const result = [...prev];
      result[fromListIndex].cards = [
        ...fromList.filter((card) => card.id !== active.id),
      ];
      result[toListIndex].cards = [
        ...toList.slice(0, overIndex + isBottom),
        fromList[activeIndex],
        ...toList.slice(overIndex + isBottom, toList.length),
      ];

      return result;
    });
  }

  function updateCardPositions(
    cardId: string,
    listId: string,
    finalListIndex: number,
    finalCardIndex: number,
    movedInSameList: boolean,
    initialListId: string,
    initialIndex: number
  ) {
    if (!params.boardId) return;
    updatePositions.submit(
      {
        values: {
          cardId,
          listId,
          finalListIndex,
          finalCardIndex,
        },
        boardId: params.boardId,
        listId: id,
        type: "Card",
        movedInSameList,
        initialListId,
        initialIndex,
      },
      {
        method: "post",
        action: "/component/draggable-list",
        encType: "application/json",
      }
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.data.current?.isList) {
      if (over && active.id !== over.id) {
        setLists((listWithCards) => {
          const oldIndex = listWithCards.findIndex(
            (listWithCard) => listWithCard.list.id === active.id
          )!;
          const newIndex = listWithCards.findIndex(
            (listWithCard) => listWithCard.list.id === over.id
          )!;

          updateListPositions(oldIndex, newIndex, listWithCards[oldIndex].id);

          return arrayMove(listWithCards, oldIndex, newIndex);
        });
      }
    } else {
      // console.log("NEVER SHOULD BE HERE");
      setLists((prev) => {
        const listIndex = findCardInList(active.id as string);

        if (listIndex === null) return [...prev];

        const list = listWithCards[listIndex].cards;

        const activeIndex = list.findIndex((card) => card.id === active.id);
        let overIndex = list.findIndex((card) => card.id === over?.id);

        // accounts for when overId is an empty empty list instead of a card
        if (overIndex === -1) overIndex = 0;

        const result = [...prev];
        result[listIndex].cards = arrayMove(
          prev[listIndex].cards,
          activeIndex,
          overIndex
        );

        if (initialCardPosition !== null) {
          const movedInSameList =
            listIndex === initialCardPosition[0] &&
            overIndex > initialCardPosition[1];
          updateCardPositions(
            activeDraggable?.id.toString() || "",
            listWithCards[listIndex].id,
            listIndex,
            overIndex,
            movedInSameList,
            listWithCards[initialCardPosition[0]].id,
            initialCardPosition[1]
          );
        }

        return result;
      });

      setInitialCardPosition(null);
    }

    setActiveDraggable(null);
    setActiveIndex(null);
    setActiveElement(null);
  }

  useEffect(() => {
    if (!updatePositions.data) return;
    console.log(updatePositions.data);
  }, [updatePositions.data]);
  // console.log(JSON.parse(JSON.stringify(listWithCards)));
  //console.log(listWithCards);
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      id={id}
      modifiers={activeDraggable?.data.current?.modifiers}
    >
      <SortableContext
        items={listWithCards}
        strategy={horizontalListSortingStrategy}
        disabled={activeDraggable?.data.current?.isCard}
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
                  isListActive={activeDraggable?.data.current?.isList}
                  isMemberOfBoard={isMemberOfBoard}
                />
              ))}
          </div>
        </main>
      </SortableContext>
      <DragOverlay>
        {activeDraggable?.data.current?.isList ? (
          <ListComponent
            isMemberOfBoard={isMemberOfBoard}
            id={activeDraggable.id as string}
            listWithCards={activeElement as ListWithDateAsStringAndCards}
            index={activeIndex!}
          />
        ) : activeDraggable?.data.current?.isCard ? (
          <CardComponent card={activeElement as CardWithDateAsString} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
