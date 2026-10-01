import express from "express"

import { checkForAuthentication } from "../middlewares/auth.js"

import { uploadImage } from "../utils/cloudinary.js"

import { loginUser } from "../controllers/login.js"

import { signupUser } from "../controllers/signup.js"

import { refreshAccessToken } from "../controllers/refereshToken.js"

import { updateProfile } from "../controllers/userController.js";

import { User } from "../model/user.js"

import { saveEncryptionPublicKey, getEncryptionPublicKey, savePrivateKeyController } from "../controllers/encryptionKey.js"

const router = express.Router();

router.post("/login-user", loginUser)

router.post("/signup-user", uploadImage.single("profileURL"), signupUser)

router.get("/refresh", refreshAccessToken)

router.patch(
    '/profile',
    checkForAuthentication("accesstoken"),
    uploadImage.single('profileURL'),
    updateProfile
);

router.get("/me", checkForAuthentication("accesstoken"), async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -OTP -otpExpiry');

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({ user });

    } catch {
        res.status(500).json({
            message: "Server error"
        });
    }
});

router.put(
    '/encryption/private-key',
    checkForAuthentication("accesstoken"),
    savePrivateKeyController
);

router.patch(
    "/encryption/public-key",
    checkForAuthentication("accesstoken"),
    saveEncryptionPublicKey
);

router.get(
    "/encryption/public-key/:userId",
    checkForAuthentication("accesstoken"),
    getEncryptionPublicKey
);

export default router