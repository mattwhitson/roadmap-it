import { useSocket } from "@/hooks/use-socket";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { db } from "db";
import { boardsTable, boardsToUsers } from "db/schema";
import { and, eq } from "drizzle-orm";
import { useState } from "react";
import { authenticator } from "~/services.auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  let boards;
  try {
    boards = await db
      .select({
        id: boardsTable.id,
        name: boardsTable.name,
      })
      .from(boardsTable)
      .leftJoin(boardsToUsers, eq(boardsToUsers.userId, user.id))
      .where(
        and(
          eq(boardsToUsers.userId, user.id),
          eq(boardsToUsers.boardId, boardsTable.id)
        )
      );
  } catch (error) {
    console.log(error);
    return null;
  }

  return {
    boards,
    user,
  };
}

export type SimplifiedBoardState = {
  name: string;
  id: string;
};

export default function HomePage() {
  const data = useLoaderData<typeof loader>();
  const [boards, setBoards] = useState<SimplifiedBoardState[]>(
    data?.boards || []
  );

  useSocket({ queryKey: data?.user.id, setBoardsState: setBoards });

  return (
    <main className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto">
      <h2 className="text-5xl font-semibold md:mr-auto lg:pl-20 md:pl-44 mb-8">
        My Boards
      </h2>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
        {boards?.map((board) => (
          <BoardCard key={board.id} name={board.name} id={board.id} />
        ))}
        <BoardCard name="Create a new board" id="create" />
      </section>
    </main>
  );
}

function BoardCard({ name, id }: { name: string; id?: string }) {
  return (
    <Link className="" to={`/board/${id}`}>
      <article className="h-40 w-60 flex flex-col justify-center items-center bg-background border-[1px] rounded-xl dark:hover:bg-stone-950 dark:text-zinc-400 shadow-2xl dark:shadow-gray-900">
        {name}
      </article>
    </Link>
  );
}
