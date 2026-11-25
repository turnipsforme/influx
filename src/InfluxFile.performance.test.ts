/** @jest-environment jsdom */
jest.mock('obsidian', () => ({
    Component: class MockComponent { load() {} unload() {} },
    MarkdownRenderer: {
        render: async (_app: unknown, markdown: string, element: HTMLElement) => {
            // Deliberately not Obsidian's renderer: exercise the adapter/DOM only.
            element.textContent = markdown;
        },
    },
    getLinkpath: (link: string) => link.split('#')[0],
    TFile: class MockTFile {
        path: string;
        basename: string;
        constructor(path: string) {
            this.path = path;
            this.basename = path.replace(/\.md$/, '');
        }
    },
}), { virtual: true });
jest.mock('./main', () => ({
    __esModule: true,
    default: class MockInfluxPlugin {},
    DEFAULT_SETTINGS: {
        showBehaviour: 'OPT_OUT', sourceBehaviour: 'OPT_OUT',
        inclusionPattern: [] as string[], exclusionPattern: [] as string[], collapsedPattern: [] as string[],
        sourceInclusionPattern: [] as string[], sourceExclusionPattern: [] as string[],
        sortingAttribute: 'FILENAME', sortingPrinciple: 'OLDEST_FIRST',
        useBacklinkCache: false, includeFrontmatterLinks: false,
        frontmatterProperties: [] as string[], showWithoutBacklinks: false,
    },
}));
jest.mock('uuid', () => ({ v4: () => 'benchmark-uuid' }));

import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { TFile } from 'obsidian';
import { ApiAdapter } from './apiAdapter';
import InfluxFile from './InfluxFile';
import type ObsidianInflux from './main';

type Source = {
    path: string;
    content: string;
    linkLine: number;
    embed: boolean;
    heading: boolean;
    frontmatterTitle?: string;
};
const { sizes, makeSource } = require('../scripts/generate-performance-vault.cjs') as {
    sizes: number[];
    makeSource: (index: number) => Source;
};

const cases = sizes.flatMap(count => [0, 10].flatMap(listLimit =>
    ['map', 'object'].map(shape => ({ count, listLimit, shape }))));

test.each(cases)('synthetic baseline $count sources, limit=$listLimit, $shape', async ({ count, listLimit, shape }) => {
    const sources = Array.from({ length: count }, (_, i) => makeSource(i));
    const byPath = new Map(sources.map(source => [source.path, source]));
    const target = new (TFile as any)('Target.md') as TFile;
    const files = new Map<string, TFile>([[target.path, target], ...sources.map(source =>
        [source.path, new (TFile as any)(source.path)] as [string, TFile])]);
    const groups = sources.map(source => [source.path, [{
        link: 'Target', position: { start: { line: source.linkLine } },
    }]] as const);
    const data = shape === 'map' ? new Map(groups) : Object.fromEntries(groups);
    let nativeCalls = 0;
    let reads = 0;
    const app = {
        vault: {
            getAbstractFileByPath: (path: string) => files.get(path),
            cachedRead: async (file: TFile) => {
                reads++;
                return byPath.get(file.path)!.content;
            },
        },
        metadataCache: {
            getBacklinksForFile: () => { nativeCalls++; return { data }; },
            getFirstLinkpathDest: () => target,
            getFileCache: (file: TFile) => {
                const source = byPath.get(file.path);
                if (!source) return null;
                const link = { link: 'Target', position: { start: { line: source.linkLine } } };
                return {
                    links: source.embed ? [] : [link],
                    embeds: source.embed ? [link] : [],
                    headings: source.heading ? [{
                        heading: 'Heading with [[Target]]', position: { start: { line: source.linkLine } },
                    }] : [],
                    frontmatter: source.frontmatterTitle ? { 'influx-title': source.frontmatterTitle } : undefined,
                };
            },
        },
        plugins: { plugins: { influx: { data: { settings: { listLimit } } } } },
    };
    const adapter = new ApiAdapter(app as any);
    const expected = sources.slice(0, listLimit || count).map(source => source.path);
    let coldDigest: string | undefined;

    try {
        for (const phase of ['cold', 'warm']) {
            const start = performance.now();
            const cpuStart = process.cpuUsage();
            const memoryStart = process.memoryUsage();
            const nativeStart = nativeCalls;
            const readStart = reads;
            const influx = await InfluxFile.create(target.path, adapter, {} as ObsidianInflux);
            const backlinksMs = performance.now() - start;
            let summaryMs = 0;
            let mockRenderMs = 0;
            const makeList = influx.makeInfluxList.bind(influx);
            influx.makeInfluxList = async () => {
                const t = performance.now();
                await makeList();
                summaryMs = performance.now() - t;
            };
            const render = influx.renderAllMarkdownBlocks.bind(influx);
            influx.renderAllMarkdownBlocks = async () => {
                const t = performance.now();
                const result = await render();
                mockRenderMs = performance.now() - t;
                return result;
            };
            const visible = await influx.prepare();
            const elapsedMs = performance.now() - start;
            const cpu = process.cpuUsage(cpuStart);
            const memory = process.memoryUsage();
            expect(visible).toBe(count > 0);
            expect(influx.backlinks.incomingSourcePaths).toEqual(sources.map(source => source.path));
            expect(influx.components.map(component => component.inlinkingFile.file.path)).toEqual(expected);
            const digest = createHash('sha256').update(JSON.stringify(influx.components.map(component => ({
                path: component.inlinkingFile.file.path,
                title: component.inlinkingFile.title,
                summary: component.inlinkingFile.summary,
            })))).digest('hex');
            if (phase === 'cold') coldDigest = digest;
            else expect(digest).toBe(coldDigest);
            console.log('INFLUX_BASELINE ' + JSON.stringify({
                count, listLimit, shape, phase, elapsedMs, backlinksMs, summaryMs, mockRenderMs,
                nativeCalls: nativeCalls - nativeStart, reads: reads - readStart,
                cpuMs: (cpu.user + cpu.system) / 1000,
                heapDeltaBytes: memory.heapUsed - memoryStart.heapUsed,
                rssBytes: memory.rss, digest,
            }));
        }
    } finally {
        adapter.dispose();
    }
}, 120000);
