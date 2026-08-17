import {
    BACKLINK_CACHE_GITHUB_URL,
    BACKLINK_CACHE_OBSIDIAN_URL,
    getFreshBacklinks,
    isBacklinkCacheActive,
    type BacklinkMetadataCache,
    type RawBacklinksObject,
} from './backlink-cache';
import type { TFile } from 'obsidian';

const file = { path: 'Target.md' } as TFile;
const nativeResult: RawBacklinksObject = { data: { 'Native.md': [] } };
const safeResult: RawBacklinksObject = { data: { 'Safe.md': [] } };

describe('Backlink Cache integration', () => {
    test('uses Obsidian backlinks when the optional patch is absent', async () => {
        const native = jest.fn(() => nativeResult);
        const metadataCache = { getBacklinksForFile: native } as BacklinkMetadataCache;

        await expect(getFreshBacklinks(metadataCache, file)).resolves.toBe(nativeResult);
        expect(native).toHaveBeenCalledWith(file);
        expect(isBacklinkCacheActive(metadataCache)).toBe(false);
    });

    test('uses the safe cache path when Backlink Cache is active', async () => {
        const native = jest.fn(() => nativeResult);
        const safe = jest.fn(async () => safeResult);
        const getBacklinksForFile = Object.assign(native, {
            originalFn: jest.fn(() => nativeResult),
            safe,
        });
        const metadataCache = { getBacklinksForFile } as BacklinkMetadataCache;

        await expect(getFreshBacklinks(metadataCache, file)).resolves.toBe(safeResult);
        expect(safe).toHaveBeenCalledWith(file);
        expect(native).not.toHaveBeenCalled();
        expect(isBacklinkCacheActive(metadataCache)).toBe(true);
    });

    test('detects the patch lazily after adapter construction', async () => {
        const native = jest.fn(() => nativeResult);
        const metadataCache = { getBacklinksForFile: native } as BacklinkMetadataCache;

        await expect(getFreshBacklinks(metadataCache, file)).resolves.toBe(nativeResult);

        Object.assign(native, {
            originalFn: jest.fn(() => nativeResult),
            safe: jest.fn(async () => safeResult),
        });

        await expect(getFreshBacklinks(metadataCache, file)).resolves.toBe(safeResult);
        expect(isBacklinkCacheActive(metadataCache)).toBe(true);
    });

    test('keeps the documented settings links stable', () => {
        expect(BACKLINK_CACHE_OBSIDIAN_URL).toBe('https://obsidian.md/plugins?id=backlink-cache');
        expect(BACKLINK_CACHE_GITHUB_URL).toBe('https://github.com/mnaoumov/obsidian-backlink-cache');
    });
});
