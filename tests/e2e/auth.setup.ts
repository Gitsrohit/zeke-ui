import { test as setup } from "@playwright/test";
import { login } from "./helpers";

/** Signs in once and stores the session, so specs don't trip the sign-in rate limit. */
setup("authenticate as Maya", async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: "playwright/.auth/maya.json" });
});
