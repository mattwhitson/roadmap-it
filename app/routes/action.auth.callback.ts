import { LoaderFunction, LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services.auth.server";

export const loader: LoaderFunction = async ({
  request,
}: LoaderFunctionArgs) => {
  return authenticator.authenticate("google", request, {
    successRedirect: "/home",
    failureRedirect: "/login",
  });
};
