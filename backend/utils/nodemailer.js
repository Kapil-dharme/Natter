import { AgentMailClient } from "agentmail";
import dotenv from "dotenv";

dotenv.config();

const client = new AgentMailClient({
    apiKey: process.env.AGENTMAIL_API_KEY,
});

const INBOX_ID = "kapil-6808@agentmail.to";

export const sendOTP = async (to, otp) => {
    try {
        const result = await client.inboxes.messages.send(
            INBOX_ID,
            {
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
                `,
            }
        );

        console.log("OTP email sent:", result.messageId);

        return result;
    } catch (error) {
        console.error("AgentMail email error:", error);

        throw new Error("Failed to send OTP email.");
    }
};