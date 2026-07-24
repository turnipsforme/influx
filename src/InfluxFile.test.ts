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
        getBacklinks: jest.fn(() => ({ data: backlinkData })),
        getMetadata: jest.fn(),
        getShowStatus: jest.fn(() => true),
        getCollapsedStatus: jest.fn(() => false),
        isIncludableSource: jest.fn(() => true),
        renderAllMarkdownBlocks: jest.fn(),
    } as unknown as ApiAdapter;

    return { api, file };
}

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
});
