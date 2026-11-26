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
        return source.heading ? parsed.stringify() : parsed.stringifyBranchesOfNodesWithLinks([source.linkLine]);
    };
    const median = samples => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
    let sink = 0;
    for (const count of [100, 1000, 5000]) {
        const sources = Array.from({ length: count }, (_, index) => makeSource(index));
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
            count, baselineRef, baseline, candidate, baselineMedian: median(baseline),
            candidateMedian: median(candidate), improvement: 1 - median(candidate) / median(baseline),
        }));
    }
    assert.ok(sink > 0);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
