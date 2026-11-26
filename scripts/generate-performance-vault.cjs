const fs = require('node:fs');
const path = require('node:path');

const sizes = [0, 10, 100, 1000, 5000];

function makeSource(index) {
    const filler = Array.from({ length: [2, 8, 32, 128][index % 4] }, (_, line) =>
        'Context ' + index + ', paragraph ' + line + ': deterministic source text.');
    const structures = [
        ['A paragraph with [[Target]].'],
        ['- Parent item', '  - Child with [[Target]]', '  - Sibling'],
        ['1. Parent item', '   1. Child with [[Target]]'],
        ['> [!note] Context', '> Text with [[Target]]'],
        ['| Subject | Detail |', '| --- | --- |', '| [[Target]] | Context |'],
        ['# Heading with [[Target]]', 'Body text'],
        ['Embedded reference: ![[Target]]'],
        ['---', 'influx-title: Source ' + index, '---', '', 'Text with [[Target]]'],
    ];
    const lines = [...structures[index % structures.length], '', ...filler];
    return {
        path: 'Source-' + String(index).padStart(5, '0') + '.md',
        content: lines.join('\n') + '\n',
        linkLine: lines.findIndex(line => line.includes('[[Target]]')),
        embed: index % structures.length === 6,
        heading: index % structures.length === 5,
        frontmatterTitle: index % structures.length === 7 ? 'Source ' + index : undefined,
    };
}

function generate(root) {
    // Refuse an existing destination; never overwrite a real vault.
    fs.mkdirSync(root);
    for (const count of sizes) {
        const vault = path.join(root, 'incoming-' + count);
        fs.mkdirSync(vault);
        fs.writeFileSync(path.join(vault, 'Target.md'), '# Target\n');
        for (let index = 0; index < count; index++) {
            const source = makeSource(index);
            fs.writeFileSync(path.join(vault, source.path), source.content);
        }
    }
}

if (require.main === module) {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/generate-performance-vault.cjs NEW_DIRECTORY');
    generate(path.resolve(process.argv[2]));
}

module.exports = { sizes, makeSource, generate };
