import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "http://localhost:5174";
const EMAIL = process.env.E2E_EMAIL || "test@test.test";
const PASSWORD = process.env.E2E_PASSWORD || "testtest";
const RUNS = Number(process.env.DRAG_RUNS || 6);
const DEBUG = process.env.DRAG_DEBUG === "1";

async function getNodeCenter(page) {
  return page.evaluate(() => {
    const node = document.querySelector("#graph-svg g.nodes > g");
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  });
}

async function ensureGraphOpen(page) {
  await page.waitForSelector("#subject-buttons .subject-button, #graph-svg", {
    timeout: 20000,
  });
  await page.waitForSelector("#subject-buttons .subject-button", {
    timeout: 20000,
  });
  await page.click("#subject-buttons .subject-button").catch(() => {});
  await page.waitForSelector("#graph-svg g.nodes > g", { timeout: 20000 });
}

async function loginOnce(context) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    const path = await page.evaluate(() => window.location.pathname);
    if (path.includes("/login")) {
      await page.fill("#email", EMAIL);
      await page.fill("#password", PASSWORD);
      await page.click('button:has-text("Sign in")');
      await page.waitForFunction(
        () => {
          if (window.location.pathname !== "/login") return true;
          return Boolean(document.querySelector(".message.error"));
        },
        { timeout: 20000 },
      );

      const afterPath = await page.evaluate(() => window.location.pathname);
      if (afterPath.includes("/login")) {
        const message = await page
          .locator(".message.error")
          .first()
          .textContent()
          .catch(() => null);
        throw new Error(
          `Login did not transition away from /login${message ? `: ${message.trim()}` : "."}`,
        );
      }
    }

    await ensureGraphOpen(page);
  } finally {
    await page.close();
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await loginOnce(context);

    const jumpTolerance = 3;
    const firstMoveTolerance = 6;

    for (let i = 0; i < RUNS; i += 1) {
      const page = await context.newPage();
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await ensureGraphOpen(page);

      const before = await getNodeCenter(page);
      if (!before) {
        await page.close();
        throw new Error("Node center unavailable before drag.");
      }

      const start = { x: before.x, y: before.y };
      const target = { x: start.x + 24, y: start.y + 18 };

      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.waitForTimeout(16);

      const afterDown = await getNodeCenter(page);
      if (!afterDown) {
        await page.close();
        throw new Error("Node center unavailable after mousedown.");
      }

      const jumpDx = afterDown.x - start.x;
      const jumpDy = afterDown.y - start.y;
      if (DEBUG) {
        console.log(
          `[run ${i + 1}] start=(${start.x.toFixed(2)},${start.y.toFixed(2)}) afterDown=(${afterDown.x.toFixed(2)},${afterDown.y.toFixed(2)}) jump=(${jumpDx.toFixed(2)},${jumpDy.toFixed(2)})`,
        );
      }
      if (
        Math.abs(jumpDx) > jumpTolerance ||
        Math.abs(jumpDy) > jumpTolerance
      ) {
        await page.close();
        throw new Error(
          `Jump on drag start detected (run ${i + 1}): dx=${jumpDx.toFixed(2)}, dy=${jumpDy.toFixed(2)}`,
        );
      }

      const firstMoveTarget = { x: start.x + 3, y: start.y + 3 };
      await page.mouse.move(firstMoveTarget.x, firstMoveTarget.y, { steps: 2 });
      await page.waitForTimeout(20);

      const afterFirstMove = await getNodeCenter(page);
      await page.mouse.up();
      await page.close();

      if (!afterFirstMove) {
        throw new Error("Node center unavailable after first drag movement.");
      }

      const moveDx = afterFirstMove.x - firstMoveTarget.x;
      const moveDy = afterFirstMove.y - firstMoveTarget.y;
      if (DEBUG) {
        console.log(
          `[run ${i + 1}] firstMoveTarget=(${firstMoveTarget.x.toFixed(2)},${firstMoveTarget.y.toFixed(2)}) afterFirstMove=(${afterFirstMove.x.toFixed(2)},${afterFirstMove.y.toFixed(2)}) delta=(${moveDx.toFixed(2)},${moveDy.toFixed(2)})`,
        );
      }
      if (
        Math.abs(moveDx) > firstMoveTolerance ||
        Math.abs(moveDy) > firstMoveTolerance
      ) {
        throw new Error(
          `Drag first-move alignment failed (run ${i + 1}): dx=${moveDx.toFixed(2)}, dy=${moveDy.toFixed(2)}`,
        );
      }
    }

    await context.close();

    console.log(`PASS: No drag-start jump detected across ${RUNS} runs.`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
