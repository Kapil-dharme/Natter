import mongoose from "mongoose";
import { User } from "../model/user.js";

const mongoURI =process.env.MONGODBURI;

export const connectToMongodb = async () => {
    try {
        await mongoose.connect(mongoURI);

        await User.collection.createIndex(
            { unverifiedExpiry: 1 },
            { expireAfterSeconds: 0 }
        );

        console.log("MongoDB connected and TTL index created");

    } catch (error) {
        console.error(error);
        throw new Error("Database connection failed.");
    }
};