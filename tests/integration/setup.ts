import "dotenv/config";

// Integration tests always run against the dedicated test database.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("TEST_DATABASE_URL must be set to run integration tests");
if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL — tests wipe the database");
process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.AI_API_KEY = "";
