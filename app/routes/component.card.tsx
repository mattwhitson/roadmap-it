import { Link, useParams } from "@remix-run/react";
import {
  AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CardWithDateAsStringAndAttachments } from "db/schema";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const animateLayoutChanges: AnimateLayoutChanges = function (args) {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) {
    return defaultAnimateLayoutChanges(args);
  }

  return true;
};

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
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, active } =
    useSortable({
      animateLayoutChanges,
      id: card.id,
      data: { isCard: true, listIndex: parentIndex, index },
    });
  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };
  const params = useParams();

  useEffect(() => {
    if (imageRef.current?.complete) setIsImageLoaded(true);
  }, [imageRef.current?.complete]);
  return (
    <Link
      ref={setNodeRef}
      style={{
        ...style,
        visibility:
          active?.id === card.id || isParentListActive ? "hidden" : "visible",
      }}
      {...listeners}
      {...attributes}
      to={`/board/${params.boardId}/card/${card.id}`}
    >
      <article className="text-white bg-gray-500 dark:bg-slate-800 rounded-md text-sm">
        {card.attachment ? (
          <div className="w-full h-40 rounded-md overflow-hidden flex justify-center items-center">
            <img
              ref={imageRef}
              src={`https://pub-71d63f3a0192409e98c503499c6c6aa0.r2.dev/${card.attachment[0].url}`}
              alt="attachment"
              onLoad={() => {
                console.log("hey");
                setIsImageLoaded(true);
              }}
            />

            {!isImageLoaded && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        ) : null}
        <p className="p-2 line-clamp-2">{card.name}</p>
      </article>
    </Link>
  );
}
