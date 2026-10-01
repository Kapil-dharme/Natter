const isProduction = process.env.NODE_ENV === "production";

const baseOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "strict",
    ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN })
});

export const accessCookieOptions = () => ({
    ...baseOptions(),
    maxAge: 15 * 60 * 1000
});

export const refreshCookieOptions = () => ({
    ...baseOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000
});

export const clearCookieOptions = () => baseOptions();