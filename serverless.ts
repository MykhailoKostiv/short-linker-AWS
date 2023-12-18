import type { AWS } from "@serverless/typescript";
import createLink from "@functions/createLink";
import manageLinks from "@functions/manageLinks";
import getAllLinks from "@functions/getAllLinks";
import redirect from "@functions/redirect";
import signIn from "@functions/signIn";
import signUp from "@functions/signUp";

const serverlessConfiguration: AWS = {
  service: "short-linker-aws",
  frameworkVersion: "3",
  plugins: ["serverless-esbuild"],

  provider: {
    name: "aws",
    runtime: "nodejs14.x",
    region: "us-east-1",
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      NODE_OPTIONS: "--enable-source-maps --stack-trace-limit=1000",
    },
    iamRoleStatements: [
      {
        Effect: "Allow",
        Action: [
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ],
        Resource: [process.env.DB_ARN],
      },
    ],
  },

  functions: {
    createLink,
    manageLinks,
    getAllLinks,
    redirect,
    signIn,
    signUp,
    checkLinkExpiration: {
      handler: "src/functions/checkLinkExpiration/handler.main",
      events: [
        {
          schedule: "cron(00 * * * ? *)",
        },
      ],
    },
  },

  custom: {
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ["aws-sdk"],
      target: "node14",
      define: { "require.resolve": undefined },
      platform: "node",
      concurrency: 10,
    },
    eventBridge: {
      rules: [
        {
          name: "checkLinkExpirationRule",
          description: "Check link expiration daily",
          pattern: {
            source: ["custom.short-linker-aws"],
            "detail-type": ["checkLinkExpiration"],
          },
          schedule: "cron(00 * * * ? *)",
          state: "ENABLED",
          targets: [
            {
              id: "CheckLinkExpirationTarget",
              arn: process.env.EB_ARN,
            },
          ],
        },
      ],
    },
  },

  resources: {
    Resources: {
      MyDynamoDBTable: {
        Type: "AWS::DynamoDB::Table",
        Properties: {
          TableName: process.env.TABLE_NAME,
          AttributeDefinitions: [
            { AttributeName: "email", AttributeType: "S" },
            { AttributeName: "sortKey", AttributeType: "S" },
          ],
          KeySchema: [
            { AttributeName: "email", KeyType: "HASH" },
            { AttributeName: "sortKey", KeyType: "RANGE" },
          ],
          ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1,
          },
        },
      },
    },
  },
};

module.exports = serverlessConfiguration;
