import { execFile } from "node:child_process";
import { resolve } from "node:path";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { mdxOptions } from "./mdx.config";

const contentDir = resolve(import.meta.dirname, "../../content");

/**
 * /content lives outside the Vite root, so Vite doesn't watch it. Rebuild the manifest
 * and reload when an exercise or lesson is added, changed or removed.
 */
function watchContent(): Plugin {
  return {
    name: "woodshed-content",
    configureServer(server) {
      server.watcher.add(contentDir);
      const rebuild = (file: string) => {
        if (!file.startsWith(contentDir) || !/\.(ya?ml|mdx)$/.test(file)) return;
        execFile("pnpm", ["build:manifest"], { cwd: import.meta.dirname }, (err, _out, stderr) => {
          if (err) {
            server.config.logger.error(stderr || String(err));
            return;
          }
          // New lesson files change the import.meta.glob result in the lesson registry.
          const registry = server.moduleGraph.getModulesByFile(resolve(import.meta.dirname, "src/lessons/registry.ts"));
          registry?.forEach((m) => server.moduleGraph.invalidateModule(m));
          server.ws.send({ type: "full-reload" });
        });
      };
      server.watcher.on("add", rebuild);
      server.watcher.on("change", rebuild);
      server.watcher.on("unlink", rebuild);
    },
  };
}

export default defineConfig({
  plugins: [
    { enforce: "pre", ...mdx(mdxOptions) },
    react({ include: /\.(mdx|tsx?)$/ }),
    tailwindcss(),
    watchContent(),
  ],
  // Lessons live in /content at the repo root.
  server: { fs: { allow: ["../.."] } },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
