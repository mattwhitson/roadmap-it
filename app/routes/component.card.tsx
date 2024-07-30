import { Link, useParams } from "@remix-run/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardWithDateAsString } from "db/schema";

export function CardComponent({ card }: { card: CardWithDateAsString }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    // activeIndex,
    isDragging,
    active,
  } = useSortable({ id: card.id, data: { isCard: true } });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const params = useParams();
  return (
    <Link
      ref={setNodeRef}
      key={card.id}
      to={`${isDragging ? null : `/board/${params.boardId}/card/${card.id}`}`}
      {...attributes}
      {...listeners}
      style={{
        ...style,
        visibility: active?.id === card.id ? "hidden" : "visible",
      }}
    >
      <article className="p-2 dark:bg-zinc-800 rounded-md text-sm">
        <p className="line-clamp-2">{card.name}</p>
      </article>
    </Link>
  );
}
