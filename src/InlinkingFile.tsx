import { TFile, CachedMetadata } from 'obsidian';
import { ApiAdapter } from './apiAdapter';
import InfluxFile from './InfluxFile';
import { StructuredText } from './StructuredText';

const FRONTMATTER_KEY = 'influx-title' // Unexposed feature to show frontmatter value as title for clipping.


export class InlinkingFile {
    api: ApiAdapter;
    file: TFile;
    title: string;
    titleLineNum: number;
    isLinkInTitle: boolean;
    summary: string;

    constructor(file: TFile, apiAdapter: ApiAdapter) {
        this.api = apiAdapter
        this.file = file
    }

    public async makeSummary(contextFile: InfluxFile) {
        const content = await this.api.readFile(this.file)
        const struct = new StructuredText(content)
        const meta = this.api.getMetadata(this.file)
        const links = meta?.links
            ? meta.links.filter(link => this.api.compareLinkName(link, contextFile.file.basename))
            : []
        const lineNumbersOfLinks = links
            .filter(link => link.position && link.position.start)
            .map(link => link.position.start.line)

        this.setTitle(meta)
        this.isLinkInTitle = this.titleLineNum !== undefined && lineNumbersOfLinks.includes(this.titleLineNum)

        if (this.isLinkInTitle) {
            this.summary = struct.stringify()
        }
        else {
            this.summary = struct.stringifyBranchesOfNodesWithLinks(lineNumbersOfLinks)
            // console.log('this.summary', this.summary)
        }

    }

    setTitle(meta: CachedMetadata | null) {
        const titleByFrontmatterAttribute = meta?.frontmatter && FRONTMATTER_KEY in meta.frontmatter ? meta.frontmatter[FRONTMATTER_KEY] : null
        const titleByFirstHeader = meta?.headings?.[0]
        this.title = titleByFrontmatterAttribute || titleByFirstHeader?.heading || ''
        // Explicitly set to undefined if no position data available
        this.titleLineNum = titleByFirstHeader?.position?.start.line ?? undefined;
    }

}
