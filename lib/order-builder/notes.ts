import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LineItem } from "./types";
import { roundOrderQty } from "./qty";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function generateOrderNotes(
  lineItems: LineItem[],
): Promise<string> {
  const substitutions = lineItems.filter((li) => li.status === "substituted");
  const skips = lineItems.filter((li) => li.status === "skipped");
  const partials = lineItems.filter((li) => li.status === "partial");
  const flagged = lineItems.filter((li) => li.warnings.length > 0);

  const summary = {
    total_lines: lineItems.length,
    filled_count: lineItems.filter((li) => li.status === "filled").length,
    substitutions: substitutions.map((s) => ({
      original: s.substitution?.original_name,
      replacement: s.nwcs_name,
      qty: s.qty_ordered,
    })),
    skipped: skips.map((s) => ({
      sku: s.nwcs_name,
      reason: s.skip_reason,
    })),
    partials: partials.map((p) => ({
      sku: p.nwcs_name,
      qty_ordered: p.qty_ordered,
      qty_requested: roundOrderQty(p.mso),
    })),
    flagged: flagged.map((f) => ({
      sku: f.nwcs_name,
      warnings: f.warnings,
    })),
  };

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `You are summarizing a VMI draft order for a human reviewer at a cannabis wholesaler. Be concise and factual. Use short paragraphs and optional bullet points. Do not editorialize. Call out substitutions, skips, partials, and flagged items clearly so the reviewer can spot-check them.

Order summary data:
${JSON.stringify(summary, null, 2)}

Write the review note now.`,
      },
    ],
  });

  const first = response.content[0];
  return first && first.type === "text" ? first.text : "";
}
