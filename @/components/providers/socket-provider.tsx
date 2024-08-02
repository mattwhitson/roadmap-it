import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { DefaultEventsMap } from "node_modules/socket.io/dist/typed-events";
import { User } from "db/schema";

export function connect() {
  return io("http://localhost:3000");
}

export const SocketContext = createContext<
  Socket<DefaultEventsMap, DefaultEventsMap> | undefined
>(undefined);

export const useSocketContext = () => useContext(SocketContext);

export function SocketProvider({
  user,
  children,
}: {
  user: User | undefined;
  children: React.ReactNode;
}) {
  const [socket, setSocket] =
    useState<Socket<DefaultEventsMap, DefaultEventsMap>>();

  useEffect(() => {
    if (!user) return;
    const connection = connect();
    setSocket(connection);
    return () => {
      connection.close();
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    socket.on("event", (data) => {
      console.log(data);
    });
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
