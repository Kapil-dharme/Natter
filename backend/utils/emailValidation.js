
const disposableDomains = new Set([
    "10minutemail.com",
    "10minutemail.net",
    "10minutemail.org",
    "20minutemail.com",
    "33mail.com",
    "anonbox.net",
    "anonymbox.com",
    "emailondeck.com",
    "fakeinbox.com",
    "fakemail.net",
    "fakemailgenerator.com",
    "getnada.com",
    "guerrillamail.com",
    "guerrillamail.net",
    "guerrillamail.org",
    "inboxbear.com",
    "maildrop.cc",
    "mailinator.com",
    "mintemail.com",
    "moakt.com",
    "mohmal.com",
    "mytemp.email",
    "sharklasers.com",
    "temp-mail.org",
    "temp-mail.io",
    "temp-mail.ru",
    "tempail.com",
    "tempmail.com",
    "tempmail.net",
    "tempmailo.com",
    "throwawaymail.com",
    "trashmail.com",
    "trashmail.net",
    "yopmail.com",
    "yopmail.fr"
]);

const blockedDomains = new Set([
    "gamil.com",
    "gmial.com",
    "gnail.com",
    "gmai.com",
    "gmail.co",
    "gmail.cm",
    "gmail.con",
    "gmail.om",
    "gmail.co.in"
]);

export function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}

export function isValidEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

export function isDisposableEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const parts = normalizedEmail.split("@");

    if (parts.length !== 2) return false;

    const domain = parts[1];

    return (
        disposableDomains.has(domain) ||
        blockedDomains.has(domain)
    );
}

