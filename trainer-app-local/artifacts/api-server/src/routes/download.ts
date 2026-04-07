import { Router, Request, Response } from "express";
import archiver from "archiver";
import path from "path";
import fs from "fs";

const router = Router();
const ROOT = path.resolve("/home/runner/workspace");

// Files included directly from filesystem
// NOTE: artifacts/api-server/src is handled specially (index.ts is overridden)
const INCLUDE_DIRS = [
  "artifacts/api-server/tsconfig.json",
  "artifacts/trainer-web/src",
  "artifacts/trainer-web/index.html",
  "artifacts/trainee-mobile/src",
  "artifacts/trainee-mobile/app",
  "artifacts/trainee-mobile/index.js",
  "artifacts/trainee-mobile/package.json",
  "artifacts/trainee-mobile/tsconfig.json",
  "artifacts/trainee-mobile/app.json",
  "lib/db/src",
  "lib/db/tsconfig.json",
  "lib/api-zod/src",
  "lib/api-zod/package.json",
  "lib/api-client-react/src",
  "lib/api-client-react/package.json",
  "lib/api-client-react/tsconfig.json",
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
];

// ── Overridden files ─────────────────────────────────────────────────────────

// api-server index.ts: loads .env automatically, defaults PORT to 8080
const API_SERVER_INDEX_TS = `import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"] ?? 8080);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening on http://localhost:" + port);
});
`;

// api-server package.json: uses tsx for dev, includes dotenv
const API_SERVER_PACKAGE_JSON = JSON.stringify({
  name: "@workspace/api-server",
  version: "0.0.0",
  private: true,
  type: "module",
  scripts: {
    dev: "tsx watch src/index.ts",
    typecheck: "tsc -p tsconfig.json --noEmit",
  },
  dependencies: {
    "@workspace/api-zod": "workspace:*",
    "@workspace/db": "workspace:*",
    "archiver": "^7.0.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2",
    "dotenv": "^16.4.7",
    "drizzle-orm": "^0.45.1",
    "express": "^5",
    "pino": "^9",
    "pino-http": "^10",
  },
  devDependencies: {
    "@types/archiver": "^7.0.0",
    "@types/cookie-parser": "^1.4.10",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^25.3.3",
    "pino-pretty": "^13",
    "tsx": "^4.21.0",
  },
}, null, 2);

// db package.json: adds db:push script and dotenv support
const DB_PACKAGE_JSON = JSON.stringify({
  name: "@workspace/db",
  version: "0.0.0",
  private: true,
  type: "module",
  exports: {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
  },
  scripts: {
    "db:push": "dotenv -e ../.env -- drizzle-kit push --config ./drizzle.config.ts",
    "push": "drizzle-kit push --config ./drizzle.config.ts",
  },
  dependencies: {
    "drizzle-orm": "^0.45.1",
    "drizzle-zod": "^0.8.3",
    "pg": "^8.20.0",
    "zod": "^3.25.76",
  },
  devDependencies: {
    "@types/node": "^25.3.3",
    "@types/pg": "^8.18.0",
    "dotenv-cli": "^8.0.0",
    "drizzle-kit": "^0.31.9",
  },
}, null, 2);

// drizzle.config.ts: loads DATABASE_URL from the api-server .env
const DRIZZLE_CONFIG_TS = `import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
`;

// trainer-web vite.config.ts: no Replit plugins, fixed local port
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
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
`;

// trainer-web package.json: no Replit-specific devDependencies
const TRAINER_WEB_PACKAGE_JSON = JSON.stringify({
  name: "@workspace/trainer-web",
  version: "0.0.0",
  private: true,
  type: "module",
  scripts: {
    dev: "vite --config vite.config.ts",
    build: "vite build --config vite.config.ts",
    serve: "vite preview --config vite.config.ts",
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
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.14",
    "@tanstack/react-query": "^5.90.21",
    "@types/node": "^25.3.3",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.0.4",
    "@workspace/api-client-react": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "framer-motion": "^12.23.24",
    "i18next": "^26.0.3",
    "lucide-react": "^0.545.0",
    "react": "19.1.0",
    "react-day-picker": "^9.11.1",
    "react-dom": "19.1.0",
    "react-hook-form": "^7.55.0",
    "react-i18next": "^17.0.2",
    "react-icons": "^5.4.0",
    "recharts": "^2.15.2",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.3.1",
    "tailwindcss": "^4.1.14",
    "tw-animate-css": "^1.4.0",
    "vite": "^7.3.0",
    "wouter": "^3.3.5",
    "zod": "^3.25.76",
  },
}, null, 2);

// Standalone trainer-web tsconfig — no extends, no project references needed locally
const TRAINER_WEB_TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: "es2022",
    lib: ["esnext", "dom", "dom.iterable"],
    module: "esnext",
    moduleResolution: "bundler",
    jsx: "preserve",
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    skipLibCheck: true,
    noEmit: true,
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    isolatedModules: true,
    types: ["node", "vite/client"],
    paths: {
      "@/*": ["./src/*"],
    },
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "build", "dist"],
}, null, 2);

// Mac-compatible pnpm workspace
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

### 1. Create the environment file
Create \`artifacts/api-server/.env\`:
\`\`\`
DATABASE_URL=postgresql://YOUR_NEON_CONNECTION_STRING
SESSION_SECRET=any-random-string
\`\`\`

### 2. Install dependencies
\`\`\`bash
pnpm install
\`\`\`

### 3. Push the database schema
\`\`\`bash
cd lib/db
DATABASE_URL="your-connection-string" npx drizzle-kit push --config ./drizzle.config.ts
cd ../..
\`\`\`

### 4. Run the apps (3 separate terminal windows from the root folder)
\`\`\`bash
# Terminal 1 - API backend (starts on port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 - Trainer web dashboard (opens on port 5173)
pnpm --filter @workspace/trainer-web run dev

# Terminal 3 - Mobile app
pnpm --filter @workspace/trainee-mobile run dev
\`\`\`

### 5. Open in browser
Trainer Dashboard: http://localhost:5173
Mobile App: scan the QR code in Terminal 3 with Expo Go on your phone
`;

router.get("/download-source", (req: Request, res: Response) => {
  res.setHeader("Content-Disposition", 'attachment; filename="runnathon-source.zip"');
  res.setHeader("Content-Type", "application/zip");

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(res);

  // Add api-server/src — but skip index.ts (we add our own version below)
  const apiSrcPath = path.join(ROOT, "artifacts/api-server/src");
  archive.directory(apiSrcPath, "artifacts/api-server/src", (entryData) => {
    if (entryData.name.includes("node_modules")) return false;
    if (entryData.name === "artifacts/api-server/src/index.ts") return false;
    return entryData;
  });

  // Add all other filesystem entries
  for (const entry of INCLUDE_DIRS) {
    const fullPath = path.join(ROOT, entry);
    let stat: fs.Stats | null = null;
    try { stat = fs.statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      archive.directory(fullPath, entry, (entryData) => {
        if (entryData.name.includes("node_modules")) return false;
        if (entryData.name.includes("dist")) return false;
        return entryData;
      });
    } else {
      archive.file(fullPath, { name: entry });
    }
  }

  // Add all overridden/generated files
  archive.append(API_SERVER_INDEX_TS, { name: "artifacts/api-server/src/index.ts" });
  archive.append(API_SERVER_PACKAGE_JSON, { name: "artifacts/api-server/package.json" });
  archive.append(DB_PACKAGE_JSON, { name: "lib/db/package.json" });
  archive.append(DRIZZLE_CONFIG_TS, { name: "lib/db/drizzle.config.ts" });
  archive.append(VITE_CONFIG, { name: "artifacts/trainer-web/vite.config.ts" });
  archive.append(TRAINER_WEB_PACKAGE_JSON, { name: "artifacts/trainer-web/package.json" });
  archive.append(TRAINER_WEB_TSCONFIG, { name: "artifacts/trainer-web/tsconfig.json" });
  archive.append(WORKSPACE_YAML, { name: "pnpm-workspace.yaml" });
  archive.append(SETUP_README, { name: "SETUP.md" });

  archive.finalize();
});

export default router;
