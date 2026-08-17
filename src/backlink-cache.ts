import type { LinkCache, TFile } from 'obsidian';

export const BACKLINK_CACHE_OBSIDIAN_URL = 'https://obsidian.md/plugins?id=backlink-cache';
export const BACKLINK_CACHE_GITHUB_URL = 'https://github.com/mnaoumov/obsidian-backlink-cache';

export type RawBacklinksObject = {
    data: Map<string, LinkCache[]> | Record<string, LinkCache[]>;
};

type GetBacklinksForFile = ((file: TFile | string) => RawBacklinksObject) & {
    originalFn?: (file: TFile) => RawBacklinksObject;
    safe?: (file: TFile | string) => Promise<RawBacklinksObject>;
};

export type BacklinkMetadataCache = {
    getBacklinksForFile?: GetBacklinksForFile;
};

/**
 * Feature-detect Backlink Cache's documented runtime patch.
 * This is intentionally checked on demand so plugin load order does not matter.
 */
export function isBacklinkCacheActive(metadataCache: BacklinkMetadataCache): boolean {
    const getBacklinksForFile = metadataCache.getBacklinksForFile;
    return typeof getBacklinksForFile?.safe === 'function'
        && typeof getBacklinksForFile?.originalFn === 'function';
}

/**
 * Use Backlink Cache's safe path when available, otherwise use Obsidian's
 * native synchronous implementation. No timers or polling are involved.
 */
export async function getFreshBacklinks(
    metadataCache: BacklinkMetadataCache,
    file: TFile,
): Promise<RawBacklinksObject> {
    const getBacklinksForFile = metadataCache.getBacklinksForFile;
    if (typeof getBacklinksForFile !== 'function') {
        return { data: new Map() };
    }

    if (isBacklinkCacheActive(metadataCache)) {
        return await getBacklinksForFile.safe!(file);
    }

    return getBacklinksForFile.call(metadataCache, file);
}
