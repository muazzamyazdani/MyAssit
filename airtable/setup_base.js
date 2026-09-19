#!/usr/bin/env node
/**
 * Creates or verifies the Airtable "Tasks" table against airtable/schema.json.
 *
 * Usage:
 *   node setup_base.js create   # creates a brand new base (needs AIRTABLE_WORKSPACE_ID)
 *                                # or adds the Tasks table to an existing base
 *                                # (needs AIRTABLE_BASE_ID)
 *   node setup_base.js verify   # fetches the existing table schema and diffs
 *                                # it against schema.json (needs AIRTABLE_BASE_ID)
 *
 * Reads credentials from environment variables (see ../.env.example):
 *   AIRTABLE_PERSONAL_ACCESS_TOKEN
 *   AIRTABLE_BASE_ID (optional for create, required for verify)
 *   AIRTABLE_WORKSPACE_ID (required for create when AIRTABLE_BASE_ID is unset)
 */

const fs = require("fs");
const path = require("path");

const API_ROOT = "https://api.airtable.com/v0";

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function airtableFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Airtable API error ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return process.env[name];
}

async function create(schema) {
  requireEnv("AIRTABLE_PERSONAL_ACCESS_TOKEN");
  const baseId = process.env.AIRTABLE_BASE_ID;

  const tableDef = {
    name: schema.tableName,
    description: schema.description,
    fields: schema.fields,
  };

  if (baseId) {
    console.log(`Adding table "${schema.tableName}" to existing base ${baseId}...`);
    const result = await airtableFetch(`${API_ROOT}/meta/bases/${baseId}/tables`, {
      method: "POST",
      body: JSON.stringify(tableDef),
    });
    console.log(`Created table: ${result.id} (${result.name})`);
    return;
  }

  const workspaceId = requireEnv("AIRTABLE_WORKSPACE_ID");
  console.log(`Creating new base "Task Agent" in workspace ${workspaceId}...`);
  const result = await airtableFetch(`${API_ROOT}/meta/bases`, {
    method: "POST",
    body: JSON.stringify({
      name: "Task Agent",
      workspaceId,
      tables: [tableDef],
    }),
  });
  console.log(`Created base: ${result.id}`);
  console.log(`Set AIRTABLE_BASE_ID=${result.id} in your .env file.`);
}

async function verify(schema) {
  requireEnv("AIRTABLE_PERSONAL_ACCESS_TOKEN");
  const baseId = requireEnv("AIRTABLE_BASE_ID");

  const { tables } = await airtableFetch(`${API_ROOT}/meta/bases/${baseId}/tables`);
  const table = tables.find((t) => t.name === schema.tableName);

  if (!table) {
    console.log(`MISSING: no table named "${schema.tableName}" found in this base.`);
    console.log(`Existing tables: ${tables.map((t) => t.name).join(", ") || "(none)"}`);
    process.exitCode = 1;
    return;
  }

  const existingFields = new Map(table.fields.map((f) => [f.name, f]));
  const problems = [];

  for (const expected of schema.fields) {
    const actual = existingFields.get(expected.name);
    if (!actual) {
      problems.push(`- MISSING field "${expected.name}" (expected type ${expected.type})`);
      continue;
    }
    if (actual.type !== expected.type) {
      problems.push(
        `- TYPE MISMATCH on "${expected.name}": expected ${expected.type}, found ${actual.type}`
      );
    }
    if (expected.options?.choices) {
      const expectedChoices = new Set(expected.options.choices.map((c) => c.name));
      const actualChoices = new Set((actual.options?.choices || []).map((c) => c.name));
      for (const choice of expectedChoices) {
        if (!actualChoices.has(choice)) {
          problems.push(`- MISSING option "${choice}" on field "${expected.name}"`);
        }
      }
    }
  }

  if (problems.length === 0) {
    console.log(`OK: "${schema.tableName}" matches the plan (${schema.fields.length} fields).`);
  } else {
    console.log(`Found ${problems.length} issue(s) in "${schema.tableName}":`);
    console.log(problems.join("\n"));
    process.exitCode = 1;
  }
}

async function main() {
  loadEnvFile();
  const mode = process.argv[2];
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "schema.json"), "utf8"));

  if (mode === "create") {
    await create(schema);
  } else if (mode === "verify") {
    await verify(schema);
  } else {
    console.error("Usage: node setup_base.js <create|verify>");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
