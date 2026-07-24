import type { LinkCache } from 'obsidian';

export type BacklinkData = Map<string, LinkCache[]> | Record<string, LinkCache[]>;

export interface BacklinksLike {
    data?: BacklinkData;
    /** Native incoming links before any optional relationship augmentation. */
    incomingData?: BacklinkData;
}

/**
 * Return the source paths that contain at least one backlink.
 * Obsidian has exposed backlink data as both a Map and a plain object.
 */
export function getBacklinkSourcePaths(backlinks: BacklinksLike | null | undefined): string[] {
    const data = backlinks?.incomingData ?? backlinks?.data;
    if (!data) {
        return [];
    }

    const entries = data instanceof Map
        ? Array.from(data.entries())
        : Object.entries(data);

    return entries
        .filter(([, links]) => Array.isArray(links) && links.length > 0)
        .map(([path]) => path);
}

/** True only when at least one actual incoming link is present. */
export function hasBacklinkEntries(backlinks: BacklinksLike | null | undefined): boolean {
    return getBacklinkSourcePaths(backlinks).length > 0;
}

/** Stable signature used to detect backlink additions and removals. */
export function getBacklinkSourceSignature(backlinks: BacklinksLike | null | undefined): string {
    return getBacklinkSourcePaths(backlinks).sort().join('\n');
}
