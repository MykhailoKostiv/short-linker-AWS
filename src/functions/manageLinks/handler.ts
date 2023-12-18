import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/api-gateway";
import schema from "./schema";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";
import * as jwt from "jsonwebtoken";
import { authenticateUser } from "src/middleware/authenticateUser";

const secretKey = process.env.JWT_SECRET_KEY;
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;

export const checkIfItemExists = async (email, urlID) => {
  try {
    const data = await docClient
      .get({
        TableName: tableName,
        Key: {
          email: email,
          sortKey: "LINK#" + urlID,
        },
        ProjectionExpression: "email",
      })
      .promise();

    return !!data.Item;
  } catch (error) {
    console.error(error);
    return formatJSONResponse({
      message: "Link not found",
    });
  }
};

const manageLinks: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const authenticationResult = await authenticateUser(event.headers);
  if (authenticationResult.statusCode) {
    return authenticationResult;
  }

  const accessToken = event.headers.Authorization;

  const urlID = event.body.linkId;

  try {
    const decoded = jwt.verify(accessToken, secretKey);
    const email = decoded.email;

    const itemExists = await checkIfItemExists(email, urlID);
    if (!itemExists) {
      return formatJSONResponse({
        message: "Link not found",
      });
    }

    await docClient
      .update({
        TableName: tableName,
        Key: {
          email: email,
          sortKey: "LINK#" + urlID,
        },
        UpdateExpression: "SET active = :value",
        ExpressionAttributeValues: {
          ":value": false,
        },
      })
      .promise();

    return formatJSONResponse({
      message: `${event.body.linkId} has been deactivated`,
    });
  } catch (error) {
    return formatJSONResponse({
      message: "Failed to manage links",
      error: error.message,
    });
  }
};

export const main = middyfy(manageLinks);
