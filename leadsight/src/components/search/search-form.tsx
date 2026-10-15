"use client";

export function SearchForm() {
  return (
    <form className="flex gap-2">
      <input placeholder="Business type..." className="flex-1 border rounded px-3 py-2" />
      <input placeholder="Location..." className="flex-1 border rounded px-3 py-2" />
      <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">
        Search
      </button>
    </form>
  );
}
