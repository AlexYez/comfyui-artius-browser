// Smoke test: every native node ID this pack drags onto the canvas must
// resolve on the running ComfyUI server. If ComfyUI ever renames LoadImage
// /LoadVideo/LoadAudio/Load3D, this test fails before users do.
//
// The ID list is hard-coded to mirror js/ts-artius-browser-settings.js
// `tsApiSettings.nativeWorkflowTargets[*].tsNodeType`. If a new asset type
// is added there, also extend this list — and the .pre-commit-config.yaml
// `no-native-node-id-literals` hook keeps both files honest about being
// the only places these IDs appear.

import { test, expect } from "@playwright/test";

const TS_NATIVE_NODE_IDS = ["LoadImage", "LoadVideo", "LoadAudio", "Load3D"];

for (const tsNodeId of TS_NATIVE_NODE_IDS) {
    test(`native node "${tsNodeId}" resolves on /object_info`, async ({ request }) => {
        const tsResponse = await request.get(`/object_info/${tsNodeId}`);
        expect(tsResponse.ok(), `GET /object_info/${tsNodeId} status ${tsResponse.status()}`).toBeTruthy();
        const tsBody = await tsResponse.json();
        expect(tsBody[tsNodeId], `node ${tsNodeId} not present in /object_info payload`).toBeDefined();
        const tsInputs = tsBody[tsNodeId]?.input;
        expect(tsInputs, `node ${tsNodeId} has no input schema`).toBeTruthy();
    });
}

test("artius browser /version endpoint reports a local version", async ({ request }) => {
    const tsResponse = await request.get("/asset_browser/version");
    expect(tsResponse.ok()).toBeTruthy();
    const tsBody = await tsResponse.json();
    expect(typeof tsBody.local).toBe("string");
    expect(tsBody.local.length).toBeGreaterThan(0);
});
