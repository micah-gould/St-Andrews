import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const catalogsDir = join(__dirname, "../data/catalogs");

export const catalogs = readdirSync(catalogsDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({
    ...require(join(catalogsDir, file)),
    prereqRules: {},
    antiRequirements: [],
  }))
  .filter((catalog) => catalog.nodes?.length);
