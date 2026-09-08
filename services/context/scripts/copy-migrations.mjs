/**
 * Migrasi adalah aset runtime, bukan modul TypeScript — `tsc` tidak menyalinnya.
 * Runner mencari `./migrations/` di sebelah dirinya sendiri, jadi `dist/` harus punya
 * salinan yang sama persis dengan `src/`.
 */
import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../src/migrations/", import.meta.url));
const dest = fileURLToPath(new URL("../dist/migrations/", import.meta.url));

cpSync(src, dest, { recursive: true });
