import { Router, Request, Response } from "express";
import archiver from "archiver";
import path from "path";
import fs from "fs";

const router = Router();
const ROOT = path.resolve("/home/runner/workspace");

// Files to include directly from the filesystem (excluding ones we override below)
const INCLUDE_DIRS = [
  "artifacts/api-server/src",
  "artifacts/api-server/package.json",
  "artifacts/api-server/tsconfig.json",
  "artifacts/trainer-web/src",
  "artifacts/trainer-web/index.html",
  "artifacts/trainer-web/tsconfig.json",
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

// Clean vite config — no Replit plugins, fixed local port, no BASE_PATH requirement
const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
`;

// Clean trainer-web package.json — no Replit-specific devDependencies
const TRAINER_WEB_PACKAGE_JSON = JSON.stringify({
  name: "@workspace/trainer-web",
  version: "0.0.0",
  private: true,
  type: "module",
  scripts: {
    dev: "vite --config vite.config.ts --host 0.0.0.0",
    build: "vite build --config vite.config.ts",
    serve: "vite preview --config vite.config.ts --host 0.0.0.0",
    typecheck: "tsc -p tsconfig.json --noEmit",
  },
  devDependencies: {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tailwindcss/vite": "^4.1.14",
    "@tanstack/react-query": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "@workspace/api-client-react": "workspace:*",
    "class-variance-authority": "catalog:",
    clsx: "catalog:",
    "date-fns": "^3.6.0",
    "framer-motion": "^12.23.24",
    "lucide-react": "catalog:",
    react: "catalog:",
    "react-day-picker": "^9.11.1",
    "react-dom": "catalog:",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    recharts: "^2.15.2",
    sonner: "^2.0.7",
    "tailwind-merge": "catalog:",
    tailwindcss: "catalog:",
    "tw-animate-css": "^1.4.0",
    vite: "catalog:",
    wouter: "^3.3.5",
    zod: "catalog:",
  },
}, null, 2);

// Mac-compatible pnpm workspace — no Linux-only esbuild overrides
const WORKSPACE_YAML = `minimumReleaseAge: 1440

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

const SETUP_README = `# Runnathon - Local Setup

## Prerequisites
- Node.js v18+ (https://nodejs.org)
- pnpm: run \`corepack enable pnpm\` in your terminal
- A free PostgreSQL database from https://neon.tech

## Setup Steps

### 1. Install dependencies (from this root folder)
\`\`\`bash
pnpm install
\`\`\`

### 2. Create the environment file
Create a file at: artifacts/api-server/.env
\`\`\`
DATABASE_URL=postgresql://YOUR_CONNECTION_STRING_FROM_NEON
SESSION_SECRET=any-random-string-here
\`\`\`

### 3. Push the database schema
\`\`\`bash
pnpm --filter @workspace/db run db:push
\`\`\`

### 4. Run the apps (open 3 separate terminal windows)
\`\`\`bash
# Terminal 1 — API backend
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Trainer web dashboard
pnpm --filter @workspace/trainer-web run dev

# Terminal 3 — Mobile app
pnpm --filter @workspace/trainee-mobile run dev
\`\`\`

### 5. Open in your browser
Trainer Dashboard: http://localhost:5173
Mobile App: scan the QR code shown in Terminal 3 with the Expo Go app on your phone
`;

router.get("/download-source", (req: Request, res: Response) => {
  res.setHeader("Content-Disposition", 'attachment; filename="runnathon-source.zip"');
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  for (const entry of INCLUDE_DIRS) {
    const fullPath = path.join(ROOT, entry);
    let stat: fs.Stats | null = null;
    try { stat = fs.statSync(fullPath); } catch { continue; }

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

  // Override Replit-specific files with clean local versions
  archive.append(VITE_CONFIG, { name: "artifacts/trainer-web/vite.config.ts" });
  archive.append(TRAINER_WEB_PACKAGE_JSON, { name: "artifacts/trainer-web/package.json" });
  archive.append(WORKSPACE_YAML, { name: "pnpm-workspace.yaml" });
  archive.append(SETUP_README, { name: "SETUP.md" });

  archive.finalize();
});

export default router;
