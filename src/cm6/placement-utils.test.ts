import { EditorState } from "@codemirror/state";
import { findInfluxWidgetPosition } from "./placement-utils";

function stateFromDoc(doc: string): EditorState {
	return EditorState.create({ doc });
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
});
