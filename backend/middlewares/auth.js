import { verifyToken } from "../services/authentication.js"

export const checkForAuthentication =(tokenName) => {
    return async (req, res, next) => {
        try {
            const tokenValue = req.cookies[tokenName];
            if (!tokenValue) return res.status(401).json({ message: "Unauthorized" });

            const payload = await verifyToken(tokenValue);
            req.user = payload

            next()

        } catch (error) {
            res.clearCookie(tokenName);
            res.status(401).json({message:"Unauthorized"})
        }
    }
}