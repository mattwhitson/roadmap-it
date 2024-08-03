import { useSocketContext } from "@/components/providers/socket-provider";
import { useLocation, useNavigate, useRevalidator } from "@remix-run/react";
import {
  AttachmentWithDateAsString,
  BoardWithDateAsString,
  CardWithDateAsStringAndActivities,
  CardWithDateAsStringAndAttachments,
  ListWithDateAsStringAndCards,
  RequestWithDateAsString,
  User,
} from "db/schema";
import { Dispatch, SetStateAction, useEffect } from "react";

export function useSocket({
  queryKey,
  route,
  setListState,
  setCardState,
  setAttachmentState,
  setBoardState,
  setInvitationsState,
  user,
}: {
  queryKey?: string;
  route?: string;
  setListState?: Dispatch<SetStateAction<ListWithDateAsStringAndCards[]>>;
  setCardState?: Dispatch<SetStateAction<CardWithDateAsStringAndActivities>>;
  setAttachmentState?: Dispatch<SetStateAction<AttachmentWithDateAsString[]>>;
  setBoardState?: Dispatch<SetStateAction<BoardWithDateAsString>>;
  setInvitationsState?: Dispatch<SetStateAction<RequestWithDateAsString[]>>;
  user?: User;
}) {
  const socket = useSocketContext();
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!socket || !queryKey) return;

    socket.on(queryKey, (data) => {
      if (setListState && setBoardState) {
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
            const listIndex = prev.findIndex((list) => list.id === listId);
            return [
              ...prev
                .filter((list) => list.id !== listId)
                .map((l) =>
                  l.list.position > listIndex
                    ? {
                        ...l,
                        list: { ...l.list, position: l.list.position - 1 },
                      }
                    : { ...l }
                ),
            ];
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
        } else if (data.type === "UpdateListName") {
          const { listId, name } = data;

          setListState((prev) => {
            const listIndex = prev.findIndex((list) => list.id === listId);
            const result = [...prev];
            result[listIndex].list = {
              ...result[listIndex].list,
              name: name,
            };

            return result;
          });
        } else if (data.type === "UpdateBoardName") {
          const { name } = data;

          setBoardState((prev) => ({
            ...prev,
            name: name,
          }));
        } else if (data.type === "UpdateListPositions") {
          const { listId, oldPosition, position, userId } = data;
          if (user?.id === userId) return;
          setListState((prev) => {
            const listIndex = prev.findIndex((list) => list.id === listId);
            const result = [...prev];
            result[listIndex].list = {
              ...result[listIndex].list,
              position: position,
            };

            if (oldPosition > position) {
              for (let i = position; i < oldPosition; i++) {
                result[i].list.position++;
              }
            } else {
              for (let i = oldPosition + 1; i < position + 1; i++) {
                result[i].list.position--;
              }
            }
            result.sort((a, b) => a.list.position - b.list.position);
            return result;
          });
        } else if (data.type === "UpdateCardPositions") {
          // i apologize upfront, this code is terrible, it needs to be simplified
          const {
            userId,
            finalListIndex,
            position,
            oldPosition,
            movedLists,
            originalListId,
            cardId,
            initialIndexInitialList,
          } = data;
          if (user?.id === userId) return;
          setListState((prev) => {
            const ogListIndex = prev.findIndex(
              (list) => list.id === originalListId
            );

            const result = [...prev];

            if (!movedLists) {
              result[finalListIndex].cards[oldPosition].position = position;

              if (oldPosition > position) {
                for (let i = position; i < oldPosition; i++) {
                  result[finalListIndex].cards[i].position++;
                }
              } else {
                for (let i = oldPosition + 1; i < position + 1; i++) {
                  result[finalListIndex].cards[i].position--;
                }
              }
            } else {
              result[finalListIndex].cards = [
                ...prev[finalListIndex].cards.slice(0, position),
                {
                  ...prev[ogListIndex].cards[initialIndexInitialList],
                  position: position,
                },
                ...prev[finalListIndex].cards.slice(
                  position,
                  prev[finalListIndex].cards.length + 1
                ),
              ];

              for (
                let i = position + 1;
                i < result[finalListIndex].cards.length;
                i++
              ) {
                result[finalListIndex].cards[i].position++;
              }
            }

            if (movedLists) {
              result[ogListIndex].cards = [
                ...result[ogListIndex].cards.filter(
                  (card) => card.id !== cardId
                ),
              ];
              for (
                let i = initialIndexInitialList;
                i < result[ogListIndex].cards.length;
                i++
              ) {
                result[ogListIndex].cards[i].position--;
              }
            }

            result[finalListIndex].cards.sort(
              (a, b) => a.position - b.position
            );
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
        } else if (data.type === "UpdateCardDescription") {
          const { activity, description } = data;
          console.log("HELLO");
          setCardState((prev) => {
            return {
              ...prev,
              description: description,
              activities: [activity, ...prev.activities],
            };
          });
        }
      } else if (setInvitationsState) {
        const { invitation } = data;
        setInvitationsState((prev) => {
          return [...prev, invitation];
        });
      }
      // else if (location.pathname === route) {
      //   navigate(".", { replace: true });
      // }
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
    setBoardState,
    user,
  ]);

  return { socket };
}
