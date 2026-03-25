import { execSync } from "node:child_process";
import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const serverEntrypoint = `"use strict";

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

  const send = async (relativePath) => {
    const filePath = path.join(rootDir, relativePath);
    const normalized = path.normalize(filePath);
    if (!normalized.startsWith(rootDir)) {
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

  const assetPath = pathname.replace(/^\\/+/, "");
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
`;

async function prepareOutput(sourceDir, outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(sourceDir, outputDir, { recursive: true, force: true });
  await writeFile(path.join(outputDir, "index.js"), serverEntrypoint, "utf8");
  await access(path.join(outputDir, "index.html"), constants.F_OK);
  await access(path.join(outputDir, "index.js"), constants.F_OK);
}

async function main() {
  execSync("corepack pnpm --filter @workspace/sanjeevani-clinic run build", {
    stdio: "inherit",
    cwd: repoRoot,
  });

  const sourceDir = path.join(repoRoot, "apps", "sanjeevani-clinic", "dist");
  const repoOutputDir = path.join(repoRoot, "dist");
  const cwdOutputDir = path.resolve(process.cwd(), "dist");

  await prepareOutput(sourceDir, repoOutputDir);
  if (cwdOutputDir !== repoOutputDir) {
    await prepareOutput(sourceDir, cwdOutputDir);
  }

  console.log(`Vercel static output prepared at: ${repoOutputDir}`);
  if (cwdOutputDir !== repoOutputDir) {
    console.log(`Vercel static output mirrored at: ${cwdOutputDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
