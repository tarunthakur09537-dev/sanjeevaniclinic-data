import { execSync } from "node:child_process";
import { access, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";

async function main() {
  execSync("corepack pnpm --filter @workspace/sanjeevani-clinic run build", {
    stdio: "inherit",
  });

  const sourceDir = path.resolve("apps", "sanjeevani-clinic", "dist");
  const outputDir = path.resolve("dist");

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(sourceDir, outputDir, { recursive: true });
  await access(path.join(outputDir, "index.html"), constants.F_OK);

  console.log(`Vercel static output prepared at: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
