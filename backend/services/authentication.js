import JWT from "jsonwebtoken"

export const createToken = async (user) => {
    try {
        const payload = {
            id: user._id,
            userName: user.userName,
        }
        return await JWT.sign(payload, process.env.ACCESS_SECRET, { expiresIn: "15m" })
    } catch (error) {
        throw new Error("Invalid user.")
    }
}
export const verifyToken =async (token) => {
    try {
        return await JWT.verify(token, process.env.ACCESS_SECRET)
    } catch (error) {
        throw new Error("Invalid token.")
    }
}
export const createRefreshToken = async (user) => {
    try {
        const payload = {
            id: user._id,
            userName: user.userName,
        }
        return await JWT.sign(payload, process.env.REFRESH_SECRET, { expiresIn: "7d" })
    } catch (error) {
        throw new Error("Invalid user.")
    }
}
export const verifyRefreshToken =async (token) => {
    try {
        return await JWT.verify(token, process.env.REFRESH_SECRET)
    } catch (error) {
        throw new Error("Invalid token.")
    }
}