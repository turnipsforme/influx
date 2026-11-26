// Run after npm ci: node scripts/benchmark-structuredtext.cjs <baseline-ref>
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');
const { makeSource } = require('./generate-performance-vault.cjs');

const baselineRef = process.argv[2];
if (!baselineRef) throw new Error('Provide a baseline commit/ref');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'influx-structuredtext-'));
try {
    function load(name, ref) {
        const directory = path.join(temp, name);
        fs.mkdirSync(directory);
        for (const file of ['StructuredText', 'structuredtext-utils']) {
            const source = ref
                ? execFileSync('git', ['show', ref + ':src/' + file + '.ts'], { encoding: 'utf8' })
                : fs.readFileSync(path.join(__dirname, '../src', file + '.ts'), 'utf8');
            const { outputText } = ts.transpileModule(source, {
                compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
            });
            fs.writeFileSync(path.join(directory, file + '.js'), outputText);
        }
        return require(path.join(directory, 'StructuredText.js')).StructuredText;
    }
    const before = load('before', baselineRef);
    const after = load('after');
    const excerpt = (Parser, source) => {
        const parsed = new Parser(source.content);
        return source.heading ? parsed.stringify() : parsed.stringifyBranchesOfNodesWithLinks(source.linkLines ?? [source.linkLine]);
    };
    const median = samples => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
    let sink = 0;
    const cases = [100, 1000, 5000].map(count => ({
        label: 'mixed-' + count,
        sources: Array.from({ length: count }, (_, index) => makeSource(index)),
    }));
    if (process.argv.includes('--extended')) {
        // Compare these against the corrected long-note parser, not older master.
        const makeNotes = (count, length, line, linkLines) => Array.from({ length: count }, (_, i) => ({
            path: 'Long-' + i + '.md',
            content: Array.from({ length }, (_, j) => line(j)).join('\n'),
            linkLines: linkLines(length),
        }));
        cases.push(
            { label: 'long-sparse', sources: makeNotes(32, 2000, j => j % 4 === 0 ? '- Root ' + j : j % 4 === 3 ? '' : '  - Child ' + j, n => [2, n - 2]) },
            { label: 'deep-sparse', sources: makeNotes(16, 250, j => ' '.repeat(j * 2) + '- Level ' + j, n => [Math.floor(n / 2)]) },
            { label: 'dense-overlap', sources: makeNotes(32, 500, j => j % 5 === 0 ? '- Root ' + j : '  - Child ' + j, n => Array.from({ length: n }, (_, j) => j)) },
        );
    }
    for (const { label, sources } of cases) {
        const count = sources.length;
        for (const source of sources) assert.equal(excerpt(after, source), excerpt(before, source), source.path);
        function run(Parser) {
            const start = performance.now();
            for (const source of sources) sink += excerpt(Parser, source).length;
            return performance.now() - start;
        }
        run(before);
        run(after);
        const baseline = [];
        const candidate = [];
        for (let i = 0; i < 7; i++) {
            if (i % 2) { candidate.push(run(after)); baseline.push(run(before)); }
            else { baseline.push(run(before)); candidate.push(run(after)); }
        }
        console.log('INFLUX_PARSER_PAIR ' + JSON.stringify({
            label, count, baselineRef, baseline, candidate, baselineMedian: median(baseline),
            candidateMedian: median(candidate), improvement: 1 - median(candidate) / median(baseline),
        }));
    }
    assert.ok(sink > 0);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
