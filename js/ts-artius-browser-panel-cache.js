export const TS_CACHE_DEFAULT_TTL_MS = 30_000;
export const TS_CACHE_DEFAULT_CAPACITY = 10;


export class TSAssetResponseCache {
    constructor(tsOptions = {}) {
        this.tsCapacity = Math.max(1, Number(tsOptions.tsCapacity ?? TS_CACHE_DEFAULT_CAPACITY));
        this.tsTtlMs = Math.max(0, Number(tsOptions.tsTtlMs ?? TS_CACHE_DEFAULT_TTL_MS));
        this.tsNow = typeof tsOptions.tsNow === "function" ? tsOptions.tsNow : () => Date.now();
        this.tsEntries = new Map();
    }

    tsGet(tsKey) {
        const tsEntry = this.tsEntries.get(tsKey);
        if (!tsEntry) {
            return null;
        }
        this.tsEntries.delete(tsKey);
        this.tsEntries.set(tsKey, tsEntry);
        const tsAgeMs = this.tsNow() - tsEntry.tsStoredAt;
        return {
            tsPayload: tsEntry.tsPayload,
            tsIsStale: tsAgeMs >= this.tsTtlMs,
            tsAgeMs,
        };
    }

    tsSet(tsKey, tsPayload) {
        this.tsEntries.delete(tsKey);
        this.tsEntries.set(tsKey, { tsPayload, tsStoredAt: this.tsNow() });
        while (this.tsEntries.size > this.tsCapacity) {
            const tsOldestKey = this.tsEntries.keys().next().value;
            this.tsEntries.delete(tsOldestKey);
        }
    }

    tsDelete(tsKey) {
        this.tsEntries.delete(tsKey);
    }

    tsClear() {
        this.tsEntries.clear();
    }

    get tsSize() {
        return this.tsEntries.size;
    }
}
