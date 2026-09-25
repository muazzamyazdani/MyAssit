import * as path from "path";
import {
  Stack,
  StackProps,
  RemovalPolicy,
  CfnOutput,
  aws_dynamodb as dynamodb,
  aws_cognito as cognito,
  aws_lambda as lambda,
  aws_apigatewayv2 as apigwv2,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { Construct } from "constructs";

export class TaskAgentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // --- Data store ---
    // Single-table design: partition key is the Cognito user id, so every
    // query is naturally scoped to one user. See ../../README.md for the
    // reasoning behind DynamoDB + a "tags" list instead of a fixed category.
    const tasksTable = new dynamodb.Table(this, "TasksTable", {
      tableName: "TaskAgent-Tasks",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "taskId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Lets the reminder job efficiently ask "what's due for this user,
    // in order" instead of scanning every task.
    tasksTable.addGlobalSecondaryIndex({
      indexName: "byDueDate",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "dueDate", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- Auth ---
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "TaskAgentUsers",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      authFlows: { userSrp: true, userPassword: true },
      generateSecret: false,
    });

    // --- API Lambdas ---
    const commonEnv = { TABLE_NAME: tasksTable.tableName };
    const lambdaDir = path.join(__dirname, "..", "lambda");

    const createTaskFn = new NodejsFunction(this, "CreateTaskFn", {
      entry: path.join(lambdaDir, "createTask.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: commonEnv,
    });
    tasksTable.grantWriteData(createTaskFn);

    const listTasksFn = new NodejsFunction(this, "ListTasksFn", {
      entry: path.join(lambdaDir, "listTasks.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: commonEnv,
    });
    tasksTable.grantReadData(listTasksFn);

    const updateTaskFn = new NodejsFunction(this, "UpdateTaskFn", {
      entry: path.join(lambdaDir, "updateTask.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: commonEnv,
    });
    tasksTable.grantReadWriteData(updateTaskFn);

    // --- API Gateway (HTTP API, Cognito JWT authorizer) ---
    const authorizer = new HttpUserPoolAuthorizer("Authorizer", userPool, {
      userPoolClients: [userPoolClient],
    });

    const httpApi = new apigwv2.HttpApi(this, "TaskAgentApi", {
      apiName: "task-agent-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowHeaders: ["*"],
      },
    });

    httpApi.addRoutes({
      path: "/tasks",
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateTaskIntegration", createTaskFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/tasks",
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration("ListTasksIntegration", listTasksFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: "/tasks/{taskId}",
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration("UpdateTaskIntegration", updateTaskFn),
      authorizer,
    });

    // --- Outputs the mobile/web apps will need ---
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "TableName", { value: tasksTable.tableName });
  }
}
