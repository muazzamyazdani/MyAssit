import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

const bedrock = new BedrockRuntimeClient({});
// Override via the BEDROCK_MODEL_ID env var if this model isn't enabled/available
// in your account's Bedrock "Model access" page for this region.
// Amazon's own Nova models bill directly through AWS (no AWS Marketplace
// subscription step required), unlike third-party models such as Anthropic's.
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.amazon.nova-2-lite-v1:0";

const SYSTEM_PROMPT = `You turn pasted, freeform text (notes, meeting minutes, a to-do list, a forwarded message) into a list of individual tasks.

Rules:
- Split the input into one entry per distinct task/action item. A single sentence is usually one task; a list or paragraph may contain several. Even if the whole input describes just one task, return an array with exactly one element -- never return an empty array unless the input truly contains no actionable task at all.
- For each task, extract a due date ONLY if one is stated or clearly implied (e.g. "by Friday", "tomorrow", "Oct 5"). Resolve relative dates using today's date, given below. If no date is mentioned, use null -- do not guess one.
- Generate 1-3 short, lowercase, single-word-or-hyphenated tags per task that categorize it (e.g. "finance", "procurement", "follow-up"). No "#" prefix in the output -- that's added by the UI.
- If a person's name is clearly responsible for or mentioned as the owner of the task, extract it as "owner"; otherwise null.
- Reply with ONLY a JSON array, no prose, no markdown fences. Example:
[{"taskText": "Call Sajid for a delivery update", "dueDate": "2026-10-01", "tags": ["procurement"], "owner": "Sajid"}]`;

function extractJsonArray(text: string): unknown[] {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) throw new Error("Model did not return a JSON array");
  return parsed;
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const body = JSON.parse(event.body || "{}");
  const text = (body.text || "").trim();

  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: "text is required" }) };
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const response = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: `${SYSTEM_PROMPT}\n\nToday's date: ${today}` }],
        messages: [{ role: "user", content: [{ text }] }],
        inferenceConfig: { maxTokens: 2000, temperature: 0 },
      })
    );

    // Nova's hybrid-reasoning models can put a "reasoning" block before the
    // actual answer, so content[0] isn't reliably the text -- scan for it.
    const content = response.output?.message?.content ?? [];
    const raw = content.find((block) => typeof block.text === "string")?.text || "[]";
    console.log("Bedrock raw response:", JSON.stringify(content));
    const tasks = extractJsonArray(raw);

    return { statusCode: 200, body: JSON.stringify({ tasks }) };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 502,
      body: JSON.stringify({
        error:
          "Could not parse tasks with Bedrock. Check that the model is enabled under Bedrock > Model access in this AWS region.",
      }),
    };
  }
};
