import express from "express"
import { verifyOTP } from "../controllers/otp.js"
import { resendOtp } from "../controllers/resendOtp.js"
import { clearCookieOptions } from "../utils/cookieOptions.js"
const router = express.Router()

router.post("/verify-otp", verifyOTP)

router.post("/resent-otp", resendOtp)

router.post("/logout", (req, res) => {
  return res.clearCookie("accesstoken", clearCookieOptions())
    .clearCookie("refreshtoken", clearCookieOptions())
    .clearCookie("pendingEmail")
    .status(200)
    .json({ message: "Logged out successfully." });
});

export default router