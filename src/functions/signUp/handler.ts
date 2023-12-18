import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import * as AWS from "aws-sdk";
import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.TABLE_NAME;
const secretKey = process.env.JWT_SECRET_KEY;
const saltRounds = 10;

const signUp = async (event) => {
  try {
    const { email, password } = event.body;

    const existingUser = await docClient
      .query({
        TableName: tableName,
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
      .promise();

    if (existingUser.Items && existingUser.Items.length > 0) {
      return formatJSONResponse({
        statusCode: 400,
        message: "Email is already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const refreshToken = jwt.sign({ email }, secretKey, {
      expiresIn: "7d",
    });

    const accessToken = jwt.sign({ email }, secretKey, {
      expiresIn: "1h",
    });

    await docClient
      .put({
        TableName: tableName,
        Item: {
          email: email,
          sortKey: "USER#creds",
          password: hashedPassword,
          refreshToken: refreshToken,
        },
      })
      .promise();

    return formatJSONResponse({
      message: "User registered successfully",
      refreshToken: refreshToken,
      accessToken: accessToken,
    });
  } catch (error) {
    console.error("Error during user registration:", error);

    return formatJSONResponse({
      statusCode: 500,
      message: "Failed to register user",
      error: error.message,
    });
  }
};

export const main = middyfy(signUp);
