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
  const task = {
    userId,
    taskId: randomUUID(),
    taskText: body.taskText,
    tags: Array.isArray(body.tags) ? body.tags : [],
    status: body.status ?? "Open",
    dueDate: body.dueDate ?? null,
    contactName: body.contactName ?? null,
    contactPhone: body.contactPhone ?? null,
    contactEmail: body.contactEmail ?? null,
    source: body.source ?? "Manual",
    createdAt: now,
    lastReminded: null,
    callOutcome: null,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: task }));

  return { statusCode: 201, body: JSON.stringify(task) };
};
