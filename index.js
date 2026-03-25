"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const rootDir = __dirname;
  const distDir = path.join(rootDir, "apps", "sanjeevani-clinic", "dist");

  const send = async (relativePath) => {
    const filePath = path.join(distDir, relativePath);
    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(distDir)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return true;
    }

    try {
      const data = await fs.readFile(normalized);
      res.statusCode = 200;
      res.setHeader("Content-Type", contentType(normalized));
      res.end(data);
      return true;
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  };

  const assetPath = pathname.replace(/^\/+/, "");
  if (assetPath && path.extname(assetPath)) {
    const served = await send(assetPath);
    if (!served) {
      res.statusCode = 404;
      res.end("Not Found");
    }
    return;
  }

  await send("index.html");
};
