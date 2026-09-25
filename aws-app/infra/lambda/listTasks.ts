import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const status = event.queryStringParameters?.status;

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": userId },
    })
  );

  let items = result.Items ?? [];
  if (status) {
    items = items.filter((item) => item.status === status);
  }

  return { statusCode: 200, body: JSON.stringify(items) };
};
