
import { PushSubscription } from "../model/pushSubscription.js";
import { User } from "../model/user.js";

export const subscribeToPush = async (req, res) => {
    try {
        const { endpoint, keys } = req.body;

        if (
            !endpoint ||
            !keys?.p256dh ||
            !keys?.auth
        ) {
            return res.status(400).json({
                message: "Invalid push subscription",
            });
        }

        const subscription =
            await PushSubscription.findOneAndUpdate(
                { endpoint },
                {
                    userId: req.user.id,
                    endpoint,
                    keys: {
                        p256dh: keys.p256dh,
                        auth: keys.auth,
                    },
                },
                {
                    returnDocument: "after",
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );

        await User.findByIdAndUpdate(
            req.user.id,
            {
                pushNotificationsDisabled: false,
                pushNotificationsConfigured: true,
            },
            {
                returnDocument: "after",
            }
        );

        return res.status(200).json({
            message: "Push subscription saved",
            subscriptionId: subscription._id,
        });
    } catch (error) {
        console.error(
            "Subscribe push error:",
            error
        );

        return res.status(500).json({
            message: "Failed to save push subscription",
        });
    }
};

export const unsubscribeFromPush = async (req, res) => {
    try {
        const result =
            await PushSubscription.deleteMany({
                userId: req.user.id,
            });

        await User.findByIdAndUpdate(
            req.user.id,
            {
                pushNotificationsDisabled: true,
                pushNotificationsConfigured: true,
            },
            {
                returnDocument: "after",
            }
        );

        console.log(
            "Push subscriptions deleted:",
            result.deletedCount,
            "for user:",
            req.user.id
        );

        const remaining =
            await PushSubscription.countDocuments({
                userId: req.user.id,
            });

        console.log(
            "Remaining push subscriptions:",
            remaining
        );

        return res.status(200).json({
            message: "All push subscriptions removed",
            deletedCount: result.deletedCount,
            remaining,
        });
    } catch (error) {
        console.error(
            "Unsubscribe push error:",
            error
        );

        return res.status(500).json({
            message: "Failed to remove push subscriptions",
        });
    }
};

export const getPushStatus = async (req, res) => {
    try {
        const { endpoint } = req.query;

        if (!endpoint) {
            return res.status(200).json({
                subscribed: false,
            });
        }

        const subscription =
            await PushSubscription.findOne({
                endpoint,
                userId: req.user.id,
            });

        return res.status(200).json({
            subscribed: !!subscription,
        });
    } catch (error) {
        console.error(
            "Push status error:",
            error
        );

        return res.status(500).json({
            message: "Failed to check push status",
        });
    }
};

