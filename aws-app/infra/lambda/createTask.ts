import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const body = JSON.parse(event.body || "{}");

  if (!body.taskText || typeof body.taskText !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "taskText is required" }) };
  }

  const now = new Date().toISOString();
  const task: Record<string, unknown> = {
    userId,
    taskId: randomUUID(),
    taskText: body.taskText,
    tags: Array.isArray(body.tags) ? body.tags : [],
    status: body.status ?? "Open",
    contactName: body.contactName ?? null,
    contactPhone: body.contactPhone ?? null,
    contactEmail: body.contactEmail ?? null,
    owner: body.owner ?? null,
    source: body.source ?? "Manual",
    createdAt: now,
    lastReminded: null,
    callOutcome: null,
  };

  // The byDueDate GSI's sort key must be a real string when present -- DynamoDB
  // rejects a NULL value there, so a missing due date just omits the attribute.
  if (body.dueDate) {
    task.dueDate = body.dueDate;
  }

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: task }));

  return { statusCode: 201, body: JSON.stringify(task) };
};
