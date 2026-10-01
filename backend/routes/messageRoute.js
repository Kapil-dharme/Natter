import express from "express"
import { uploadImage, uploadFile } from "../utils/cloudinary.js"
import { fileMessage } from "../controllers/sendFileMessage.js"
import { imageMessage } from "../controllers/sendImageMessage.js"
import { textMessage } from "../controllers/sendTextMessage.js"
import { checkForAuthentication } from "../middlewares/auth.js"
import { rateLimiter } from "../middlewares/rateLimiter.js"
import { deleteMessage } from "../controllers/deleteMessage.js";

const router = express.Router();

router.post("/send-text", checkForAuthentication("accesstoken"), rateLimiter, textMessage);

router.post("/send-image", checkForAuthentication("accesstoken"), rateLimiter, uploadImage.single("file"), imageMessage);

router.post("/send-file", checkForAuthentication("accesstoken"), rateLimiter, uploadFile.single("file"), fileMessage);

router.delete(
    "/:messageId",
    checkForAuthentication("accesstoken"),
    rateLimiter,
    deleteMessage
);

export default router