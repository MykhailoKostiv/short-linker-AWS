import { ScheduledHandler } from "aws-lambda";
import * as AWS from "aws-sdk";
import { parse, isAfter } from "date-fns";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;

const checkLinkExpiration: ScheduledHandler = async () => {
  try {
    const emailArray = [];
    const links = await getAllLinks();

    links.map((el) => {
      emailArray.push(el.email);
    });
    const uniqueArrayOfEmails = [...new Set(emailArray)];

    for (const link of links) {
      const currentDate = new Date();
      const expirationDate = parse(link.expiresAt, "MM-dd-yyyy", new Date());

      if (link.expiresAt === null) {
        console.log("Not link");
      } else {
        if (isAfter(currentDate, expirationDate)) {
          uniqueArrayOfEmails.map(async (el) => {
            await updateLinkStatus(el, link.sortKey);
          });
        }
      }
    }
  } catch (error) {
    console.error("Error processing link expiration:", error);
  }
};

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

const updateLinkStatus = async (email: string, sortKey: string) => {
  try {
    await docClient
      .update({
        TableName: tableName,
        Key: {
          email: email,
          sortKey: sortKey,
        },

        ConditionExpression: "begins_with(sortKey, :prefix)",
        ExpressionAttributeValues: {
          ":prefix": "LINK#",
          ":value": false,
        },
        UpdateExpression: "SET active = :value",
      })
      .promise();
  } catch (error) {
    console.error("Error updating link status:", error);
    throw error;
  }
};

interface Link {
  sortKey: string;
  expiresAt: string;
  email: string;
}

export const main = checkLinkExpiration;
