jest.mock('./main', () => ({
    __esModule: true,
    default: class MockInfluxPlugin {},
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

import type { LinkCache, TFile } from 'obsidian';
import InfluxFile from './InfluxFile';
import type { ApiAdapter } from './apiAdapter';
import type ObsidianInflux from './main';

function createApi(backlinkData: Map<string, LinkCache[]> | Record<string, LinkCache[]>) {
    const file = { path: 'Target.md', basename: 'Target' } as TFile;
    const api = {
        getFileByPath: jest.fn(() => file),
        getBacklinks: jest.fn(async () => ({ data: backlinkData })),
        getMetadata: jest.fn(),
        getShowStatus: jest.fn(() => true),
        getCollapsedStatus: jest.fn(() => false),
        isIncludableSource: jest.fn(() => true),
        renderAllMarkdownBlocks: jest.fn(),
    } as unknown as ApiAdapter;

    return { api, file };
}

const link = { link: 'Target' } as LinkCache;

describe('InfluxFile processing guard', () => {
    test.each([
        new Map<string, LinkCache[]>(),
        {},
        new Map<string, LinkCache[]>([['Source.md', []]]),
        { 'Source.md': [] },
    ])('does no metadata, filter, or rendering work without backlinks', async (data) => {
        const { api } = createApi(data);
        const influxFile = await InfluxFile.create(
            'Target.md',
            api,
            {} as ObsidianInflux,
        );
        const makeInfluxList = jest.spyOn(influxFile, 'makeInfluxList');
        const renderAllMarkdownBlocks = jest.spyOn(influxFile, 'renderAllMarkdownBlocks');

        await expect(influxFile.prepare()).resolves.toBe(false);

        expect(api.getMetadata).not.toHaveBeenCalled();
        expect(api.getShowStatus).not.toHaveBeenCalled();
        expect(api.getCollapsedStatus).not.toHaveBeenCalled();
        expect(makeInfluxList).not.toHaveBeenCalled();
        expect(renderAllMarkdownBlocks).not.toHaveBeenCalled();
        expect(api.renderAllMarkdownBlocks).not.toHaveBeenCalled();
    });

    test.each([
        {
            name: 'an added backlink',
            initial: new Map<string, LinkCache[]>(),
            current: new Map<string, LinkCache[]>([['Source.md', [link]]]),
            changedPath: 'Source.md',
            expected: true,
        },
        {
            name: 'a removed backlink',
            initial: new Map<string, LinkCache[]>([['Source.md', [link]]]),
            current: new Map<string, LinkCache[]>(),
            changedPath: 'Source.md',
            expected: true,
        },
        {
            name: 'an unrelated file',
            initial: new Map<string, LinkCache[]>([['Source.md', [link]]]),
            current: new Map<string, LinkCache[]>([['Source.md', [link]]]),
            changedPath: 'Other.md',
            expected: false,
        },
        {
            name: 'the target file itself',
            initial: new Map<string, LinkCache[]>(),
            current: new Map<string, LinkCache[]>(),
            changedPath: 'Target.md',
            expected: true,
        },
    ])('refreshes for $name', async ({ initial, current, changedPath, expected }) => {
        const { api } = createApi(initial);
        const influxFile = await InfluxFile.create(
            'Target.md',
            api,
            {} as ObsidianInflux,
        );
        (api.getBacklinks as jest.Mock).mockResolvedValue({ data: current });

        await expect(influxFile.shouldUpdate({ path: changedPath } as TFile)).resolves.toBe(expected);
    });
});
