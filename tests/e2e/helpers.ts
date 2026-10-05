import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email = "maya.chen@zeke.dev", password = "zeke-demo-2026") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
