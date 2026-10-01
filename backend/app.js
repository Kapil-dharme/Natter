import "dotenv/config";
import express from "express";
import { connectToMongodb } from "./services/connectMongodb.js";
import cors from "cors"
import cookieParser from "cookie-parser";
import authRouter from "./routes/loginAndSignup.js";
import otpRouter from "./routes/otpVerify.js";
import messageRouter from "./routes/messageRoute.js";
import conversationRouter from "./routes/conversationRoute.js";
import notificationRouter from "./routes/notification.js";
import { initIO } from "./services/socketio.js"
import blockRoutes from "./routes/blockRoutes.js";
import http from "http"
const app = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.get("/health", (req, res) => {
    return res.status(200).json({ status: "ok" });
});

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

connectToMongodb().catch((error) => {
    console.error(error.message)
    process.exit(1)
});

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use("/auth", authRouter);
app.use("/user", otpRouter);
app.use("/messages", messageRouter);
app.use("/userChat", conversationRouter);
app.use("/notifications", notificationRouter);
app.use("/block", blockRoutes);

const httpServer = http.createServer(app);

if (!process.env.VERCEL) {
    httpServer.listen(port, () => {
        console.log("server started at port =", port);
    })
}

initIO(httpServer);

export default httpServer;