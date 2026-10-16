// Places v1 photo resource name, e.g. places/ChIJ.../photos/AUc7...
export const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/** Key-free URL for a Places photo, served by GET /api/places/photo. */
export function placePhotoPath(name: string): string {
  return `/api/places/photo?name=${encodeURIComponent(name)}`;
}
