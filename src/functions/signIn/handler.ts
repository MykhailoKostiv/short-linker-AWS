import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;
const secretKey = process.env.JWT_SECRET_KEY;

const signIn = async (event) => {
  try {
    const { email, password } = event.body;

    const userData = await docClient
      .get({
        TableName: tableName,
        Key: {
          email: email,
          sortKey: "USER#creds",
        },
        ProjectionExpression: "#p, #t",
        ExpressionAttributeNames: {
          "#p": "password",
          "#t": "refreshToken",
        },
      })
      .promise();

    const storedUser = userData.Item;

    if (!storedUser) {
      console.log("User not found:", email);
      return formatJSONResponse({
        statusCode: 401,
        message: "Invalid email or password " + userData + storedUser,
      });
    }

    const { password: hashedPassword } = storedUser;

    const passwordMatch = await bcrypt.compare(password, hashedPassword);

    if (!passwordMatch) {
      console.log("Invalid password for user:", email);
      return formatJSONResponse({
        statusCode: 401,
        message: "Invalid email or password",
      });
    }

    try {
      const newRefreshToken = jwt.sign({ email }, secretKey, {
        expiresIn: "7d",
      });

      const newAccessToken = jwt.sign({ email }, secretKey, {
        expiresIn: "1h",
      });

      await docClient
        .update({
          TableName: tableName,
          Key: {
            email: email,
            sortKey: "USER#creds",
          },
          UpdateExpression: "SET #tokenAttr = :value",
          ExpressionAttributeValues: {
            ":value": newRefreshToken,
          },
          ExpressionAttributeNames: {
            "#tokenAttr": "refreshToken",
          },
        })
        .promise();

      return formatJSONResponse({
        message: "User signed in successfully",
        token: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      console.log("Invalid refresh token:", err.message);
      return formatJSONResponse({
        statusCode: 401,
        message: "Invalid refresh token",
      });
    }
  } catch (error) {
    console.error("Error during user sign-in:", error);

    return formatJSONResponse({
      statusCode: 500,
      message: "Failed to sign in user",
      error: error.message,
    });
  }
};

export const main = middyfy(signIn);
