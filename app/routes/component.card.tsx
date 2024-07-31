import { Link, useParams } from "@remix-run/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardWithDateAsString } from "db/schema";

export function CardComponent({
  card,
  parentIndex = -1,
  index,
  isParentListActive = false,
}: {
  card: CardWithDateAsString;
  index?: number;
  parentIndex?: number;
  isParentListActive?: boolean;
}) {
  //console.log(card, index, parentIndex, isParentListActive);
  const { attributes, listeners, setNodeRef, transform, transition, active } =
    useSortable({
      id: card.id,
      data: { isCard: true, listIndex: parentIndex, index },
    });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const params = useParams();
  return (
    <Link
      ref={setNodeRef}
      key={card.id}
      to={`/board/${params.boardId}/card/${card.id}`}
      {...attributes}
      {...listeners}
      style={{
        ...style,
        visibility:
          active?.id === card.id || isParentListActive ? "hidden" : "visible",
      }}
    >
      <article className="p-2 dark:bg-zinc-800 rounded-md text-sm">
        <p className="line-clamp-2">{card.name}</p>
      </article>
    </Link>
  );
}
