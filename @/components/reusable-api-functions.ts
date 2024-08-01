import { r2 } from "@/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { json } from "@remix-run/node";

export async function deleteCardAttachments(attachmentKeys: string[]) {
  for (const key of attachmentKeys) {
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: "roadmap-it",
      Key: key,
    });

    try {
      await r2.send(deleteObjectCommand);
    } catch (error) {
      console.error(error);
      return json({ message: "Cloudflare R2 Error", ok: false });
    }
  }
}
