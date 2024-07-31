import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useState,
} from "react";

export interface BoardContextType {
  boardData: BoardData;
  setBoardData: Dispatch<SetStateAction<BoardData>>;
}
export interface BoardData {
  isMemberOfBoard: boolean;
}

const BoardContext = createContext<BoardContextType>({
  boardData: {} as BoardData,
  setBoardData: () => {},
});

interface Props {
  initialValue?: BoardData;
  children: React.ReactNode;
}

export const useBoardContext = () => useContext(BoardContext);

export function BoardProvider({ initialValue, children }: Props) {
  const [value, setValue] = useState(
    initialValue || ({ isMemberOfBoard: false } as BoardData)
  );
  return (
    <BoardContext.Provider value={{ boardData: value, setBoardData: setValue }}>
      {children}
    </BoardContext.Provider>
  );
}
