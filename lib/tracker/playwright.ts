import "server-only";
import type { Page } from "playwright";
import type { CartBuildTracker } from "./tracker";
import type { ActionResult, SelectorKind } from "./types";

/**
 * Wrap a Playwright Page so every interaction auto-logs selector + result +
 * timing to cart_build_actions — no hand-logging at the call sites.
 *
 * The future CulteveraClient should drive this wrapped page instead of the raw
 * one. Each method times the underlying call, classifies the result, and logs
 * it. Errors are logged as 'fail' then re-thrown so control flow is unchanged.
 *
 *   const tp = wrapTrackedPage(page, tracker, () => currentLineId);
 *   await tp.goto(url);
 *   await tp.click('button:has-text("Add To Cart")');
 *
 * `getLineId` lets actions be attributed to the line currently being built;
 * return null for cross-line actions (initial nav, review order).
 */
export function wrapTrackedPage(
  page: Page,
  tracker: CartBuildTracker,
  getLineId: () => string | null = () => null,
) {
  function classifyKind(selector: string): SelectorKind {
    if (selector.startsWith("role=") || /get_by_role/i.test(selector)) return "role";
    if (selector.startsWith("text=") || selector.includes(":has-text(")) return "text";
    return "css";
  }

  async function run<T>(
    action: string,
    selector: string | null,
    fn: () => Promise<T>,
    opts: { inputValue?: string; targetDescription?: string } = {},
  ): Promise<T> {
    const started = Date.now();
    let result: ActionResult = "ok";
    let resultDetail: string | null = null;
    try {
      const out = await fn();
      return out;
    } catch (e) {
      result = "fail";
      resultDetail = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      await tracker.logAction({
        cartBuildLineId: getLineId(),
        action,
        selectorKind: selector ? classifyKind(selector) : "none",
        selector,
        targetDescription: opts.targetDescription ?? null,
        inputValue: opts.inputValue ?? null,
        result,
        resultDetail,
        durationMs: Date.now() - started,
        mcpTool: null,
      });
    }
  }

  return {
    /** The raw page, if you need an un-tracked escape hatch. */
    raw: page,

    goto: (url: string) =>
      run("navigate", url, () => page.goto(url), { targetDescription: url }),

    click: (selector: string) =>
      run("click", selector, () => page.click(selector)),

    fill: (selector: string, value: string) =>
      run("type", selector, () => page.fill(selector, value), {
        inputValue: value,
      }),

    type: (selector: string, value: string) =>
      run("type", selector, () => page.type(selector, value), {
        inputValue: value,
      }),

    selectOption: (selector: string, value: string) =>
      run("select", selector, () => page.selectOption(selector, value), {
        inputValue: value,
      }),

    waitForSelector: (selector: string) =>
      run("wait", selector, () => page.waitForSelector(selector)),
  };
}

export type TrackedPage = ReturnType<typeof wrapTrackedPage>;
