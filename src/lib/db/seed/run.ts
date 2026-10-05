import "dotenv/config";
import { closeDatabase } from "@/lib/db/client";
import { seedDatabase } from "./seed";
import { SEED_PASSWORD, SEED_USERS } from "./data";

async function main() {
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed in production (this wipes all data). Pass --force if you really mean it.");
  }
  const started = Date.now();
  const summary = await seedDatabase({ log: (m) => process.stdout.write(`• ${m}\n`) });
  process.stdout.write(`\nSeeded ${summary.accounts} accounts and ${summary.users} users in ${((Date.now() - started) / 1000).toFixed(1)}s.\n`);
  process.stdout.write(`Sign in with any of these (password: ${SEED_PASSWORD}):\n`);
  for (const u of SEED_USERS.filter((x) => x.status === "active")) process.stdout.write(`  ${u.email.padEnd(26)} ${u.role}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed failed: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
