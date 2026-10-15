import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/lib/db/schema";

// Creates the user that the DISABLE_AUTH dev bypass impersonates, so user_id
// foreign keys resolve when auth is off.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const id = process.env.DEV_USER_ID ?? process.env.NEXT_PUBLIC_DEV_USER_ID;
  if (!id) throw new Error("DEV_USER_ID is not set");

  const client = postgres(url, { max: 1 });
  try {
    await drizzle(client)
      .insert(users)
      .values({ id, name: "Dev User", email: "dev@localhost", emailVerified: true })
      .onConflictDoNothing();
    console.log(`[seed] Dev user ${id} ready`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
