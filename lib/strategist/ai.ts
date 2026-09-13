import Anthropic from "@anthropic-ai/sdk";

export async function explainStrategyWithAI(plan: unknown): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      system: `You are AutoSEO's strategy explainer. Explain the supplied deterministic SEO decision plan in concise plain language. Do not add new facts, causes, metrics or recommendations that are not present in the plan. Preserve uncertainty and correlation-only caveats. Return plain text only.`,
      messages: [{ role: "user", content: JSON.stringify(plan) }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block && block.type === "text" ? block.text.trim() : null;
  } catch {
    return null;
  }
}
