import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

const bedrock = new BedrockRuntimeClient({});
// Override via the BEDROCK_MODEL_ID env var if this model isn't enabled/available
// in your account's Bedrock "Model access" page for this region.
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";

const SYSTEM_PROMPT = `You turn pasted, freeform text (notes, meeting minutes, a to-do list, a forwarded message) into a list of individual tasks.

Rules:
- Split the input into one entry per distinct task/action item. A single sentence is usually one task; a list or paragraph may contain several.
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

    const raw = response.output?.message?.content?.[0]?.text || "[]";
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
