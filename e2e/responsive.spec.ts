import { expect, test, type Page } from "@playwright/test";

const RELAY = "http://127.0.0.1:8098";
const CONSOLE = "http://127.0.0.1:4181";
const control = (page: Page, body: object) => page.request.post(`${RELAY}/api/control?t=e2e`, { data: body });

/** The layout rules every page keeps at every width. */
async function expectFits(page: Page, where: string) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const clipped = (el: Element) => { // inside a container that scrolls or clips sideways on purpose
      for (let a = el.parentElement; a; a = a.parentElement) if (/(auto|hidden|scroll|clip)/.test(getComputedStyle(a).overflowX)) return true;
      return false;
    };
    const wide = [...document.body.querySelectorAll("*")]
      .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > vw + 1 && !clipped(el); })
      .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} → ${Math.round(el.getBoundingClientRect().right)}px`);
    const smallInputs = [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea")]
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16 && (el as HTMLElement).offsetParent).map((el) => el.id || el.tagName);
    const looping = document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations === Infinity).map((a) => (a as CSSAnimation).animationName ?? "animation");
    return { scroll: document.documentElement.scrollWidth - vw, wide, smallInputs, looping };
  });
  expect.soft(r.scroll, `${where}: the page scrolls sideways`).toBeLessThanOrEqual(1);
  expect.soft(r.wide, `${where}: elements wider than the screen`).toEqual([]);
  expect.soft(r.looping, `${where}: animations must not loop forever`).toEqual([]);
  if ((page.viewportSize()?.width ?? 1000) < 600) expect.soft(r.smallInputs, `${where}: inputs under 16px zoom on iOS`).toEqual([]);
}

test.describe("console", () => {
  test("sign-in fits and settles", async ({ page }) => {
    await page.goto(`${CONSOLE}/signin`);
    await expect(page.getByRole("heading", { name: "Run the room." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
    await page.waitForTimeout(2500); // the arrival animation has finished
    await expectFits(page, "sign-in");
  });

  test("sign-in has no motion when the viewer asks for less", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${CONSOLE}/signin`);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("the console itself needs a session", async ({ page }) => {
    await page.goto(CONSOLE);
    await expect(page).toHaveURL(/\/signin$/);
  });
});

test.describe("relay", () => {
  test.describe.configure({ mode: "serial" }); // one shared room

  test("phone: the join gate, then every Signals scene", async ({ page, browser }) => {
    await control(page, { op: "start", w: 5 });
    const fresh = await browser.newPage({ viewport: page.viewportSize() ?? undefined });
    await fresh.goto(RELAY);
    await expect(fresh.getByRole("heading", { name: "Join the workshop" })).toBeVisible();
    await expectFits(fresh, "join gate");
    await fresh.close();

    await page.goto(`${RELAY}/?c=424242`);
    await expect(page.locator("#where")).not.toHaveText(/Joining|Code needed/);
    const n = (await (await page.request.get(`${RELAY}/api/screen?t=e2e`)).json()).n as number;
    for (let i = 0; i < n; i++) {
      await control(page, { op: "goto", i });
      await page.reload();
      await expect(page.locator("main h1:visible").first()).toBeVisible();
      await expectFits(page, `phone scene ${i + 1}/${n}`);
    }
  });

  test("big screen: every Signals scene", async ({ page }) => {
    test.setTimeout(120_000); // one poll per scene, ~30 scenes
    test.skip((page.viewportSize()?.width ?? 0) < 1200, "the big screen is a projector");
    await control(page, { op: "start", w: 5 });
    const n = (await (await page.request.get(`${RELAY}/api/screen?t=e2e`)).json()).n as number;
    await page.goto(`${RELAY}/screen?t=e2e`);
    for (let i = 0; i < n; i++) {
      await control(page, { op: "goto", i });
      await page.waitForTimeout(1100); // one poll
      await expectFits(page, `screen scene ${i + 1}/${n}`);
    }
  });

  test("home page: the links, open while every room is closed", async ({ page }) => {
    await page.goto(`${RELAY}/hub`);
    await expect(page.getByRole("heading", { name: "Ofri Peretz" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Ofri Peretz elsewhere" }).getByRole("link")).toHaveCount(4);
    await expectFits(page, "home");
  });

  test("waiting room, intro and outro carry the links", async ({ page }) => {
    await control(page, { op: "start", w: 5, intro: "returning" });
    await page.goto(`${RELAY}/?c=424242`);
    await expect(page.getByRole("heading", { name: "Starting soon" })).toBeVisible();
    await expect(page.locator(".findme a")).toHaveCount(4);
    await expectFits(page, "waiting room");
    await control(page, { op: "begin" });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator(".findme a")).toHaveCount(4);
    const n = (await (await page.request.get(`${RELAY}/api/screen?t=e2e`)).json()).n as number;
    await control(page, { op: "goto", i: n - 1 });
    await page.reload();
    await expect(page.locator("main h1:visible").first()).toHaveText("Questions");
    await expect(page.locator(".findme a")).toHaveCount(4);
    await expectFits(page, "outro");
  });

  test("status page", async ({ page }) => {
    await page.goto(`${RELAY}/status`);
    await expect(page.locator("#banner")).not.toBeEmpty();
    await expectFits(page, "status");
  });
});
