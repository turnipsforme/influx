import { EditorState } from "@codemirror/state";

function isFrontmatterFence(text: string): boolean {
	return text.trim() === "---";
}

function isMarkdownTableRow(text: string): boolean {
	const trimmed = text.trim();
	return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

export function findInfluxWidgetPosition(state: EditorState): number {
	const { doc } = state;
	let lineNumber = 1;

	if (doc.lines > 0 && isFrontmatterFence(doc.line(1).text)) {
		lineNumber = 2;
		while (lineNumber <= doc.lines) {
			if (isFrontmatterFence(doc.line(lineNumber).text)) {
				lineNumber++;
				break;
			}
			lineNumber++;
		}
	}

	let firstContentLine = lineNumber;
	while (firstContentLine <= doc.lines && doc.line(firstContentLine).text.trim() === "") {
		firstContentLine++;
	}

	if (firstContentLine <= doc.lines && isMarkdownTableRow(doc.line(firstContentLine).text)) {
		lineNumber = firstContentLine;
		while (lineNumber <= doc.lines && isMarkdownTableRow(doc.line(lineNumber).text)) {
			lineNumber++;
		}
		while (lineNumber <= doc.lines && doc.line(lineNumber).text.trim() === "") {
			lineNumber++;
		}
		return lineNumber <= doc.lines ? doc.line(lineNumber).from : doc.length;
	}

	return lineNumber <= doc.lines ? doc.line(lineNumber).from : doc.length;
}
