import type { LinkCache } from 'obsidian';
import {
    getBacklinkSourcePaths,
    getBacklinkSourceSignature,
    hasBacklinkEntries,
} from './backlink-utils';

const link = { link: 'Target' } as LinkCache;

describe('backlink utilities', () => {
    test('recognizes populated Map backlink data', () => {
        const backlinks = { data: new Map([['Source.md', [link]]]) };

        expect(hasBacklinkEntries(backlinks)).toBe(true);
        expect(getBacklinkSourcePaths(backlinks)).toEqual(['Source.md']);
    });

    test('recognizes populated object backlink data', () => {
        const backlinks = { data: { 'Source.md': [link] } };

        expect(hasBacklinkEntries(backlinks)).toBe(true);
        expect(getBacklinkSourcePaths(backlinks)).toEqual(['Source.md']);
    });

    test.each([
        null,
        undefined,
        {},
        { data: new Map() },
        { data: {} },
        { data: new Map([['Source.md', []]]) },
        { data: { 'Source.md': [] } },
    ])('does not treat empty backlink structures as backlinks', (backlinks) => {
        expect(hasBacklinkEntries(backlinks)).toBe(false);
        expect(getBacklinkSourcePaths(backlinks)).toEqual([]);
    });

    test('creates an order-independent source signature', () => {
        const first = { data: new Map([
            ['B.md', [link]],
            ['A.md', [link]],
        ]) };
        const second = { data: {
            'A.md': [link],
            'B.md': [link],
        } };

        expect(getBacklinkSourceSignature(first)).toBe('A.md\nB.md');
        expect(getBacklinkSourceSignature(second)).toBe('A.md\nB.md');
    });

    test('does not count target-owned outbound relationship data as incoming', () => {
        const backlinks = {
            data: new Map([['Outbound destination.md', [link]]]),
            incomingData: new Map<string, LinkCache[]>(),
        };

        expect(hasBacklinkEntries(backlinks)).toBe(false);
        expect(getBacklinkSourcePaths(backlinks)).toEqual([]);
    });
});
