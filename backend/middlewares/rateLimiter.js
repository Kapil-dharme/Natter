import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

export const rateLimiter = async (req, res, next) => {
    const userId = req.user.id;
    const key = `rate:${userId}`;
    const now = Date.now();
    const windowMs = 60 * 1000;
    const limit = 60;

    await redis.zremrangebyscore(key, 0, now - windowMs);

    const count = await redis.zcard(key);

    if (count >= limit) {
        return res.status(429).json({ message: "Too many messages. Please slow down." });
    }

    await redis.zadd(key, now, `${now}`);
    await redis.expire(key, 60);

    next();
}