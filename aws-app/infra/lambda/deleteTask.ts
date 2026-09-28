import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const taskId = event.pathParameters?.taskId;

  if (!taskId) {
    return { statusCode: 400, body: JSON.stringify({ error: "taskId is required in the path" }) };
  }

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { userId, taskId },
    })
  );

  return { statusCode: 204, body: "" };
};
