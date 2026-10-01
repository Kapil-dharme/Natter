import { Router } from "express"
import { checkForAuthentication } from "../middlewares/auth.js"
import { searchUser, singleConversation } from "../controllers/searchUserForConversation.js"
import {
    conversationAndParticipantGuard,
    getConversations,
    createOrFindConversation,
    clearChat,
    deleteConversation
} from "../controllers/createOrFindConversation.js"
import { createGroup, renameGroup, addParticipants, removeParticipant, leaveGroup, deleteGroup, updateGroupPhoto } from "../controllers/groupConversations.js"
import { uploadImage } from "../utils/cloudinary.js"

const router = Router();

router.post("/conversations", checkForAuthentication("accesstoken"), createOrFindConversation)

router.get("/users/search", checkForAuthentication("accesstoken"), searchUser)

router.get("/conversations", checkForAuthentication("accesstoken"), getConversations)

router.get("/conversations/:conversationId/messages", checkForAuthentication("accesstoken"), conversationAndParticipantGuard)


router.patch(
    "/conversations/:conversationId/clear",
    checkForAuthentication("accesstoken"),
    clearChat
);

router.patch(
    "/conversations/:conversationId/delete",
    checkForAuthentication("accesstoken"),
    deleteConversation
);

router.get("/conversations/:conversationId", checkForAuthentication("accesstoken"), singleConversation)

router.post("/conversations/group", checkForAuthentication("accesstoken"), uploadImage.single("groupPhoto"), createGroup)

router.patch("/conversations/group/:conversationId/rename", checkForAuthentication("accesstoken"), renameGroup)

router.post("/conversations/group/:conversationId/participants", checkForAuthentication("accesstoken"), addParticipants)

router.delete("/conversations/group/:conversationId/participants/:participantId", checkForAuthentication("accesstoken"), removeParticipant)

router.delete("/conversations/group/:conversationId/leave", checkForAuthentication("accesstoken"), leaveGroup)

router.delete("/conversations/group/:conversationId", checkForAuthentication("accesstoken"), deleteGroup)

router.patch("/conversations/group/:conversationId/photo", checkForAuthentication("accesstoken"), uploadImage.single("groupPhoto"), updateGroupPhoto)

export default router;