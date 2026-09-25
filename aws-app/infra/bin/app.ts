#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { TaskAgentStack } from "../lib/task-agent-stack";

const app = new App();

new TaskAgentStack(app, "TaskAgentStack", {
  env: {
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
});
