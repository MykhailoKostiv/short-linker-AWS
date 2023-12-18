import { APIGatewayProxyHandler } from "aws-lambda";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";
import * as jwt from "jsonwebtoken";
import { authenticateUser } from "src/middleware/authenticateUser";

const secretKey = process.env.JWT_SECRET_KEY;
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;

const getAllLinks: APIGatewayProxyHandler = async (event) => {
  const authenticationResult = await authenticateUser(event.headers);
  if (authenticationResult.statusCode) {
    return authenticationResult;
  }

  const accessToken = event.headers.Authorization;
  const decoded = jwt.verify(accessToken, secretKey);
  const email = decoded.email;
  const partitionKey = email;

  const params = {
    TableName: tableName,
    KeyConditionExpression:
      "email = :email AND begins_with(sortKey, :linkPrefix)",
    ExpressionAttributeValues: {
      ":email": partitionKey,
      ":linkPrefix": "LINK#",
    },
  };

  try {
    const data = await docClient.query(params).promise();
    const items = data.Items;
    const allLinks = [];

    items.map((el) => {
      allLinks.push({
        link: `https://7c65b3n8u6.execute-api.us-east-1.amazonaws.com/dev/${el.sortKey.replace(
          /^LINK#/,
          ""
        )}`,
        numberOfVist: el.numberOfVist,
      });
    });

    return formatJSONResponse({
      message: allLinks,
    });
  } catch (error) {
    console.error(error);
    return formatJSONResponse({
      message: "Error to get links from DB",
      error: error.message,
    });
  }
};

export const main = middyfy(getAllLinks);
