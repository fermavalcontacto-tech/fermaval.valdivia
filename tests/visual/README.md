# Visual snapshot tests

Playwright tests that render `NuevaCotizacionDialog` and `ItemsEditor` at the
two reference viewports (390×844 mobile, 1280×900 desktop) and assert:

- every required field is visible (Nombre, Precio/m², Responsable, Tipo,
  Largo, Cantidad, Color),
- the dialog and the page have no horizontal overflow,
- the rendered pixels match the committed baseline screenshots.

## Running

```bash
bun run dev            # in another shell, on http://localhost:8080
bun run test:visual    # runs both projects (mobile-390, desktop-1280)
```

Inside the Lovable sandbox the Supabase session is auto-injected via
`LOVABLE_BROWSER_SUPABASE_*` env vars. Outside it, export those manually or
the suite skips itself.

## Updating baselines

After an intentional UI change:

```bash
bun run test:visual -- --update-snapshots
```

Review the new PNGs in `tests/visual/__screenshots__/` before committing.

## First-run setup

Playwright needs its Chromium binary the first time:

```bash
bunx playwright install chromium
```
