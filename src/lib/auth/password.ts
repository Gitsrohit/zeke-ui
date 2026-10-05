import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(password: string, cost: number = COST): Promise<string> {
  return bcrypt.hash(password, cost);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    // Equalise timing for unknown users / OAuth-only accounts.
    await bcrypt.compare(password, "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.3t6Ld5c1uHn0fJ4n6Q0pN8kqgK7S");
    return false;
  }
  return bcrypt.compare(password, hash);
}
