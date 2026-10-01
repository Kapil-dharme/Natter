import express from "express";
import { checkForAuthentication } from "../middlewares/auth.js";
import {
    subscribeToPush,
    unsubscribeFromPush,
    getPushStatus,
} from "../controllers/notificationController.js";

const router = express.Router();

router.post(
    "/subscribe",
    checkForAuthentication("accesstoken"),
    subscribeToPush
);

router.delete(
    "/unsubscribe",
    checkForAuthentication("accesstoken"),
    unsubscribeFromPush
);

router.get(
    "/status",
    checkForAuthentication("accesstoken"),
    getPushStatus
);

export default router;