import { execSync } from "node:child_process";
import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

async function prepareOutput(sourceDir, outputDir) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(sourceDir, outputDir, { recursive: true, force: true });
  await access(path.join(outputDir, "index.html"), constants.F_OK);
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
