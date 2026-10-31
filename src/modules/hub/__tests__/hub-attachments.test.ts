import assert from "node:assert/strict";
import {
  assertNoNewCloudinaryAttachments,
  assertNoNewCloudinaryUrl,
} from "../hub-attachments";

assert.doesNotThrow(() =>
  assertNoNewCloudinaryAttachments([
    { url: "https://drive.google.com/file/d/example/view" },
  ]),
);

assert.throws(
  () =>
    assertNoNewCloudinaryAttachments([
      { url: "https://res.cloudinary.com/example/new-file.pdf" },
    ]),
  /must be uploaded to Google Drive/i,
);

assert.doesNotThrow(() =>
  assertNoNewCloudinaryAttachments(
    [{ url: "https://res.cloudinary.com/example/existing-file.pdf" }],
    [{ url: "https://res.cloudinary.com/example/existing-file.pdf" }],
  ),
);

assert.throws(
  () => assertNoNewCloudinaryUrl("https://res.cloudinary.com/example/new.pdf"),
  /must be uploaded to Google Drive/i,
);

console.log("Course Hub attachment storage policy tests passed.");
