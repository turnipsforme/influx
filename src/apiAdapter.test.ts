jest.mock('obsidian', () => ({
    Component: class MockComponent {
        load() {}
        unload() {}
    },
    MarkdownRenderer: { renderMarkdown: jest.fn() },
    TFile: class MockTFile {
        path: string;
        constructor(path: string) {
            this.path = path;
        }
    },
}), { virtual: true });

jest.mock('./main', () => ({
    DEFAULT_SETTINGS: {
        useBacklinkCache: false,
        includeFrontmatterLinks: false,
        frontmatterProperties: [] as string[],
    },
}));

import { TFile } from 'obsidian';
import { ApiAdapter } from './apiAdapter';

describe('ApiAdapter backlink reliability', () => {
    test('retries an empty result but caches a populated result', async () => {
        const link = { link: 'Target' };
        const nativeBacklinks = jest.fn()
            .mockReturnValueOnce({ data: new Map() })
            .mockReturnValue({ data: new Map([['Source.md', [link]]]) });
        const app = {
            metadataCache: {
                getBacklinksForFile: nativeBacklinks,
                getFileCache: jest.fn((): null => null),
            },
            plugins: {
                plugins: {
                    influx: {
                        data: {
                            settings: {
                                useBacklinkCache: false,
                                includeFrontmatterLinks: false,
                                frontmatterProperties: [] as string[],
                            },
                        },
                    },
                },
            },
        } as any;
        const adapter = new ApiAdapter(app);
        const file = new (TFile as any)('Target.md');

        await expect(adapter.getBacklinks(file)).resolves.toMatchObject({
            incomingSourcePaths: [],
        });
        await expect(adapter.getBacklinks(file)).resolves.toMatchObject({
            incomingSourcePaths: ['Source.md'],
        });
        await adapter.getBacklinks(file);

        expect(nativeBacklinks).toHaveBeenCalledTimes(2);
    });
});
