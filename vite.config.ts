// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Base path: solo se aplica cuando compilas para GitHub Pages
// (ejecuta con `GITHUB_PAGES=1 bun run build`). En desarrollo y en la
// preview/publicación de Lovable se mantiene "/" para que los assets carguen.
const isGithubPages = process.env.GITHUB_PAGES === "1";

export default defineConfig({
  vite: {
    base: isGithubPages ? "/fermaval.valdivia/" : "/",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
