
import api from "../api/axios";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
    if (!base64String) {
        throw new Error("VAPID public key is missing");
    }

    const padding = "=".repeat(
        (4 - (base64String.length % 4)) % 4
    );

    const base64 = (base64String + padding)
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    const rawData = window.atob(base64);

    return Uint8Array.from(
        [...rawData].map(char => char.charCodeAt(0))
    );
}

async function getPushSubscription() {
    if (!("serviceWorker" in navigator)) {
        throw new Error("Service workers are not supported");
    }

    if (!("PushManager" in window)) {
        throw new Error("Push notifications are not supported");
    }

    const registration =
        await navigator.serviceWorker.ready;

    return registration.pushManager.getSubscription();
}

export async function enablePushNotifications() {
    if (!("Notification" in window)) {
        throw new Error("Notifications are not supported");
    }

    if (Notification.permission === "denied") {
        throw new Error(
            "Notifications are blocked. Please allow notifications from your browser's site settings."
        );
    }

    if (Notification.permission !== "granted") {
        const permission =
            await Notification.requestPermission();

        if (permission !== "granted") {
            throw new Error(
                "Notification permission was not granted"
            );
        }
    }

    const registration =
        await navigator.serviceWorker.ready;

    let subscription =
        await registration.pushManager.getSubscription();

    if (!subscription) {
        try {
            subscription =
                await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey:
                        urlBase64ToUint8Array(
                            VAPID_PUBLIC_KEY
                        ),
                });
        } catch (error) {
            console.error(
                "Push subscribe failed:",
                error.name,
                error.message
            );

            throw new Error(
                "Your browser could not reach its push service. Check your network, VPN and browser push settings, then try again."
            );
        }
    }

    await api.post(
        "/notifications/subscribe",
        subscription.toJSON()
    );

    return subscription;
}

export async function disablePushNotifications() {
    const subscription =
        await getPushSubscription();

    try {
        await api.delete(
            "/notifications/unsubscribe"
        );
    } finally {
        if (subscription) {
            await subscription.unsubscribe();
        }
    }
}

export async function isPushEnabled() {
    if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
    ) {
        return false;
    }

    if (Notification.permission !== "granted") {
        return false;
    }

    const subscription =
        await getPushSubscription();

    if (!subscription) {
        return false;
    }

    try {
        const response =
            await api.get(
                "/notifications/status",
                {
                    params: {
                        endpoint:
                            subscription.endpoint,
                    },
                }
            );

        return (
            response.data?.subscribed === true
        );
    } catch (error) {
        console.error(
            "Failed to check push subscription status:",
            error
        );

        return false;
    }
}
