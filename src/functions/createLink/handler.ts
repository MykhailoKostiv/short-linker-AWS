import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/api-gateway";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";
import schema from "./schema";
import { v4 as uuidv4 } from "uuid";
import { addDays, format } from "date-fns";
import { authenticateUser } from "src/middleware/authenticateUser";
import * as jwt from "jsonwebtoken";

const secretKey = process.env.JWT_SECRET_KEY;
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;

const createLink: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const authenticationResult = await authenticateUser(event.headers);
  if (authenticationResult.statusCode) {
    return authenticationResult;
  }

  const accessToken = event.headers.Authorization;

  try {
    const decoded = jwt.verify(accessToken, secretKey);

    const fullUrl: string = event.body.link;
    const expiresInDays: number | undefined = event.body.expiresAt;
    const email: string = decoded.email;
    const shortLinkId: string = uuidv4().substring(0, 5);

    const item: any = {
      email: email,
      sortKey: `LINK#${shortLinkId}`,
      fullUrl: fullUrl,
      active: true,
      numberOfVist: 0,
    };

    const currentDate = new Date();
    const expirationDate = addDays(currentDate, expiresInDays);
    item.expiresAt = format(expirationDate, "MM-dd-yyyy");

    await docClient
      .put({
        TableName: tableName,
        Item: item,
      })
      .promise();

    return formatJSONResponse({
      message: `https://7c65b3n8u6.execute-api.us-east-1.amazonaws.com/dev/${shortLinkId}`,
    });
  } catch (error) {
    console.error("Error during link creation:", error);

    return formatJSONResponse({
      statusCode: 500,
      message: "Failed to create link",
      error: error.message,
    });
  }
};

export const main = middyfy(createLink);
