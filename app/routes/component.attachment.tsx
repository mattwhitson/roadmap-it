import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { BoardData } from "@/components/providers/board-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperclipIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "@remix-run/react";
import { ActionFunctionArgs, json, useFetcher } from "react-router-dom";
import { authenticator } from "~/services.auth.server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "db";
import {
  activitiesTable,
  attachmentsTable,
  AttachmentWithDateAsString,
} from "db/schema";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_API_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
});

const MAX_FILE_SIZE = 1024 * 1024 * 1024 * 4;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg"];

const newAttacmentSchema = z.object({
  attachment: z
    .any()
    .refine((file) => file?.size <= MAX_FILE_SIZE, `Max image size is 4MB.`)
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
      "Only .jpg, .jpeg, .png and .webp formats are supported."
    ),
});

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  const formData = await request.formData();

  const values = {
    attachment: formData.get("attachment"),
  };

  const parsedFormData = newAttacmentSchema.safeParse(values);
  if (!parsedFormData.success) {
    return json({ message: parsedFormData.error.errors[0].message, ok: false });
  }
  const boardId = formData.get("boardId") as string;
  const cardId = formData.get("cardId") as string;

  if (!boardId || !cardId) {
    return json({ message: "Something went wrong.", ok: false });
  }
  const file: File = parsedFormData.data.attachment as File;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileId = `cardId/${cardId}/${uuidv4()}/${file.name}`;

  const putObjectCommand = new PutObjectCommand({
    Bucket: "roadmap-it",
    Key: fileId,
    Body: buffer,
  });

  try {
    const response = await r2.send(putObjectCommand);
    console.log(response);
  } catch (error) {
    console.error(error);
    return json({ message: "Attachment upload failed...", ok: false });
  }

  try {
    await db.insert(attachmentsTable).values({
      cardId: cardId,
      url: fileId,
    });
    await db.insert(activitiesTable).values({
      cardId: cardId,
      description: `attached ${file.name} to this card`,
      userId: user.id,
      userName: user.name || "",
    });
  } catch (error) {
    console.log(error);
    return json({ message: "Database error", ok: false });
  }

  return json({ message: "Attachment successfully uploaded!", ok: true });
}

export function AttachmentComponent({
  attachments,
  boardData,
}: {
  attachments: AttachmentWithDateAsString[] | undefined;
  boardData: BoardData;
}) {
  const editAttachments = useFetcher<typeof action>();
  const [isEditingAttachments, setIsEditingAttachments] = useState(false);
  const [attachment, setAttachment] = useState<File | undefined>(undefined);
  const [attachmentPath, setAttachmentPath] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const params = useParams();

  useEffect(() => {
    if (!editAttachments.data) return;
    console.log(editAttachments.data);
  }, [editAttachments.data]);

  function onAttachmentEditSubmit(values: z.infer<typeof newAttacmentSchema>) {
    setError(null);
    if (!isEditingAttachments) return;
    if (!params.cardId || !params.boardId) return;

    const parsed = newAttacmentSchema.safeParse(values);
    if (!parsed.success) {
      console.log(parsed);
      setError(parsed.error.errors[0].message);
      return;
    }

    if (attachmentPath === "") {
      setError("Attachment must be a file!");
      return;
    }

    const formData = new FormData();
    formData.append("attachment", values.attachment);
    formData.append("cardId", params.cardId);
    formData.append("boardId", params.boardId);

    editAttachments.submit(formData, {
      method: "post",
      encType: "multipart/form-data",
      action: "/component/attachment",
    });

    setIsEditingAttachments(false);
  }

  function handleDelete(attachmentId: string) {
    console.log(attachmentId);
  }

  return (
    <article>
      <div className="flex gap-x-4 items-center">
        <PaperclipIcon className="min-w-6 min-h-6" />
        <h4 className="text-lg font-semibold">Attachments</h4>
        {boardData.isMemberOfBoard && (
          <Button
            onClick={() => {
              setIsEditingAttachments((prev) => !prev);
              setAttachmentPath("");
            }}
            className="ml-auto h-8 w-12"
            variant="secondary"
            style={{
              width: isEditingAttachments ? "4rem" : "",
            }}
          >
            {isEditingAttachments ? "Cancel" : "Edit"}
          </Button>
        )}
      </div>
      <div>
        <div className="flex flex-col space-y-2 ml-8">
          {attachments?.map((attachment) => (
            <div className="flex items-center space-x-4" key={attachment.id}>
              <div className="h-28 w-52 overflow-hidden rounded-md border-[1px] mt-1">
                <img
                  src={`https://pub-71d63f3a0192409e98c503499c6c6aa0.r2.dev/${attachment.url}`}
                  alt={`attachment ${attachment.url}`}
                />
              </div>
              {boardData.isMemberOfBoard && (
                <Button
                  variant="ghost"
                  className="w-8 h-8 p-2"
                  onClick={() => handleDelete(attachment.id)}
                >
                  <TrashIcon />
                </Button>
              )}
            </div>
          ))}
        </div>
        {isEditingAttachments && (
          <>
            <Input
              value={attachmentPath}
              onChange={(e) => {
                setAttachment(e.target.files?.[0]);
                setAttachmentPath(e.target.value);
              }}
              type="file"
              className="mt-2 ml-9 w-56 sm:w-fit"
            />
            {error && <p className="text-destructive ml-9">{error}</p>}
            <Button
              className="w-12 h-8 mt-2 ml-9"
              variant="secondary"
              onClick={() => onAttachmentEditSubmit({ attachment })}
            >
              Save
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
