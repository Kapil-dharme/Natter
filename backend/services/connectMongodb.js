import mongoose from "mongoose"
const mongoURI=process.env.MONGODBURI 
export const connectToMongodb =async()=>{
    try {
        return await mongoose.connect(mongoURI)
    } catch (error) {
        throw new Error("Database connection failed.")
    }
}