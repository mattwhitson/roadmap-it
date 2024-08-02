import { useSocketContext } from "@/components/providers/socket-provider";
import { useLocation, useNavigate, useRevalidator } from "@remix-run/react";
import {
  AttachmentWithDateAsString,
  CardWithDateAsStringAndActivities,
  CardWithDateAsStringAndAttachments,
  ListWithDateAsStringAndCards,
} from "db/schema";
import { Dispatch, SetStateAction, useEffect } from "react";

export function useSocket({
  queryKey,
  route,
  setListState,
  setCardState,
  setAttachmentState,
}: {
  queryKey?: string;
  route?: string;
  setListState?: Dispatch<SetStateAction<ListWithDateAsStringAndCards[]>>;
  setCardState?: Dispatch<SetStateAction<CardWithDateAsStringAndActivities>>;
  setAttachmentState?: Dispatch<SetStateAction<AttachmentWithDateAsString[]>>;
}) {
  const socket = useSocketContext();
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!socket || !queryKey) return;

    socket.on(queryKey, (data) => {
      if (setListState) {
        if (data.type === "AddCard") {
          const card = data.newCard as CardWithDateAsStringAndAttachments;

          setListState((prev) => {
            const listIndex = prev.findIndex((list) => list.id === card.listId);

            const result = [...prev];
            result[listIndex] = {
              ...result[listIndex],
              cards: [...result[listIndex].cards, card],
            };

            return result;
          });
        } else if (data.type === "DeleteCard") {
          const { cardId, listId, deletedPosition } = data;

          setListState((prev) => {
            const listIndex = prev.findIndex((list) => list.id === listId);

            const result = [...prev];
            result[listIndex] = {
              ...result[listIndex],
              cards: [
                ...result[listIndex].cards
                  .filter((card) => card.id !== cardId)
                  .map((card) =>
                    card.position > deletedPosition
                      ? { ...card, position: card.position - 1 }
                      : card
                  ),
              ],
            };

            return result;
          });
        } else if (data.type === "AddList") {
          const list = data.newList as ListWithDateAsStringAndCards;

          setListState((prev) => {
            return [...prev, list];
          });
        } else if (data.type === "DeleteList") {
          const listId = data.listId;

          setListState((prev) => {
            return [...prev.filter((list) => list.id !== listId)];
          });
        } else if (data.type === "AddAttachment") {
          const { attachment, listId, cardId } = data;

          setListState((prev) => {
            const listIndex = prev.findIndex((list) => list.id === listId);
            const cardIndex = prev[listIndex].cards.findIndex(
              (card) => card.id === cardId
            );

            const result = [...prev];
            result[listIndex].cards[cardIndex].attachment = [attachment];

            return result;
          });
        } else if (data.type === "DeleteAttachment") {
          const { attachment, listId, cardId } = data;
          setListState((prev) => {
            const listIndex = prev.findIndex((list) => list.id === listId);
            const cardIndex = prev[listIndex].cards.findIndex(
              (card) => card.id === cardId
            );
            if (
              prev[listIndex].cards[cardIndex].attachment?.[0] &&
              prev[listIndex].cards[cardIndex].attachment[0].id !==
                attachment.id
            )
              return prev;

            const result = [...prev];
            result[listIndex].cards[cardIndex].attachment = null;
            return result;
          });
        }
      } else if (setCardState && setAttachmentState) {
        if (data.type === "AddAttachment") {
          const { activity, attachment } = data;

          setCardState((prev) => {
            return { ...prev, activities: [activity, ...prev.activities] };
          });
          setAttachmentState((prev) => {
            return [...prev, attachment];
          });
        } else if (data.type === "DeleteAttachment") {
          const { attachment } = data;
          setAttachmentState((prev) => {
            return [...prev.filter((attach) => attach.id !== attachment.id)];
          });
        }
      } else if (location.pathname === route) {
        navigate(".", { replace: true });
      }
    });

    return () => {
      socket.off(queryKey);
    };
  }, [
    socket,
    queryKey,
    socket?.connected,
    navigate,
    location.pathname,
    route,
    revalidator,
    setListState,
    setCardState,
    setAttachmentState,
  ]);

  return { socket };
}
