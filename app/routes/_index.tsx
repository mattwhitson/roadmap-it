import { Button } from "@/components/ui/button";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { authenticator } from "~/services.auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Chart the Future" }, { name: "description", content: "" }];
};

export async function loader({ request }: LoaderFunctionArgs) {
  return await authenticator.isAuthenticated(request, {
    successRedirect: "/home",
  });
}

export default function Index() {
  return (
    <main className="p-4 h-full flex flex-col max-w-5xl mx-auto items-center justify-center gap-y-4 text-center">
      <h1 className="text-7xl font-extrabold">RoadMap It.</h1>
      <p className="font-semibold text-lg">
        You&apos;re search for the perfect home for your roadmap is over
      </p>
      <Button className="mt-4 rounded-xl" asChild>
        <Link to="/login">Get started</Link>
      </Button>
      <p className="text-lg mt-5 max-w-xl">
        Task organization just became a whole lot easier. Easily create,
        organize, and iterate on tasks that you won&apos;t lose track of a week
        from now.
      </p>
    </main>
  );
}
