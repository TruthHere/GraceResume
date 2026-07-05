import { readFileSync, writeFileSync } from "fs";
import { globSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");
const chars = new Set();

for (const file of globSync("**/*.html", { cwd: root })) {
  const text = readFileSync(join(root, file), "utf8");
  for (const m of text.matchAll(/data-zh="([^"]*)"/g)) chars.add(...m[1]);
  for (const m of text.matchAll(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g)) chars.add(m[0]);
}

const punct = "，。、；：？！\u201c\u201d\u2018\u2019（）【】《》·—…";
punct.split("").forEach((c) => chars.add(c));

const sorted = [...chars].sort().join("");
writeFileSync(join(root, "assets/fonts/subset-chars.txt"), sorted);
console.log(`Wrote ${sorted.length} unique characters`);
