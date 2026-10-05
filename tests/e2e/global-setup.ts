import { execSync } from "node:child_process";

/** Migrates and seeds the dedicated end-to-end database before the run. */
export default function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/zeke_e2e";
  const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: url, NODE_ENV: "development" };
  execSync("npx drizzle-kit migrate", { env, stdio: "inherit" });
  execSync("npm run db:seed", { env, stdio: "inherit" });
}
