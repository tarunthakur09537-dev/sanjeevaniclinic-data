import { execSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

async function mirrorOutput(sourceDir, outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(sourceDir, outputDir, { recursive: true, force: true });
}

async function main() {
  execSync("pnpm --filter @workspace/sanjeevani-clinic run build", {
    stdio: "inherit",
    cwd: repoRoot,
  });

  const sourceDir = path.join(repoRoot, "apps", "sanjeevani-clinic", "dist");
  const nestedOutputDir = path.join(repoRoot, "public");

  await mirrorOutput(sourceDir, nestedOutputDir);

  console.log(`Frontend assets mirrored to root /public folder for Vercel static hosting: ${nestedOutputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
