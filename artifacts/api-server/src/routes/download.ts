import { Router, Request, Response } from "express";
import archiver from "archiver";
import path from "path";
import fs from "fs";

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
  "lib/api-zod/src",
  "lib/api-zod/package.json",
  "lib/api-client-react/src",
  "lib/api-client-react/package.json",
  "lib/api-client-react/tsconfig.json",
  "package.json",
  "tsconfig.json",
];

// Mac-compatible workspace file — removes Replit-specific Linux-only platform overrides
const MAC_WORKSPACE_YAML = `minimumReleaseAge: 1440

packages:
  - artifacts/*
  - lib/*

catalog:
  '@tanstack/react-query': ^5.90.21
  '@types/node': ^25.3.3
  '@types/react': ^19.2.0
  '@types/react-dom': ^19.2.0
  '@vitejs/plugin-react': ^5.0.4
  class-variance-authority: ^0.7.1
  clsx: ^2.1.1
  drizzle-orm: ^0.45.1
  lucide-react: ^0.545.0
  react: 19.1.0
  react-dom: 19.1.0
  tailwind-merge: ^3.3.1
  tailwindcss: ^4.1.14
  tsx: ^4.21.0
  vite: ^7.3.0
  zod: ^3.25.76

autoInstallPeers: false
`;

// Setup instructions file
const SETUP_README = `# Runnathon - Local Setup

## Prerequisites
- Node.js v18+ (https://nodejs.org)
- pnpm: run \`corepack enable pnpm\` in your terminal
- A PostgreSQL database (free at https://neon.tech)

## Setup Steps

### 1. Install dependencies
\`\`\`bash
pnpm install
\`\`\`

### 2. Create environment file
Create \`artifacts/api-server/.env\` with:
\`\`\`
DATABASE_URL=postgresql://YOUR_CONNECTION_STRING_FROM_NEON
SESSION_SECRET=any-random-string-here
\`\`\`

### 3. Push database schema
\`\`\`bash
pnpm --filter @workspace/db run db:push
\`\`\`

### 4. Run the apps (3 separate terminals)
\`\`\`bash
# Terminal 1 - API backend (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 - Trainer web dashboard
pnpm --filter @workspace/trainer-web run dev

# Terminal 3 - Mobile app (Expo)
pnpm --filter @workspace/trainee-mobile run dev
\`\`\`

### 5. Open in browser
Trainer Dashboard: http://localhost:5173
Mobile App: scan QR code in Terminal 3 with Expo Go app on your phone
`;

router.get("/download-source", (req: Request, res: Response) => {
  res.setHeader("Content-Disposition", 'attachment; filename="runnathon-source.zip"');
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  for (const entry of INCLUDE_DIRS) {
    const fullPath = path.join(ROOT, entry);
    let stat: fs.Stats | null = null;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }

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

  // Add the Mac-compatible workspace file
  archive.append(MAC_WORKSPACE_YAML, { name: "pnpm-workspace.yaml" });

  // Add setup instructions
  archive.append(SETUP_README, { name: "SETUP.md" });

  archive.finalize();
});

export default router;
