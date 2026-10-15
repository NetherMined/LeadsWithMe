import type { Business } from "@/types/business";

interface SearchResultsProps {
  businesses?: Business[];
  loading?: boolean;
}

export function SearchResults({ businesses = [], loading = false }: SearchResultsProps) {
  if (loading) return <div>Loading...</div>;
  if (!businesses.length) return <div>No results found.</div>;
  return (
    <ul className="space-y-2">
      {businesses.map((b) => (
        <li key={b.id} className="border rounded p-4">
          <h3 className="font-semibold">{b.name}</h3>
          <p className="text-sm text-muted-foreground">{b.address}</p>
        </li>
      ))}
    </ul>
  );
}
