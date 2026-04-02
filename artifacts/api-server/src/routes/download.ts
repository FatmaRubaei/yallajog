import { Router, Request, Response } from "express";
import archiver from "archiver";
import path from "path";

const router = Router();

const ROOT = path.resolve("/home/runner/workspace");

const INCLUDE_DIRS = [
  "artifacts/api-server/src",
  "artifacts/api-server/package.json",
  "artifacts/api-server/tsconfig.json",
  "artifacts/trainer-web/src",
  "artifacts/trainer-web/index.html",
  "artifacts/trainer-web/package.json",
  "artifacts/trainer-web/tsconfig.json",
  "artifacts/trainer-web/vite.config.ts",
  "artifacts/trainee-mobile/src",
  "artifacts/trainee-mobile/app",
  "artifacts/trainee-mobile/index.js",
  "artifacts/trainee-mobile/package.json",
  "artifacts/trainee-mobile/tsconfig.json",
  "artifacts/trainee-mobile/app.json",
  "lib/db/src",
  "lib/db/package.json",
  "lib/db/tsconfig.json",
  "lib/api-client-react/src",
  "lib/api-client-react/package.json",
  "lib/api-client-react/tsconfig.json",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
];

router.get("/download-source", (req: Request, res: Response) => {
  res.setHeader("Content-Disposition", 'attachment; filename="runnathon-source.zip"');
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  for (const entry of INCLUDE_DIRS) {
    const fullPath = path.join(ROOT, entry);
    const stat = (() => {
      try {
        return require("fs").statSync(fullPath);
      } catch {
        return null;
      }
    })();

    if (!stat) continue;

    if (stat.isDirectory()) {
      archive.directory(fullPath, entry, (entryData) => {
        if (entryData.name.includes("node_modules")) return false;
        if (entryData.name.includes(".next")) return false;
        if (entryData.name.includes("dist")) return false;
        return entryData;
      });
    } else {
      archive.file(fullPath, { name: entry });
    }
  }

  archive.finalize();
});

export default router;
