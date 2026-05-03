import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tsScriptDir = path.dirname(fileURLToPath(import.meta.url));
const tsRepoRoot = path.resolve(tsScriptDir, "..");
const tsCacheModulePath = path.join(tsRepoRoot, "js", "ts-artius-browser-panel-cache.js");

let tsAssertionCount = 0;
function tsAssert(tsCondition, tsMessage) {
    tsAssertionCount += 1;
    assert.ok(tsCondition, tsMessage);
}
function tsEqual(tsActual, tsExpected, tsMessage) {
    tsAssertionCount += 1;
    assert.deepEqual(tsActual, tsExpected, tsMessage);
}

const tsCacheModule = await import(`${pathToFileURL(tsCacheModulePath).href}?ts=${Date.now()}`);
const { TSAssetResponseCache, TS_CACHE_DEFAULT_CAPACITY, TS_CACHE_DEFAULT_TTL_MS } = tsCacheModule;

function tsBuildClock() {
    let tsCurrent = 1000;
    return {
        tsNow: () => tsCurrent,
        tsAdvance: (tsMs) => { tsCurrent += tsMs; },
    };
}

function tsRunBasicTests() {
    const tsClock = tsBuildClock();
    const tsCache = new TSAssetResponseCache({ tsCapacity: 3, tsTtlMs: 1000, tsNow: tsClock.tsNow });

    tsEqual(tsCache.tsGet("missing"), null, "missing key returns null");
    tsEqual(tsCache.tsSize, 0, "fresh cache is empty");

    tsCache.tsSet("a", { items: [1] });
    tsEqual(tsCache.tsSize, 1, "set inserts an entry");

    const tsHit = tsCache.tsGet("a");
    tsAssert(tsHit !== null, "stored key returns hit");
    tsEqual(tsHit.tsPayload.items, [1], "hit returns stored payload");
    tsEqual(tsHit.tsIsStale, false, "fresh entry is not stale");
    tsEqual(tsHit.tsAgeMs, 0, "fresh entry has zero age");
}

function tsRunStaleTests() {
    const tsClock = tsBuildClock();
    const tsCache = new TSAssetResponseCache({ tsCapacity: 3, tsTtlMs: 100, tsNow: tsClock.tsNow });

    tsCache.tsSet("a", { items: ["fresh"] });
    tsClock.tsAdvance(50);
    tsEqual(tsCache.tsGet("a").tsIsStale, false, "entry within TTL is fresh");

    tsClock.tsAdvance(60);
    const tsStaleHit = tsCache.tsGet("a");
    tsAssert(tsStaleHit !== null, "stale entry is still returned");
    tsEqual(tsStaleHit.tsIsStale, true, "entry past TTL is reported as stale");
    tsEqual(tsStaleHit.tsAgeMs, 110, "stale entry age reflects elapsed time");
}

function tsRunLruEvictionTests() {
    const tsClock = tsBuildClock();
    const tsCache = new TSAssetResponseCache({ tsCapacity: 3, tsTtlMs: 60_000, tsNow: tsClock.tsNow });

    tsCache.tsSet("a", { tag: "a" });
    tsCache.tsSet("b", { tag: "b" });
    tsCache.tsSet("c", { tag: "c" });
    tsEqual(tsCache.tsSize, 3, "cache fills to capacity");

    tsCache.tsSet("d", { tag: "d" });
    tsEqual(tsCache.tsSize, 3, "capacity stays at limit after insert");
    tsEqual(tsCache.tsGet("a"), null, "oldest entry evicted on overflow");
    tsAssert(tsCache.tsGet("d") !== null, "newest entry survives");

    tsCache.tsGet("b");
    tsCache.tsSet("e", { tag: "e" });
    tsAssert(tsCache.tsGet("b") !== null, "recently accessed entry stays");
    tsEqual(tsCache.tsGet("c"), null, "least-recently-used entry evicted next");
}

function tsRunUpdateAndDeleteTests() {
    const tsClock = tsBuildClock();
    const tsCache = new TSAssetResponseCache({ tsCapacity: 3, tsTtlMs: 1000, tsNow: tsClock.tsNow });

    tsCache.tsSet("a", { value: 1 });
    tsClock.tsAdvance(500);
    tsCache.tsSet("a", { value: 2 });
    const tsHit = tsCache.tsGet("a");
    tsEqual(tsHit.tsPayload.value, 2, "set replaces previous payload");
    tsEqual(tsHit.tsAgeMs, 0, "set resets entry age");

    tsCache.tsDelete("a");
    tsEqual(tsCache.tsGet("a"), null, "delete removes entry");

    tsCache.tsSet("a", { value: 3 });
    tsCache.tsSet("b", { value: 4 });
    tsCache.tsClear();
    tsEqual(tsCache.tsSize, 0, "clear removes everything");
    tsEqual(tsCache.tsGet("a"), null, "cleared cache misses prior keys");
}

function tsRunDefaultsTests() {
    tsAssert(TS_CACHE_DEFAULT_CAPACITY > 0, "default capacity is positive");
    tsAssert(TS_CACHE_DEFAULT_TTL_MS > 0, "default ttl is positive");
    const tsCache = new TSAssetResponseCache();
    tsEqual(tsCache.tsCapacity, TS_CACHE_DEFAULT_CAPACITY, "default capacity is applied");
    tsEqual(tsCache.tsTtlMs, TS_CACHE_DEFAULT_TTL_MS, "default ttl is applied");

    const tsClampedCapacity = new TSAssetResponseCache({ tsCapacity: 0 });
    tsEqual(tsClampedCapacity.tsCapacity, 1, "capacity is clamped to >= 1");

    const tsClampedTtl = new TSAssetResponseCache({ tsTtlMs: -5 });
    tsEqual(tsClampedTtl.tsTtlMs, 0, "ttl is clamped to >= 0");
}

tsRunBasicTests();
tsRunStaleTests();
tsRunLruEvictionTests();
tsRunUpdateAndDeleteTests();
tsRunDefaultsTests();

console.log(`frontend cache characterization: ${tsAssertionCount} assertions OK`);
