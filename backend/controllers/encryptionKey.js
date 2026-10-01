
import { User } from "../model/user.js";

export const saveEncryptionPublicKey = async (req, res) => {
    try {
        const { publicKey } = req.body;

        if (!publicKey) {
            return res.status(400).json({
                message: "Public key is required."
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                encryptionPublicKey: publicKey
            },
            {
                new: true
            }
        ).select("_id encryptionPublicKey");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        return res.status(200).json({
            publicKey: user.encryptionPublicKey
        });

    } catch (error) {
        console.error("saveEncryptionPublicKey error:", error);

        return res.status(500).json({
            message: "Failed to save encryption public key."
        });
    }
};

export const getEncryptionPublicKey = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select("_id encryptionPublicKey");

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (!user.encryptionPublicKey) {
            return res.status(404).json({
                message: "Encryption public key not found."
            });
        }

        return res.status(200).json({
            userId: user._id,
            publicKey: user.encryptionPublicKey
        });

    } catch (error) {
        console.error("getEncryptionPublicKey error:", error);

        return res.status(500).json({
            message: "Failed to get encryption public key."
        });
    }
};
export const savePrivateKeyController = async (req, res) => {
    try {
        console.log("PRIVATE KEY REQUEST USER:", req.user);
        console.log("PRIVATE KEY REQUEST BODY:", req.body);

        const { encryptedPrivateKey } = req.body;

        if (!encryptedPrivateKey) {
            return res.status(400).json({
                message: "Encrypted private key is required."
            });
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            {
                encryptedPrivateKey
            },
            {
                returnDocument: "after"
            }
        ).select("_id encryptedPrivateKey");

        console.log("UPDATED USER:", user);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        return res.status(200).json({
            message: "Private key saved successfully.",
            encryptedPrivateKey: user.encryptedPrivateKey
        });
    } catch (error) {
        console.error("savePrivateKeyController error:", error);

        return res.status(500).json({
            message: "Failed to save private key."
        });
    }
};
