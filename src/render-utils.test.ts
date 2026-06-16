import { shouldRenderInfluxForMarkdownElement } from './render-utils';

function elementWithClosest(match: Element | null): HTMLElement {
	return {
		closest: jest.fn().mockReturnValue(match),
	} as unknown as HTMLElement;
}

describe('Render Utils', () => {
	describe('shouldRenderInfluxForMarkdownElement', () => {
		test('allows normal markdown preview elements', () => {
			const element = elementWithClosest(null);

			expect(shouldRenderInfluxForMarkdownElement(element)).toBe(true);
			expect(element.closest).toHaveBeenCalledWith('td, th, table');
		});

		test('rejects elements inside table cells or tables', () => {
			const tableContext = {} as Element;
			const element = elementWithClosest(tableContext);

			expect(shouldRenderInfluxForMarkdownElement(element)).toBe(false);
			expect(element.closest).toHaveBeenCalledWith('td, th, table');
		});
	});
});
