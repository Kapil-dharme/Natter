import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendOTP = async (to, otp) => {
    const { data, error } = await resend.emails.send({
        from: "Natter <onboarding@resend.dev>",
        to: [to],
        subject: "OTP verification from NATTER",

        text: `Your Natter verification code is: ${otp}

This code will expire in 2 minutes.

If you didn't request this, you can safely ignore this email.`,

        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #c8714a;">Natter</h2>

                <p>Hi,</p>

                <p>Your verification code is:</p>

                <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; margin: 20px 0; color: #333;">
                    ${otp}
                </div>

                <p style="color: #666; font-size: 14px;">
                    This code will expire in 2 minutes.
                </p>

                <p style="color: #999; font-size: 12px;">
                    If you didn't request this, you can safely ignore this email.
                </p>
            </div>
        `
    });

    if (error) {
        console.error("Resend email error:", error);
        throw new Error("Failed to send OTP email.");
    }

    console.log("OTP email sent:", data?.id);
};