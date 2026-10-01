import { createToken, createRefreshToken } from "../services/authentication.js"
import { User } from "../model/user.js"
import bcrypt from "bcrypt"
import { accessCookieOptions, refreshCookieOptions } from "../utils/cookieOptions.js"

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) return res.status(400).json({ message: "please fill out all the details." })

        const user = await User.findOne({ email });

        if (!user) return res.status(401).json({ message: "Invalid email or password." })

        const userExist = await bcrypt.compare(password, user.password)

        if (!userExist) return res.status(401).json({ message: "Invalid email or password." })

        if (user.isVerified == false) return res.status(403).json({ message: "Please verify your email before logging in." })

        const accessToken = await createToken(user);
        const refreshToken = await createRefreshToken(user);

        const safeUser = {
            _id: user._id,
            userName: user.userName,
            email: user.email,
            profileURL: user.profileURL,
            encryptedPrivateKey: user.encryptedPrivateKey
        };

        return res.status(200).cookie("accesstoken", accessToken, accessCookieOptions()).cookie("refreshtoken", refreshToken, refreshCookieOptions()).json({ message: "you logged in successfully.", user: safeUser })
    } catch (error) {
        return res.status(500).json({ message: "Invalid email or password." })
    }

}