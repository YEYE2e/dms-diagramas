import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { repositoryPlugin } from "./scripts/repository-store.mjs";

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [svelte(), repositoryPlugin()],
});
