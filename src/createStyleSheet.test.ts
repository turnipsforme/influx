import { createStyleSheet } from './createStyleSheet';

function ruleFor(css: string, selector: string): string {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return css.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))?.[0] ?? '';
}

describe('createStyleSheet', () => {
    test.each(['CENTER_ALIGNED', 'ROWS'] as const)(
        'keeps backlink wrappers content-sized in the %s variant',
        (variant) => {
            const sheet = createStyleSheet({
                getSettings: () => ({
                    fontSize: 13,
                    variant,
                }),
            } as any);

            try {
                const css = sheet.toString();
                const root = `.${sheet.classes.influxComponent}`;
                const entries = ruleFor(css, `.${sheet.classes.inlinkedEntries}`);

                expect(ruleFor(css, `${root} .backlink-pane`)).toContain('flex: 0 0 auto;');
                expect(ruleFor(css, `${root} .search-result-container`)).toContain('flex: 0 0 auto;');
                expect(entries).toContain('display: flex;');
                expect(entries).not.toContain('flex-grow');
            } finally {
                sheet.detach();
            }
        },
    );
});
