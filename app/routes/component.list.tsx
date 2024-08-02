import { Button } from "@/components/ui/button";
import {
  AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  boardsToUsers,
  listsTable,
  ListWithDateAsStringAndCards,
} from "db/schema";
import { GripHorizontal, Settings } from "lucide-react";
import { ListDropdown } from "./component.list.dropdown";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CardComponent } from "./component.card";
import { useDroppable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import {
  AutosizeTextarea,
  AutosizeTextAreaRef,
} from "@/components/ui/autosize-text-area";
import { ActionFunctionArgs, json } from "@remix-run/node";
import { useFetcher, useParams } from "@remix-run/react";
import { authenticator } from "~/services.auth.server";
import { db } from "db";
import { and, count, eq } from "drizzle-orm";

const animateLayoutChanges: AnimateLayoutChanges = function (args) {
  const { isSorting, wasDragging } = args;

  if (isSorting || wasDragging) {
    console.log(isSorting, wasDragging);
    console.log("YEEET");
    return defaultAnimateLayoutChanges(args);
  }

  return true;
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const jsonData = await request.json();
  const { name, boardId, listId } = jsonData;

  if (!boardId || !listId || !name || name === "") {
    return json({ message: "Something went wrong.", ok: false });
  }

  if (name.length > 128) {
    return json({
      message: "List name cannot be longer than 128 characters",
      ok: false,
    });
  }

  try {
    const isUserMemberOfBoard = await db
      .select({ count: count() })
      .from(boardsToUsers)
      .where(
        and(
          eq(boardsToUsers.boardId, boardId),
          eq(boardsToUsers.userId, user.id)
        )
      );

    if (isUserMemberOfBoard[0].count === 0) {
      // TODO: redirect this to custom page saying uh oh you're not a member
      return json({
        message: "You are not authorized to perform this action",
        ok: false,
      });
    }

    await db
      .update(listsTable)
      .set({ name: name })
      .where(eq(listsTable.id, listId));
  } catch (error) {
    console.error(error);
    return json({ message: "Database error", ok: false });
  }
  return json({ message: "List title successfully changed!", ok: true });
}

export function ListComponent({
  listWithCards,
  id,
  index,
  isListActive = false,
  isMemberOfBoard = false,
}: {
  listWithCards: ListWithDateAsStringAndCards;
  id: string;
  index: number;
  isListActive?: boolean;
  isMemberOfBoard?: boolean;
}) {
  const editName = useFetcher<typeof action>();
  const params = useParams();

  const [listName, setListName] = useState(listWithCards.list.name);
  const [isEditing, setIsEditing] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<AutosizeTextAreaRef>(null);

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
    animateLayoutChanges,
    id: id,
    data: {
      modifiers: [restrictToHorizontalAxis],
      isList: true,
    },
  });
  const { setNodeRef: emptyNodeRef } = useDroppable({
    id: `emptygrid-${index}`,
  });

  useEffect(() => {
    const detectClickOutsideElement = (e: MouseEvent) => {
      if (headerRef.current && headerRef.current.contains(e.target as Node)) {
        setListName(listWithCards.list.name);
        setIsEditing(true);
      } else if (
        textAreaRef.current &&
        !textAreaRef.current.textArea.contains(e.target as Node) &&
        textAreaRef.current.textArea !== document.activeElement
      ) {
        setIsEditing(false);
        setListName(listWithCards.list.name);
      }
    };

    window.addEventListener("click", detectClickOutsideElement);

    return () => {
      window.removeEventListener("click", detectClickOutsideElement);
    };
  }, [listWithCards]);

  useEffect(() => {
    setListName(listWithCards.list.name);
  }, [listWithCards.list.name]);

  useEffect(() => {
    if (!editName.data) return;
    console.log(editName.data);
    // TODO add toast
  }, [editName.data]);

  function handleNameUpdate() {
    if (listName === listWithCards.list.name) return;
    if (listName === "") return; // TODO maybe show toast here
    if (!params.boardId) return;

    editName.submit(
      { name: listName, listId: listWithCards.id, boardId: params.boardId },
      {
        method: "post",
        action: "/component/list",
        encType: "application/json",
      }
    );

    setIsEditing(false);
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const cards = listWithCards.cards;
  const list = listWithCards.list;

  return (
    <section
      ref={setNodeRef}
      className="w-72 min-w-72 pl-1 pr-2 pb-1 pt-2 rounded-md dark:bg-neutral-900 mt-1 static self-start max-h-[calc(100vh-9.8rem)]"
      style={{
        ...style,
        visibility: index === activeIndex ? "hidden" : "visible",
      }}
    >
      <div
        className="flex items-center w-full"
        style={{ marginBottom: `${cards && cards.length ? "0.5rem" : "0rem"}` }}
      >
        {!isEditing && (
          <div ref={headerRef} className="overflow-hidden w-full">
            <h4 className="font-semibold text-sm ml-2 overflow-hidden text-nowrap overflow-ellipsis mr-1">
              {editName.state !== "idle" ? listName : list.name}
            </h4>
          </div>
        )}
        {isEditing && (
          <AutosizeTextarea
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            ref={textAreaRef}
            minHeight={28}
            className="py-1 px-2 h-8 focus-visible:ring-offset-0 font-semibold"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleNameUpdate();
              }
            }}
          />
        )}
        {isMemberOfBoard && (
          <>
            <ListDropdown
              listId={list.id}
              listName={list.name}
              cardsListLength={cards.length}
              triggerClassName="ml-auto"
              icon={
                <Button
                  variant="ghost"
                  className="h-8 w-8 min-h-8 min-w-8 p-1 outline-none hover:outline-none active:outline-none hover:cursor-pointer"
                  asChild
                >
                  <Settings />
                </Button>
              }
            />
            <Button
              variant="ghost"
              className="h-8 w-8 min-h-8 min-w-8 p-1 outline-none hover:outline-none active:outline-none focus-visible:ring-offset-0 rounded-sm"
              asChild
              {...attributes}
              {...listeners}
            >
              <GripHorizontal />
            </Button>
          </>
        )}
      </div>

      <section
        className="flex flex-col gap-y-2 overflow-y-auto mb-1 max-h-[calc(100vh-13.3rem)] scrollbar-zinc-900 scrollbar-zinc-600 scrollbar-thin relative"
        style={{ overflowY: active ? "hidden" : "auto" }}
      >
        <SortableContext
          items={cards}
          strategy={verticalListSortingStrategy}
          disabled={isListActive || !isMemberOfBoard}
        >
          {cards.map((card, cardIndex) => {
            return (
              <CardComponent
                card={card}
                key={card.id}
                isParentListActive={isDragging}
                parentIndex={index}
                index={cardIndex}
              />
            );
          })}
          {cards.length === 0 && (
            <div className="h-1 bg-inherit" ref={emptyNodeRef}></div>
          )}
        </SortableContext>
      </section>
    </section>
  );
}
