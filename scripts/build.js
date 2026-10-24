import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "dist");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(path.join(outputDirectory, "data"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(path.join(projectRoot, file), path.join(outputDirectory, file));
}

await cp(
  path.join(projectRoot, "data", "glm-5.2-h200-mvp.json"),
  path.join(outputDirectory, "data", "glm-5.2-h200-mvp.json")
);

await cp(
  path.join(projectRoot, "data", "glm-5.2-b200-fragmentation.json"),
  path.join(outputDirectory, "data", "glm-5.2-b200-fragmentation.json")
);

await cp(path.join(projectRoot, "report"), path.join(outputDirectory, "report"), { recursive: true });
await mkdir(path.join(outputDirectory, "scripts/inferencex"), { recursive: true });
await cp(path.join(projectRoot, "scripts/inferencex/capacity.js"), path.join(outputDirectory, "scripts/inferencex/capacity.js"));
for (const file of ["inferencex-ui.json", "shortlist.csv", "comparisons.csv"]) {
  await cp(path.join(projectRoot, "data", file), path.join(outputDirectory, "data", file));
}
await cp(path.join(projectRoot, "public/og.png"), path.join(outputDirectory, "og.png"));
console.log("Static simulator and report explorer built in dist/.");
