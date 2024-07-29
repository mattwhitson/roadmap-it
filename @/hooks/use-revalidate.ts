import { useNavigate } from "@remix-run/react";
import { useCallback } from "react";

export function useRevalidate(url: string) {
  const navigate = useNavigate();

  return useCallback(
    function revalidate() {
      navigate(url, { replace: true });
    },
    [navigate, url]
  );
}
