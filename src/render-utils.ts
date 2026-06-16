const TABLE_RENDER_CONTEXT_SELECTOR = [
	"td",
	"th",
	"table",
	".HyperMD-table-row",
	".cm-table-widget",
	".cm-table-editor",
	".table-cell-wrapper",
].join(", ");

const PREVIEW_CONTAINER_SELECTOR = ".markdown-preview-view, .markdown-reading-view";

export function shouldRenderInfluxForMarkdownElement(element: HTMLElement): boolean {
	if (element.closest(TABLE_RENDER_CONTEXT_SELECTOR)) {
		return false;
	}

	if (element.parentElement?.closest(PREVIEW_CONTAINER_SELECTOR)) {
		return false;
	}

	return true;
}
