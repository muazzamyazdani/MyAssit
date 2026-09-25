import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

// One generic update endpoint powers Close, Snooze, Reassign-category, and
// manual edits alike — the client just sends whichever fields changed.
const ALLOWED_FIELDS = [
  "taskText",
  "tags",
  "status",
  "dueDate",
  "contactName",
  "contactPhone",
  "contactEmail",
  "lastReminded",
  "callOutcome",
];

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const taskId = event.pathParameters?.taskId;

  if (!taskId) {
    return { statusCode: 400, body: JSON.stringify({ error: "taskId is required in the path" }) };
  }

  const body = JSON.parse(event.body || "{}");
  const updates = Object.keys(body).filter((key) => ALLOWED_FIELDS.includes(key));

  if (updates.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "No valid fields to update" }) };
  }

  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  updates.forEach((key, i) => {
    names[`#f${i}`] = key;
    values[`:v${i}`] = body[key];
  });

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { userId, taskId },
      UpdateExpression: "SET " + updates.map((_, i) => `#f${i} = :v${i}`).join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(taskId)",
      ReturnValues: "ALL_NEW",
    })
  );

  return { statusCode: 200, body: JSON.stringify(result.Attributes) };
};
