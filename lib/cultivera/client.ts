import "server-only";
import type { Browser, Page } from "playwright";
import { SELECTORS } from "./selectors";
import { parseInventoryTable, type RawInventoryRow } from "./parsers";
import {
  CulteveraLoginError,
  CulteveraScrapeError,
  type InventoryItem,
} from "./types";

const OVERALL_TIMEOUT_MS = 60_000;

/**
 * Cultivera Playwright client.
 *
 * Phase 2 scaffold — selectors are placeholders and must be regenerated via
 *   npx playwright codegen $CULTIVERA_URL
 * before this will work against the live site.
 *
 * Shape matches the Phase 2 spec: one static method, fresh browser per call,
 * in-process mutex so concurrent calls queue behind a single scrape.
 */
export class CulteveraClient {
  private static inFlight: Promise<InventoryItem[]> | null = null;

  static async fetchInventory(): Promise<InventoryItem[]> {
    if (CulteveraClient.inFlight) return CulteveraClient.inFlight;
    CulteveraClient.inFlight = CulteveraClient._fetchInventoryImpl().finally(() => {
      CulteveraClient.inFlight = null;
    });
    return CulteveraClient.inFlight;
  }

  private static async _fetchInventoryImpl(): Promise<InventoryItem[]> {
    const url = requireEnv("CULTIVERA_URL");
    const username = requireEnv("CULTIVERA_USERNAME");
    const password = requireEnv("CULTIVERA_PASSWORD");

    // Dynamic import so the build doesn't fail on machines without the
    // Playwright browser download.
    const { chromium } = await import("playwright");

    const browser: Browser = await chromium.launch({ headless: true });
    const deadline = Date.now() + OVERALL_TIMEOUT_MS;
    try {
      return await withTimeout(
        OVERALL_TIMEOUT_MS,
        CulteveraClient._scrape(browser, { url, username, password, deadline }),
      );
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  private static async _scrape(
    browser: Browser,
    opts: { url: string; username: string; password: string; deadline: number },
  ): Promise<InventoryItem[]> {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // --- Login ---
    try {
      await page.goto(`${opts.url.replace(/\/$/, "")}/login`);
      await page.fill(SELECTORS.login.username, opts.username);
      await page.fill(SELECTORS.login.password, opts.password);
      await page.click(SELECTORS.login.submit);
      await page.waitForSelector(SELECTORS.dashboard.marker, { timeout: 15_000 });
    } catch (e) {
      throw new CulteveraLoginError(
        `Login failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    // --- Navigate to inventory ---
    try {
      await page.click(SELECTORS.nav.inventoryTab);
      await page.waitForSelector(SELECTORS.inventory.tableReady, { timeout: 15_000 });
    } catch (e) {
      throw new CulteveraScrapeError(
        `Inventory page did not load: ${e instanceof Error ? e.message : String(e)}`,
        page.url(),
      );
    }

    // --- Scrape all rows ---
    const raw = await CulteveraClient._scrapeAllPages(page);
    if (raw.length === 0) {
      throw new CulteveraScrapeError(
        "Inventory table parsed 0 rows — DOM likely changed.",
        page.url(),
      );
    }
    return parseInventoryTable(raw);
  }

  /**
   * Phase 2 kickoff: decide between pagination, infinite scroll, and load-more
   * AFTER observing the live Cultivera UI. The placeholder below assumes
   * plain pagination with a "next" button.
   */
  private static async _scrapeAllPages(page: Page): Promise<RawInventoryRow[]> {
    const collected: RawInventoryRow[] = [];

    for (;;) {
      const pageRows = await page.$$eval(
        SELECTORS.inventory.rows,
        (rows, sels) =>
          rows.map((r) => ({
            sku:
              (r.querySelector(sels.cellSku) as HTMLElement | null)?.textContent ??
              null,
            name:
              (r.querySelector(sels.cellName) as HTMLElement | null)?.textContent ??
              null,
            on_hand:
              (r.querySelector(sels.cellOnHand) as HTMLElement | null)
                ?.textContent ?? null,
          })),
        {
          cellSku: SELECTORS.inventory.cellSku,
          cellName: SELECTORS.inventory.cellName,
          cellOnHand: SELECTORS.inventory.cellOnHand,
        },
      );
      collected.push(...pageRows);

      const next = await page.$(SELECTORS.inventory.nextPage);
      if (!next) break;
      const disabled = await next.getAttribute("aria-disabled");
      if (disabled === "true") break;
      await next.click();
      await page.waitForSelector(SELECTORS.inventory.tableReady, {
        timeout: 15_000,
      });
    }

    return collected;
  }
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

function withTimeout<T>(ms: number, p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new CulteveraScrapeError(`Scrape timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
