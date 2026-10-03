import multer from "multer"
import path from "path"
import { CloudinaryStorage } from "multer-storage-cloudinary"
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif"];

const FILE_TYPES = {
    pdf:  ["application/pdf"],
    doc:  ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls:  ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ppt:  ["application/vnd.ms-powerpoint"],
    pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    txt:  ["text/plain"],
};

const getExt = (name) => path.extname(name || "").toLowerCase().slice(1);

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const ext = getExt(file.originalname);
        const base =
            path
                .basename(file.originalname, path.extname(file.originalname))
                .replace(/[^a-zA-Z0-9_-]/g, "_")
                .slice(0, 40) || "file";
        const id = `${base}-${Date.now()}`;

        const keepsOwnExt = IMAGE_EXT.includes(ext) || ext === "pdf";

        return {
            folder: "Natter-Messages",
            resource_type: "auto",
            public_id: keepsOwnExt ? id : `${id}.${ext}`,
        };
    }
});

export const uploadImage = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/") && IMAGE_EXT.includes(getExt(file.originalname))) {
            cb(null, true);
        } else {
            req.fileValidationError = "Unsupported image format. Use JPG, PNG, WEBP or GIF.";
            cb(null, false);
        }
    }
});

export const uploadFile = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = FILE_TYPES[getExt(file.originalname)];
        const mimeOk =
            allowed &&
            (allowed.includes(file.mimetype) || file.mimetype === "application/octet-stream");

        if (mimeOk) {
            cb(null, true);
        } else {
            req.fileValidationError = "Unsupported file type.";
            cb(null, false);
        }
    }
});