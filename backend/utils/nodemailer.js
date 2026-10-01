import nodemailer from "nodemailer"
import dotenv from "dotenv"
dotenv.config()

const transporter = nodemailer.createTransport({
    service: "gmail",
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export const sendOTP = async (to, otp) => {
    await transporter.sendMail({
        from: `"Natter" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: "OTP verification from NATTER",
        text: `Your Natter verification code is: ${otp}\n\nThis code will expire in 2 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
        html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
                    <h2 style="color: #c8714a;">Natter</h2>
                    <p>Hi,</p>
                    <p>Your verification code is:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; color: #333;">
                    ${otp}
                    </div>
                    <p style="color: #666; font-size: 14px;">This code will expire in 2 minutes.</p>
                    <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `
    });
}
