import express from "express";

import {
    blockUser,
    unblockUser,
    getBlockedUsers,
    checkBlockStatus
} from "../controllers/blockController.js";

import { checkForAuthentication } from "../middlewares/auth.js";

const router = express.Router();

router.post(
    "/:userId",
    checkForAuthentication("accesstoken"),
    blockUser
);

router.delete(
    "/:userId",
    checkForAuthentication("accesstoken"),
    unblockUser
);

router.get(
    "/",
    checkForAuthentication("accesstoken"),
    getBlockedUsers
);

router.get(
    "/status/:userId",
    checkForAuthentication("accesstoken"),
    checkBlockStatus
);

export default router;