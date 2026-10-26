import { spawnSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import { serveBuild } from "./serve-test.mjs";
const base = "/dms-diagramas/";
const build = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  { env: { ...process.env, VITE_BASE_PATH: base }, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status || 1);
const server = await serveBuild(base, 0);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const response = await page.goto(
    `http://127.0.0.1:${server.address().port}${base}?diagram=modelo-pedidos`,
  );
  expect(response.status()).toBe(200);
  await expect(page.getByLabel("Nombre del diagrama")).toHaveValue(
    "Modelo de pedidos",
  );
  await expect(page.locator(".svelte-flow__node-entity")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Ordenar diagrama", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ordenar diagrama", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".routed-relation")).toHaveCount(1);
  await page.getByRole("button", { name: "Diagramas", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Consulta de datos Diagrama de secuencia",
      exact: true,
    })
    .click();
  await expect(page.locator(".svelte-flow__node-participant")).toHaveCount(3);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "Pages: subdirectory, diagram library, direct links and ELK worker verified.",
  );
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
