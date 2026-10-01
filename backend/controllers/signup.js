
import { User } from "../model/user.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendOTP } from "../utils/nodemailer.js";

const normalizeEmail = (email) => email.trim().toLowerCase();

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const signupUser = async (req, res) => {
    const { userName, email, password } = req.body;
    const profileURL = req.file?.path;

    try {
        if (!userName || !email || !password) {
            return res.status(400).json({
                message: "Please fill out all the details"
            });
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedUsername = userName.trim();

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                message: "Please enter a valid email address"
            });
        }

        if (password.length < 5 || password.length > 20) {
            return res.status(400).json({
                message: "Password must be between 5 and 20 characters"
            });
        }

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        const existingUsername = await User.findOne({
            userName: normalizedUsername
        });

        if (existingUser) {
            if (existingUser.isVerified) {
                return res.status(409).json({
                    message: "User already exists"
                });
            }

            if (
                existingUsername &&
                existingUsername._id.toString() !== existingUser._id.toString()
            ) {
                return res.status(409).json({
                    message: "Username already taken"
                });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const OTP = crypto.randomInt(100000, 1000000);
            const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);
            const unverifiedExpiry = new Date(
                Date.now() + 10 * 60 * 1000
            );
            const lastOtpSentAt = new Date();

            existingUser.userName = normalizedUsername;
            existingUser.email = normalizedEmail;
            existingUser.password = hashedPassword;
            existingUser.OTP = OTP;
            existingUser.otpExpiry = otpExpiry;
            existingUser.unverifiedExpiry = unverifiedExpiry;
            existingUser.lastOtpSentAt = lastOtpSentAt;

            if (profileURL) {
                existingUser.profileURL = profileURL;
            }

            await existingUser.save();

            await sendOTP(normalizedEmail, OTP);

            return res.status(200).json({
                message: "OTP sent to your email. Please verify to continue.",
                otpExpiresAt: otpExpiry.toISOString()
            });
        }

        if (existingUsername) {
            return res.status(409).json({
                message: "Username already taken"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const OTP = crypto.randomInt(100000, 1000000);
        const otpExpiry = new Date(Date.now() + 2 * 60 * 1000);
        const unverifiedExpiry = new Date(
            Date.now() + 30 * 60 * 1000
        );
        const lastOtpSentAt = new Date();

        const user = await User.create({
            userName: normalizedUsername,
            email: normalizedEmail,
            password: hashedPassword,
            profileURL: profileURL,
            OTP,
            otpExpiry,
            unverifiedExpiry,
            lastOtpSentAt
        });

        await sendOTP(normalizedEmail, OTP);

        return res.status(200).json({
            message: "OTP sent to your email. Please verify to continue.",
            otpExpiresAt: otpExpiry.toISOString()
        });

    } catch (error) {
        console.error("Signup error:", error);

        if (error.code === 11000) {
            if (error.keyPattern?.email) {
                return res.status(409).json({
                    message: "Email already exists"
                });
            }

            if (error.keyPattern?.userName) {
                return res.status(409).json({
                    message: "Username already taken"
                });
            }
        }

        if (error.name === "ValidationError") {
            const firstError = Object.values(error.errors)[0];

            let message = "Invalid input";

            if (firstError.kind === "maxlength") {
                message = `${firstError.path} is too long`;
            }

            return res.status(400).json({ message });
        }

        return res.status(500).json({
            message: "Signup failed"
        });
    }
};

