import { useSocketContext } from "@/components/providers/socket-provider";
import { useLocation, useNavigate, useRevalidator } from "@remix-run/react";
import { useEffect } from "react";

export function useSocket(queryKey?: string, route?: string) {
  const socket = useSocketContext();
  const navigate = useNavigate();
  const location = useLocation();
  const revalidator = useRevalidator();

  useEffect(() => {
    if (!socket || !queryKey) return;

    socket.on(queryKey, () => {
      console.log(location.pathname);
      if (location.pathname === route) {
        console.log(location.pathname, route);
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
  ]);

  return { socket };
}
