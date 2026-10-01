
import api from "./axios";

export const saveEncryptionPublicKey = async (publicKey) => {
    const response = await api.patch(
        "/auth/encryption/public-key",
        {
            publicKey
        }
    );

    return response.data;
};

export const getEncryptionPublicKey = async (userId) => {
    const response = await api.get(
        `/auth/encryption/public-key/${userId}`
    );

    return response.data;
};

export const saveEncryptedPrivateKey = async (encryptedBlob) => {
    console.log("SAVE PRIVATE KEY API FUNCTION CALLED");

    const payload = {
        encryptedPrivateKey: JSON.stringify(encryptedBlob)
    };

    console.log("PRIVATE KEY PAYLOAD:", payload);

    const res = await api.put(
        "/auth/encryption/private-key",
        payload
    );

    console.log("SAVE PRIVATE KEY API RESPONSE:", res.data);

    return res.data;
};