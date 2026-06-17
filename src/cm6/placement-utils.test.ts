import { EditorState } from "@codemirror/state";
import { containsMarkdownTable, findInfluxWidgetPosition, isSelectionInMarkdownTable } from "./placement-utils";

function stateFromDoc(doc: string): EditorState {
	return EditorState.create({ doc });
}

function stateWithSelection(doc: string, selectionAnchor: string): EditorState {
	return EditorState.create({
		doc,
		selection: { anchor: doc.indexOf(selectionAnchor) },
	});
}

describe("CM6 placement utils", () => {
	test("places the widget after frontmatter for normal note content", () => {
		const doc = [
			"---",
			"title: Example",
			"---",
			"# Heading",
			"Body",
		].join("\n");

		expect(findInfluxWidgetPosition(stateFromDoc(doc))).toBe(doc.indexOf("# Heading"));
	});

	test("places the widget after a leading markdown table", () => {
		const doc = [
			"---",
			"title: Example",
			"---",
			"| Status | Under review |",
			"| --- | --- |",
			"| Jira Task | [[B2BP-89]] |",
			"| Updated | Jun 16, 2026 |",
			"",
			"## Background",
			"Body",
		].join("\n");

		expect(findInfluxWidgetPosition(stateFromDoc(doc))).toBe(doc.indexOf("## Background"));
	});

	test("places the widget after a leading markdown table without outer pipes", () => {
		const doc = [
			"---",
			"title: Example",
			"---",
			"Status | Under review",
			"--- | ---",
			"Jira Task | [[B2BP-89]]",
			"Author(s) | Rudimar Luis Ronsoni Junior",
			"Reviewer(s) | Rafael García Cuellar",
			"Updated | Jun 16, 2026",
			"Repositories | https://github.com/Feverup/partners",
			"",
			"## Background",
			"Body",
		].join("\n");

		expect(findInfluxWidgetPosition(stateFromDoc(doc))).toBe(doc.indexOf("## Background"));
	});

	test("places the widget after a table that follows the note title", () => {
		const doc = [
			"---",
			"title: B2BP-89 - Bump SQLAlchemy v2.0",
			"---",
			"# B2BP-89 - Bump SQLAlchemy v2.0",
			"",
			"Status | Under review",
			"--- | ---",
			"Jira Task | [[B2BP-89]]",
			"Author(s) | Rudimar Luis Ronsoni Junior",
			"Reviewer(s) | Rafael García Cuellar",
			"Updated | Jun 16, 2026",
			"Repositories | https://github.com/Feverup/partners",
			"",
			"## Background",
			"Body",
		].join("\n");

		expect(findInfluxWidgetPosition(stateFromDoc(doc))).toBe(doc.indexOf("## Background"));
	});

	test("places the widget at the end when the note only contains frontmatter and a table", () => {
		const doc = [
			"---",
			"title: Example",
			"---",
			"| Status | Under review |",
			"| --- | --- |",
			"| Jira Task | [[B2BP-89]] |",
		].join("\n");

		expect(findInfluxWidgetPosition(stateFromDoc(doc))).toBe(doc.length);
	});

	test("detects a selection inside a markdown table row", () => {
		const doc = [
			"# B2BP-89 - Bump SQLAlchemy v2.0",
			"",
			"Status | Under review",
			"--- | ---",
			"Reviewer(s) | Rafael García Cuellar",
			"Updated | Jun 16, 2026",
		].join("\n");

		expect(isSelectionInMarkdownTable(stateWithSelection(doc, "Reviewer"))).toBe(true);
	});

	test("detects a selection on a blank line between markdown table rows", () => {
		const doc = [
			"# B2BP-89 - Bump SQLAlchemy v2.0",
			"",
			"Status | Under review",
			"--- | ---",
			"",
			"Updated | Jun 16, 2026",
		].join("\n");

		expect(isSelectionInMarkdownTable(stateWithSelection(doc, "\n\nUpdated"))).toBe(true);
	});

	test("detects a markdown table anywhere in the editor document", () => {
		const doc = [
			"# B2BP-89 - Bump SQLAlchemy v2.0",
			"",
			"Status | Under review",
			"--- | ---",
			"Updated | Jun 16, 2026",
			"",
			"## Background",
		].join("\n");

		expect(containsMarkdownTable(stateFromDoc(doc))).toBe(true);
	});

	test("does not detect normal prose as a markdown table", () => {
		const doc = [
			"# Background",
			"",
			"This line has no table.",
			"This line mentions partners and SQLAlchemy.",
		].join("\n");

		expect(containsMarkdownTable(stateFromDoc(doc))).toBe(false);
	});
});
