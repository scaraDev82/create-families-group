import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.SUPABASE_URL || "https://YOUR-PROJECT-REF.supabase.co";
const key = process.env.SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

const output = `export const SUPABASE_URL = ${JSON.stringify(url)};\nexport const SUPABASE_ANON_KEY = ${JSON.stringify(key)};\n`;
writeFileSync(resolve(process.cwd(), "config.js"), output, "utf8");
console.log("config.js generated.");
