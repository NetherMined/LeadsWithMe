"use client";

export type StorageMode = "drive" | "local";

const KEY = "leadsight_storage_mode";

export function getStorageMode(): StorageMode {
  if (typeof window === "undefined") return "drive";
  return (localStorage.getItem(KEY) as StorageMode) ?? "drive";
}

export function setStorageMode(mode: StorageMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, mode);
}
