import { Button } from "@/components/ui/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListWithDateAsStringAndCards } from "db/schema";
import { GripHorizontal, Settings } from "lucide-react";
import { ListDropdown } from "./component.list.dropdown";
import { Link, useParams } from "@remix-run/react";

export function ListComponent({
  listWithCards,
  id,
  index,
}: {
  listWithCards: ListWithDateAsStringAndCards;
  id: string;
  index: number;
}) {
  const params = useParams();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    activeIndex,
  } = useSortable({ id: id });
  console.log(activeIndex, index, activeIndex === index);
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    display: index === activeIndex ? "hidden" : "block",
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

      <section className="flex flex-col gap-y-2 overflow-y-auto mb-1 max-h-[calc(100vh-13.3rem)] scrollbar-zinc-900 scrollbar-zinc-600 scrollbar-thin">
        {cards.map((card) => (
          <Link key={card.id} to={`/board/${params.boardId}/card/${card.id}`}>
            <article className="p-2 dark:bg-zinc-800 rounded-md text-sm">
              <p className="line-clamp-2">{card.name}</p>
            </article>
          </Link>
        ))}
      </section>
    </section>
  );
}
