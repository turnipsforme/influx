import { editorViewField } from "obsidian";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { EditorState, Range } from "@codemirror/state";
import InfluxFile from '../InfluxFile';
import { influxDecoration } from "./InfluxWidget";
import { statefulDecorations } from "./helpers";
import { getBacklinkSourceSignature } from "../backlink-utils";
import { getInfluxDecorationPlacement } from "./decoration-placement";
import { containsMarkdownTable, findInfluxWidgetPosition, isSelectionInMarkdownTable } from "./placement-utils";


export class StatefulDecorationSet {
    editor: EditorView;
    decoCache: { [cls: string]: Decoration } = Object.create(null);
    private requestGeneration = 0;
    private backlinkSourceSignature = '';

    constructor(editor: EditorView) {
        this.editor = editor;
    }

    async computeAsyncDecorations(state: EditorState, show: boolean): Promise<DecorationSet | null> {
        const editorField = state.field(editorViewField, false)
        if (!editorField) return null; // If not yet loaded.

        if (containsMarkdownTable(state) || isSelectionInMarkdownTable(state)) {
            return Decoration.none;
        }


        const { file } = editorField;
        if (!file) return null; // If no file is loaded

        // Access plugin through global window reference since app.plugins doesn't work in CodeMirror context
        const plugin = (window as any).influxPlugin

        if (!plugin) {
            return null;
        }

        // Reuse plugin's api instance instead of creating new one (preserves cache)
        const apiAdapter = plugin.api

        const influxFile = await InfluxFile.create(file.path, apiAdapter, plugin)

        // Do not install even an empty block widget. It still participates in
        // CodeMirror layout and can interfere with typing at the document edge.
        if (!show || !influxFile.show || !influxFile.hasBacklinks()) {
            return Decoration.none
        }

        const hasVisibleEntries = await influxFile.prepare()
        if (!hasVisibleEntries) {
            return Decoration.none
        }

        const decorations: Range<Decoration>[] = []
        const placement = getInfluxDecorationPlacement(
            state,
            influxFile.influx.data.settings.influxAtTopOfPage,
        )
        // rudironsoni's fix: skip over a leading table/heading-table when anchoring
        // at the top of the page so backlinks never land inside a table cell.
        const position = influxFile.influx.data.settings.influxAtTopOfPage && hasVisibleEntries
            ? Math.max(placement.position, findInfluxWidgetPosition(state))
            : placement.position
        decorations.push(influxDecoration({
            influxFile,
            show: show && influxFile.show,
            side: placement.side,
        }).range(position))

        return Decoration.set(decorations, true);

    }

    /** Check whether incoming sources changed without doing excerpt/render work. */
    async backlinkSourcesChanged(): Promise<boolean> {
        const editorField = this.editor.state.field(editorViewField, false)
        const plugin = (window as any).influxPlugin
        if (!editorField?.file || !plugin) {
            return false
        }

        const backlinks = await plugin.api.getBacklinks(editorField.file)
        return getBacklinkSourceSignature(backlinks) !== this.backlinkSourceSignature
    }

    async updateAsyncDecorations(state: EditorState, show: boolean): Promise<void> {
        const requestGeneration = ++this.requestGeneration
        const sourceDocument = state.doc
        const sourceFilePath = state.field(editorViewField, false)?.file?.path
        const decorations = await this.computeAsyncDecorations(state, show);

        // Check if editor is still valid before proceeding
        if (!this.editor || !this.editor.state) {
            return;
        }

        const currentFilePath = this.editor.state.field(editorViewField, false)?.file?.path
        if (
            requestGeneration !== this.requestGeneration ||
            sourceDocument !== this.editor.state.doc ||
            sourceFilePath !== currentFilePath
        ) {
            return;
        }

        const plugin = (window as any).influxPlugin
        const currentFile = this.editor.state.field(editorViewField, false)?.file
        if (plugin && currentFile) {
            const currentBacklinks = await plugin.api.getBacklinks(currentFile)
            const latestFilePath = this.editor.state.field(editorViewField, false)?.file?.path
            if (
                requestGeneration !== this.requestGeneration ||
                sourceDocument !== this.editor.state.doc ||
                sourceFilePath !== latestFilePath
            ) {
                return;
            }
            this.backlinkSourceSignature = getBacklinkSourceSignature(currentBacklinks)
        }

        // Safely check if we need to update decorations
        let hasExistingDecorations = false;
        try {
            hasExistingDecorations = this.editor.state.field(statefulDecorations.field).size > 0;
        } catch {
            // Field is not present in state (view being destroyed, plugin unloaded, etc.)
            // If we have new decorations, try to apply them. Otherwise, silently exit.
            if (decorations) {
                try {
                    this.editor.dispatch({ effects: statefulDecorations.update.of(decorations) });
                } catch {
                    // Dispatch failed - editor is being destroyed, ignore
                }
            }
            return;
        }

        // Update decorations if we have new ones or need to clear existing ones
        if (decorations || hasExistingDecorations) {
            try {
                this.editor.dispatch({ effects: statefulDecorations.update.of(decorations || Decoration.none) });
            } catch {
                // Dispatch failed - editor is being destroyed, ignore
            }
        }
    }

    destroy(): void {
        // Supersede any asynchronous calculation that is still in flight.
        this.requestGeneration++
    }
}
