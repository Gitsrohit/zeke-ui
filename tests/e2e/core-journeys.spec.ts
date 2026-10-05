import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("core journeys", () => {
  test("redirects signed-out users and rejects bad credentials", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: undefined })).newPage();
    await page.goto("/my-work");
    await expect(page).toHaveURL(/\/login\?next=%2Fmy-work/);
    await page.getByLabel("Email").fill("maya.chen@zeke.dev");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").first()).toContainText(/invalid email or password/i);
  });

  test("login, navigate the dashboard and open an account", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Every account, one health signal" })).toBeVisible();
    await expect(page.getByText("Tracked accounts", { exact: false }).first()).toBeVisible();

    await page.getByRole("link", { name: "Renewal Forecast" }).click();
    await expect(page).toHaveURL(/tab=forecast/);

    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Dashboard", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: "Thistledown Nonprofit Alliance" });
    await row.click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: "Thistledown Nonprofit Alliance" })).toBeVisible();

    const sections = page.getByRole("navigation", { name: "Account sections" });
    await sections.getByRole("link", { name: "Health" }).click();
    await expect(sections.getByRole("link", { name: "Health" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Observed signal").first()).toBeVisible();
    await expect(page.getByText("AI inference").first()).toBeVisible();
  });

  test("build and save an audience, then launch an agent for it", async ({ page }) => {
    await page.goto("/audiences/new");
    await expect(page.getByText(/Matches\s+9\s+of\s+36 accounts/)).toBeVisible();

    await page.getByRole("button", { name: "Save audience" }).click();
    await page.getByLabel("Audience name").fill("E2E Adoption accounts");
    await page.getByRole("dialog").getByRole("button", { name: /save audience/i }).click();
    await expect(page).toHaveURL(/\/audiences\/[0-9a-f-]{36}/);
    await expect(page.getByText("E2E Adoption accounts").first()).toBeVisible();

    await page.getByRole("button", { name: "Launch agent" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/will be enrolled/)).toBeVisible();
    await dialog.getByRole("button", { name: /confirm & launch/i }).click();
    await expect(page.getByText(/launched for \d+ account/i)).toBeVisible();
  });

  test("Ask Zeke turns a sentence into reviewable filters", async ({ page }) => {
    await page.goto("/audiences/new");
    await page.getByRole("tab", { name: "Ask Zeke" }).click();
    await page.getByRole("textbox").last().fill("Enterprise accounts in Adoption with health score below 70");
    await page.keyboard.press("Enter");
    await expect(page.getByText(/review/i).first()).toBeVisible();
    await expect(page.getByText("Health Score less than 70").first()).toBeVisible();
  });

  test("complete a task from My Work", async ({ page }) => {
    await page.goto("/my-work?filter=manual");
    const items = page.getByRole("list", { name: "Work items" }).getByRole("listitem");
    const target = items.filter({ hasText: "Call exec sponsor about expansion into second department" });
    await expect(target).toBeVisible();
    await target.getByRole("button", { name: "Mark complete" }).click();
    await expect(target).toHaveCount(0);
    await page.goto("/my-work?view=completed");
    await expect(page.getByText("Call exec sponsor about expansion into second department")).toBeVisible();
  });

  test("completing an agent task advances the run to its next step", async ({ page }) => {
    await page.goto("/my-work?filter=agent");
    const item = page.getByRole("list", { name: "Work items" }).getByRole("listitem").filter({ hasText: "Pull health score breakdown and drivers" }).first();
    await expect(item).toBeVisible();
    const runHref = await item.getByRole("link", { name: /Red Account Review/ }).getAttribute("href");
    await item.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByText(/agent/i).first()).toBeVisible();
    await page.goto(runHref!);
    await expect(page.getByText("Internal account-planning session").first()).toBeVisible();
  });

  test("command palette searches across entities", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByPlaceholder(/search accounts, contacts/i).fill("Meridian");
    const account = page.getByRole("group", { name: "Accounts" }).getByRole("option", { name: /Meridian Health Systems/ });
    await expect(account).toBeVisible();
    await expect(page.getByRole("group", { name: "Contacts" })).toBeVisible();
    await account.click();
    await expect(page.getByRole("heading", { name: "Meridian Health Systems" })).toBeVisible();
  });

  test("viewers cannot reach admin-only areas", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: undefined })).newPage();
    await login(page, "riley.park@zeke.dev");
    await page.goto("/admin/audit");
    await expect(page.getByText(/don't have access/i)).toBeVisible();
  });
});
