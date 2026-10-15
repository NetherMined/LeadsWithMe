import { google } from "googleapis";

function getAuthClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export async function getOrCreateLeadSightFolder(accessToken: string): Promise<string> {
  const auth = getAuthClient(accessToken);
  const drive = google.drive({ version: "v3", auth });

  const search = await drive.files.list({
    q: "name='LeadSight' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id)",
    spaces: "drive",
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: "LeadSight",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return folder.data.id!;
}

/** Gets or creates `LeadSight/{businessName}/` and returns its folder ID. */
export async function getOrCreateBusinessFolder(
  accessToken: string,
  businessName: string,
  parentFolderId: string
): Promise<string> {
  const auth = getAuthClient(accessToken);
  const drive = google.drive({ version: "v3", auth });

  // Sanitise folder name (Drive doesn't allow some chars)
  const safeName = businessName.replace(/[<>:"/\\|?*\r\n]/g, "").trim() || "Business";

  const search = await drive.files.list({
    q: `name='${safeName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id",
  });

  return folder.data.id!;
}

export async function moveFileToFolder(
  accessToken: string,
  fileId: string,
  folderId: string
): Promise<void> {
  const auth = getAuthClient(accessToken);
  const drive = google.drive({ version: "v3", auth });

  const file = await drive.files.get({ fileId, fields: "parents" });
  const previousParents = (file.data.parents ?? []).join(",");

  await drive.files.update({
    fileId,
    addParents: folderId,
    removeParents: previousParents,
    fields: "id, parents",
  });
}