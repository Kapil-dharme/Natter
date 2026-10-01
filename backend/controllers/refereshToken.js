import { createToken, verifyRefreshToken } from "../services/authentication.js";
import { User } from "../model/user.js";
import { accessCookieOptions } from "../utils/cookieOptions.js";

export const refreshAccessToken = async (req, res) => {
    try {
        const tokenValue = req.cookies["refreshtoken"];
        if (!tokenValue) {
            return res.status(401).json({
                message: "Please log in."
            });
        }

        const { id } = await verifyRefreshToken(tokenValue);

        const user = await User.findById(id);

        if (!user) {
            return res.status(401).json({
                message: "User not exists."
            });
        }

        const accessToken = await createToken(user);

        return res
            .status(200)
            .cookie("accesstoken", accessToken, accessCookieOptions())
            .json({
                message: "access token created."
            });

    } catch (error) {
        console.error("refreshAccessToken error:", error);

        return res.status(401).json({
            message: "Invalid or expired refresh token."
        });
    }
};