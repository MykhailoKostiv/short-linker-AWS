import * as jwt from "jsonwebtoken";
import { formatJSONResponse } from "@libs/api-gateway";
import * as AWS from "aws-sdk";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;
const secretKey = process.env.JWT_SECRET_KEY;

export const authenticateUser = async (headers) => {
  try {
    const accessToken = headers.Authorization;

    if (!accessToken) {
      return formatJSONResponse({
        statusCode: 401,
        message: "Access token missing",
      });
    }

    const decodedWithoutVerify = jwt.decode(accessToken);

    if (!decodedWithoutVerify) {
      return formatJSONResponse({
        statusCode: 401,
        message: "Invalid access token",
      });
    }

    if (decodedWithoutVerify.exp) {
      if (decodedWithoutVerify.exp * 1000 < Date.now()) {
        const email = decodedWithoutVerify.email;

        const userData = await docClient
          .get({
            TableName: tableName,
            Key: {
              email: email,
              sortKey: "USER#creds",
            },
            ProjectionExpression: "#t",
            ExpressionAttributeNames: {
              "#t": "refreshToken",
            },
          })
          .promise();

        const storedUser = userData.Item;

        if (!storedUser) {
          return formatJSONResponse({
            statusCode: 401,
            message: "User not found",
          });
        }

        const { refreshToken } = storedUser;

        try {
          jwt.verify(refreshToken, secretKey);

          const newAccessToken = jwt.sign({ email }, secretKey, {
            expiresIn: "1h",
          });

          return formatJSONResponse({
            message: "User authenticated successfully",
            token: newAccessToken,
          });
        } catch (refreshTokenError) {
          console.error("Error verifying refresh token:", refreshTokenError);

          return formatJSONResponse({
            statusCode: 401,
            message: "Invalid refresh token",
          });
        }
      }
    }

    const decoded = jwt.verify(accessToken, secretKey);

    return decoded;
  } catch (error) {
    console.error("Error during authentication:", error);

    return formatJSONResponse({
      statusCode: 500,
      message: "Authentication failed",
      error: error.message,
    });
  }
};
