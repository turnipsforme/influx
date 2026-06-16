export function shouldRenderInfluxForMarkdownElement(element: HTMLElement): boolean {
	return element.closest("td, th, table") === null;
}
