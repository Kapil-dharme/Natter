import mongoose from "mongoose"
import{User} from "../model/user"
const mongoURI = process.env.MONGODBURI
export const connectToMongodb = async () => {
    try {
        return await mongoose.connect(mongoURI)

        await User.collection.createIndex(
            { unverifiedExpiry: 1 },
            { expireAfterSeconds: 0 }
        );
    } catch (error) {
        throw new Error("Database connection failed.")
    }
}