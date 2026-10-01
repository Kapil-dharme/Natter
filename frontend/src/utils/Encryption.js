const DB_NAME = "NatterE2EE";
const DB_VERSION = 1;
const STORE_NAME = "keys";

export async function generateKeyPair() {
    return window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256"
        },
        true,
        ["deriveKey"]
    );
}

export async function exportPublicKey(publicKey) {
    const jwk = await window.crypto.subtle.exportKey(
        "jwk",
        publicKey
    );

    return btoa(JSON.stringify(jwk));
}

export async function importPublicKey(publicKeyString) {
    const jwk = JSON.parse(
        atob(publicKeyString)
    );

    return window.crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "ECDH",
            namedCurve: "P-256"
        },
        true,
        []
    );
}

function openKeyDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getPrivateKeyId(userId) {
    return `privateKey:${userId}`;
}

function getPublicKeyId(userId) {
    return `publicKey:${userId}`;
}

export async function savePrivateKey(
    userId,
    privateKey
) {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request = store.put(
            privateKey,
            getPrivateKeyId(userId)
        );

        request.onsuccess = () => {
            db.close();
            resolve();
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

export async function loadPrivateKey(userId) {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readonly"
        );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request = store.get(
            getPrivateKeyId(userId)
        );

        request.onsuccess = () => {
            db.close();
            resolve(
                request.result || null
            );
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

export async function savePublicKey(
    userId,
    publicKey
) {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readwrite"
        );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request = store.put(
            publicKey,
            getPublicKeyId(userId)
        );

        request.onsuccess = () => {
            db.close();
            resolve();
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

export async function loadPublicKey(userId) {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(
            STORE_NAME,
            "readonly"
        );

        const store =
            transaction.objectStore(
                STORE_NAME
            );

        const request = store.get(
            getPublicKeyId(userId)
        );

        request.onsuccess = () => {
            db.close();
            resolve(
                request.result || null
            );
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

export async function deriveSharedKey(
    privateKey,
    otherPublicKey
) {
    return window.crypto.subtle.deriveKey(
        {
            name: "ECDH",
            public: otherPublicKey
        },
        privateKey,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function encryptMessage(
    text,
    sharedKey
) {
    const encoder =
        new TextEncoder();

    const plaintext =
        encoder.encode(text);

    const iv =
        window.crypto.getRandomValues(
            new Uint8Array(12)
        );

    const encrypted =
        await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv
            },
            sharedKey,
            plaintext
        );

    return {
        ciphertext:
            arrayBufferToBase64(
                encrypted
            ),
        iv:
            arrayBufferToBase64(
                iv
            )
    };
}

export async function decryptMessage(
    ciphertext,
    iv,
    sharedKey
) {
    const encryptedData =
        base64ToArrayBuffer(
            ciphertext
        );

    const ivBytes =
        base64ToArrayBuffer(iv);

    const decrypted =
        await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivBytes
            },
            sharedKey,
            encryptedData
        );

    const decoder =
        new TextDecoder();

    return decoder.decode(
        decrypted
    );
}

function arrayBufferToBase64(buffer) {
    const bytes =
        new Uint8Array(buffer);

    let binary = "";

    bytes.forEach(byte => {
        binary += String.fromCharCode(
            byte
        );
    });

    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary =
        atob(base64);

    const bytes =
        new Uint8Array(
            binary.length
        );

    for (
        let i = 0;
        i < binary.length;
        i++
    ) {
        bytes[i] =
            binary.charCodeAt(i);
    }

    return bytes;
}
export async function verifyKeyPair(privateKey, publicKey) {
    try {
        const throwaway = await window.crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey"]
        );

        const keyA = await deriveSharedKey(privateKey, throwaway.publicKey);
        const keyB = await deriveSharedKey(throwaway.privateKey, publicKey);

        const testData = new TextEncoder().encode("natter-verify");
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encrypted = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            keyA,
            testData
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            keyB,
            encrypted
        );

        const result = new TextDecoder().decode(decrypted);
        return result === "natter-verify";
    } catch {
        return false;
    }
}

export async function encryptPrivateKeyWithPassword(privateKey, password) {
    const encoder = new TextEncoder();

    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const salt = window.crypto.getRandomValues(new Uint8Array(16));

    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    const exportedPrivateKey = await window.crypto.subtle.exportKey("pkcs8", privateKey);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        exportedPrivateKey
    );

    return {
        encryptedKey: arrayBufferToBase64(encrypted),
        iv: arrayBufferToBase64(iv),
        salt: arrayBufferToBase64(salt)
    };
}

export async function decryptPrivateKeyWithPassword(encryptedBlob, password) {
    const encoder = new TextEncoder();

    const { encryptedKey, iv, salt } = encryptedBlob;

    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const aesKey = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: base64ToArrayBuffer(salt),
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
        aesKey,
        base64ToArrayBuffer(encryptedKey)
    );

    return window.crypto.subtle.importKey(
        "pkcs8",
        decrypted,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
}