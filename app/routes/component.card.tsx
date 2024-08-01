import { Link, useParams } from "@remix-run/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardWithDateAsStringAndAttachments } from "db/schema";

export function CardComponent({
  card,
  parentIndex = -1,
  index,
  isParentListActive = false,
}: {
  card: CardWithDateAsStringAndAttachments;
  index?: number;
  parentIndex?: number;
  isParentListActive?: boolean;
}) {
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
    <Link to={`/board/${params.boardId}/card/${card.id}`} {...attributes}>
      <article
        ref={setNodeRef}
        key={card.id}
        {...listeners}
        style={{
          ...style,
          visibility:
            active?.id === card.id || isParentListActive ? "hidden" : "visible",
        }}
        className="dark:bg-slate-800 rounded-md text-sm"
      >
        {card.attachment ? (
          <div className="w-full h-40 rounded-md overflow-hidden">
            <img
              src={`https://pub-71d63f3a0192409e98c503499c6c6aa0.r2.dev/${card.attachment[0].url}`}
              alt="attachment"
            />
          </div>
        ) : null}
        <p className="p-2 line-clamp-2">{card.name}</p>
      </article>
    </Link>
  );
}
