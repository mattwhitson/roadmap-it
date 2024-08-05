import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ActionFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services.auth.server";
import { json, useFetcher, useNavigate } from "@remix-run/react";
import { db } from "db";
import { boardsTable, boardsToUsers } from "db/schema";
import { useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const formSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string(),
  isPublic: z.boolean(),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const formData = await request.json();
  const result = formSchema.safeParse(formData);

  if (!result.success) {
    return json({ message: "Something went wrong", ok: false, id: null });
  }

  const { data } = result;

  let newBoard;
  try {
    newBoard = await db
      .insert(boardsTable)
      .values({
        createdBy: user.id,
        name: data.name,
        description: data.description,
        public: data.isPublic || false,
      })
      .returning();

    await db.insert(boardsToUsers).values({
      boardId: newBoard[0].id,
      userId: user.id,
    });
  } catch (error) {
    console.error(error);
    return json({ message: "Database error.", ok: false, id: null });
  }
  return {
    message: "Board successfully created!",
    ok: true,
    id: newBoard[0].id,
  };
}

export default function CreateBoardPage() {
  const navigate = useNavigate();
  const createBoard = useFetcher<typeof action>();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      isPublic: false,
    },
  });

  useEffect(() => {
    if (!createBoard.data) return;
    toast(createBoard.data.message);
    if (createBoard.data.ok) {
      navigate(`/board/${createBoard.data.id}`);
    }
  }, [createBoard.data, navigate]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);

    createBoard.submit(values, {
      method: "post",
      encType: "application/json",
    });
  }
  return (
    <div className="h-full flex flex-col justify-center items-center mx-2">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-8 bg-background rounded-md border-[1px] p-4 shadow-2xl dark:shadow-gray-900 w-full sm:w-96"
        >
          <h1 className="font-bold text-2xl mt-2">Create Board</h1>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Board name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Upcoming Features"
                    {...field}
                    className="text-base sm:text-sm"
                  />
                </FormControl>
                <FormDescription className="sr-only">
                  Enter your board name
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="A list of upcoming features for our new app"
                    {...field}
                    className="text-base sm:text-sm"
                  />
                </FormControl>
                <FormDescription className="sr-only">
                  Enter your board description
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPublic"
            render={({ field }) => (
              <FormItem className="flex items-center">
                <FormLabel>Should this board be public?</FormLabel>
                <FormControl>
                  <Checkbox
                    onCheckedChange={field.onChange}
                    className="translate-y-[-25%] ml-2"
                  />
                </FormControl>
                <FormDescription className="sr-only">
                  Enter your board description
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Submit</Button>
        </form>
      </Form>
    </div>
  );
}
