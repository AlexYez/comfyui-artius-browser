// Playwright config for Timesaver Artius Browser e2e smoke tests.
// Override the target ComfyUI URL with TS_COMFY_URL env var if you run
// ComfyUI on a different host or port (default: http://127.0.0.1:8188).

import { defineConfig } from "@playwright/test";

const tsComfyUrl = process.env.TS_COMFY_URL || "http://127.0.0.1:8188";

export default defineConfig({
    testDir: ".",
    testMatch: /.*\.spec\.mjs$/,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: tsComfyUrl,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
});
