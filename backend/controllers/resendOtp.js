import { User } from "../model/user.js";
import { sendOTP } from "../utils/nodemailer.js";
import crypto from "crypto";

export const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email is required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (user.isVerified) {
            return res.status(409).json({
                message: "User is already verified."
            });
        }

        const COOLDOWN_MS = 120 * 1000;

        if (
            user.lastOtpSentAt &&
            Date.now() - user.lastOtpSentAt.getTime() < COOLDOWN_MS
        ) {
            const remaining = Math.ceil(
                (COOLDOWN_MS -
                    (Date.now() - user.lastOtpSentAt.getTime())) / 1000
            );

            return res.status(429).json({
                message: `Please wait ${remaining} seconds before requesting another OTP.`
            });
        }

        const OTP = crypto.randomInt(100000, 1000000);

        const otpExpiry = new Date(
            Date.now() + 2 * 60 * 1000
        );

        const unverifiedExpiry = new Date(
            Date.now() + 10 * 60 * 1000
        );

        user.OTP = OTP;
        user.otpExpiry = otpExpiry;
        user.unverifiedExpiry = unverifiedExpiry;
        user.lastOtpSentAt = new Date();

        await user.save();

        await sendOTP(normalizedEmail, OTP);

        return res.status(200).json({
            message: "OTP resent to your email.",
            otpExpiresAt: otpExpiry.toISOString()
        });

    } catch (error) {
        console.error("Resend OTP error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};