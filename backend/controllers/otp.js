import { User } from "../model/user.js";
import { createToken, createRefreshToken } from "../services/authentication.js";
import { accessCookieOptions, refreshCookieOptions } from "../utils/cookieOptions.js";

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const otpString = String(otp).trim();

        if (!/^\d{6}$/.test(otpString)) {
            return res.status(400).json({
                message: "OTP must be 6 digits."
            });
        }

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email."
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                message: "User is already verified."
            });
        }

        if (!user.OTP || !user.otpExpiry) {
            return res.status(400).json({
                message: "No active OTP. Please request a new OTP."
            });
        }

        if (Date.now() > user.otpExpiry.getTime()) {
            user.OTP = null;
            user.otpExpiry = null;
            await user.save();

            return res.status(400).json({
                message: "OTP expired. Please request a new OTP."
            });
        }

        if (user.OTP !== Number(otpString)) {
            return res.status(400).json({
                message: "Invalid OTP."
            });
        }

        user.isVerified = true;
        user.OTP = null;
        user.otpExpiry = null;
        user.unverifiedExpiry = null;
        user.lastOtpSentAt = null;

        await user.save();

        const safeUser = {
            _id: user._id,
            userName: user.userName,
            email: user.email,
            profileURL: user.profileURL
        };

        const accessToken = await createToken(user);
        const refreshToken = await createRefreshToken(user);

        return res
            .status(201)
            .cookie("accesstoken", accessToken, accessCookieOptions())
            .cookie("refreshtoken", refreshToken, refreshCookieOptions())
            .json({
                user: safeUser
            });

    } catch (error) {
        console.error("OTP verification error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
};