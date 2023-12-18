import { APIGatewayProxyHandler } from "aws-lambda";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";
import { checkIfItemExists } from "@functions/manageLinks/handler";
import { parse, isAfter } from "date-fns";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;

const redirect: APIGatewayProxyHandler = async (event) => {
  const urlID = event.pathParameters.id;

  try {
    const getAllLinks = async (): Promise<Link[]> => {
      const result = await docClient
        .scan({
          TableName: tableName,
          FilterExpression: "begins_with(sortKey, :prefix)",
          ExpressionAttributeValues: {
            ":prefix": "LINK#",
          },
        })
        .promise();

      return result.Items as Link[];
    };
    const emailArray = [];
    const links = await getAllLinks();
    let email;
    let itemExists;

    links.map((el) => {
      emailArray.push(el.email);
    });
    const uniqueArrayOfEmails = [...new Set(emailArray)];

    for (const el of uniqueArrayOfEmails) {
      itemExists = await checkIfItemExists(el, urlID);

      if (itemExists) {
        email = el;
        console.log(el);
        break;
      }
    }

    if (!itemExists) {
      return formatJSONResponse({
        message: "Link not found",
      });
    }

    const data = await docClient
      .get({
        TableName: tableName,
        Key: {
          email: email,
          sortKey: "LINK#" + urlID,
        },
        ProjectionExpression: "fullUrl, active, numberOfVist, expiresAt",
      })
      .promise();

    const fullUrl = data.Item?.fullUrl;
    const isActive = data.Item?.active;
    const expiresAt = data.Item?.expiresAt;

    if (!isActive) {
      return formatJSONResponse({
        message: "The link is deactivated" + itemExists,
      });
    } else {
      const currentDate = new Date();
      const expirationDate = parse(expiresAt, "MM-dd-yyyy", new Date());

      if (isAfter(currentDate, expirationDate)) {
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
          message: "The link has expired",
        });
      }

      await docClient
        .update({
          TableName: tableName,
          Key: {
            email: email,
            sortKey: "LINK#" + urlID,
          },
          UpdateExpression: "SET numberOfVist = numberOfVist + :increment",
          ExpressionAttributeValues: {
            ":increment": 1,
          },
        })
        .promise();

      return {
        statusCode: 302,
        headers: {
          Location: fullUrl,
        },
        body: "",
      };
    }
  } catch (error) {
    console.error(error);

    return formatJSONResponse({
      message: "Failed to process the request",
      error: error.message,
    });
  }
};
interface Link {
  sortKey: string;
  expiresAt: string;
  email: string;
}
export const main = middyfy(redirect);
