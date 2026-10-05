import { expect, test } from "@playwright/test";

test("mobile layout uses drawer navigation without horizontal overflow", async ({ page }) => {
  for (const path of ["/dashboard", "/my-work", "/outcomes", "/audiences/new", "/agents"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${path} overflows horizontally`).toBe(false);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "My Work" }).click();
  await expect(page).toHaveURL(/\/my-work/);
});
