import { test, expect } from "@playwright/test";
async function settled(page) {
  await expect(
    page.getByRole("button", { name: "Ordenar diagrama", exact: true }),
  ).toBeEnabled();
}
async function connect(page, source, target, label = "") {
  if (!(await page.getByLabel("Desde", { exact: true }).isVisible()))
    await page.getByRole("button", { name: "Conectar", exact: true }).click();
  await page.getByLabel("Desde", { exact: true }).selectOption(source);
  await page.getByLabel("Hacia", { exact: true }).selectOption(target);
  await page.getByLabel("Etiqueta", { exact: true }).first().fill(label);
  await page
    .getByRole("button", { name: /^\+ Crear (relación|mensaje)$/ })
    .click();
  await settled(page);
}
async function selectEdge(page, index) {
  const path = await page
    .locator(".svelte-flow__edge")
    .nth(index)
    .locator(".svelte-flow__edge-interaction")
    .boundingBox();
  expect(path).not.toBeNull();
  await page.mouse.click(
    path.x + path.width * 0.25,
    path.y + path.height * 0.5,
  );
}
test("minimal ER editor: native connections, undo, routing, persistence and JSON", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await settled(page);
  await expect(page.getByLabel("Tipo de diagrama")).toHaveValue("er");
  await expect(
    page.getByLabel("Tipo de diagrama").locator("option"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "+ Entidad", exact: true }).click();
  await settled(page);
  await expect(page.locator(".svelte-flow__node")).toHaveCount(3);
  await page.getByLabel("Nombre", { exact: true }).fill("Productos");
  await page.getByLabel("Nombre", { exact: true }).press("Tab");
  await expect(
    page.locator(".svelte-flow__node").filter({ hasText: "Productos" }),
  ).toHaveCount(1);
  await expect(page.getByText("Guardado local", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(
    page.locator(".svelte-flow__node").filter({ hasText: "Nueva entidad" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(
    page.locator(".svelte-flow__node").filter({ hasText: "Productos" }),
  ).toHaveCount(1);
  const closeProperties=page.getByRole('button',{name:'Cerrar propiedades',exact:true});
  if(await closeProperties.isVisible())await closeProperties.click();
  const source = page
    .locator('[data-id="t0"] .svelte-flow__handle.source')
    .first();
  const target = page
    .locator('[data-id="t1"] .svelte-flow__handle.target')
    .first();
  await source.dragTo(target);
  await settled(page);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(2);
  await expect(page.locator(".routed-relation")).toHaveCount(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "test-results/er-editor.png" });
  await page.locator(".file-menu summary").click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar JSON", exact: true })
    .click();
  const download = await downloadPromise;
  const file = await download.path();
  await page.reload();
  await settled(page);
  await expect(page.locator(".svelte-flow__node")).toHaveCount(3);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(2);
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '{"nodes":[],"edges":[{"id":"bad","source":"x","target":"y"}]}',
      ),
    });
  await expect(page.getByRole("alert")).toContainText("No se pudo importar");
  await expect(page.locator(".svelte-flow__node")).toHaveCount(3);
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".routed-relation")).toHaveCount(2);
  expect(errors).toEqual([]);
});
test("sequence uses unique message rows and ER work survives type changes", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await settled(page);
  await page.locator('[data-id="t0"]').click();
  await page.getByRole("button", { name: "+ Añadir", exact: true }).click();
  await settled(page);
  await page.getByLabel("Nombre del atributo 3").fill("email");
  await page.getByLabel("Nombre del atributo 3").press("Tab");
  await page.getByLabel("Tipo de diagrama").selectOption("sequence");
  await settled(page);
  await expect(page.locator(".svelte-flow__node-participant")).toHaveCount(3);
  await connect(page, "p0", "p2", "Confirmar");
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Cerrar conexiones", exact: true })
    .click();
  await selectEdge(page, 4);
  await page.getByLabel("Mensaje de retorno").check();
  await page
    .getByRole("button", { name: "↑ Subir mensaje", exact: true })
    .click();
  await settled(page);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Eliminar conexión", exact: true })
    .click();
  await settled(page);
  await expect(page.locator(".svelte-flow__edge")).toHaveCount(4);
  await page.screenshot({ path: "test-results/sequence-editor.png" });
  await page.getByLabel("Tipo de diagrama").selectOption("er");
  await settled(page);
  await expect(
    page.locator(".svelte-flow__node").filter({ hasText: "email" }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("canvas uses screen space and dialogs work with the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await settled(page);
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const canvas = await page.locator(".canvas").boundingBox();
    expect(canvas.width).toBeGreaterThan(width * 0.95);
    await expect(page.getByLabel("Tipo de diagrama")).toBeVisible();
  }
  await page.locator(".file-menu summary").click();
  await page
    .getByRole("button", { name: "Vaciar lienzo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".svelte-flow__node")).toHaveCount(2);
});
