import { EditorView, ViewUpdate, ViewPlugin } from "@codemirror/view";
import { StatefulDecorationSet } from "./StatefulDecorationSet";
import { statefulDecorations } from "./helpers";
import { debounce } from "obsidian";

const activeEditorPlugins = new Set<InfluxEditorViewPlugin>();

class InfluxEditorViewPlugin {
    statefulDecorationsSet: StatefulDecorationSet;
    private view: EditorView;

    constructor(view: EditorView) {
        this.view = view;
        this.statefulDecorationsSet = new StatefulDecorationSet(view);
        activeEditorPlugins.add(this);
        this.statefulDecorationsSet.updateAsyncDecorations(view.state, true);
    }

    showInflux(view: EditorView) {
        this.statefulDecorationsSet.updateAsyncDecorations(view.state, true);
    }

    update(update: ViewUpdate) {
        /** Only changes within the same host document flow to this diffing point.
         * Changes to title of document is not caught.
         * Changes to other documents that are referenced in the influx of host file are not caught.
         */
        if (update.docChanged) {
            this.debouncedShow(update.view)
        }
    }

    debouncedShow = debounce((view: EditorView) => {
        this.showInflux(view);
    }, 3000, true)

    refreshForBacklinkChange() {
        if (this.statefulDecorationsSet.backlinkSourcesChanged()) {
            this.debouncedShow?.cancel?.();
            this.showInflux(this.view);
        }
    }

    refresh() {
        this.debouncedShow?.cancel?.();
        this.showInflux(this.view);
    }

    destroy() {
        activeEditorPlugins.delete(this);
        this.debouncedShow?.cancel?.();
        this.statefulDecorationsSet.destroy();
    }
}

const asyncViewPlugin = ViewPlugin.fromClass(InfluxEditorViewPlugin);

/**
 * Refresh open editors when backlink metadata changes. Source signatures make
 * this a cheap no-op unless an incoming source was added or removed.
 */
export function refreshInfluxEditorDecorations(backlinksOnly = false): void {
    for (const editorPlugin of activeEditorPlugins) {
        if (backlinksOnly) {
            editorPlugin.refreshForBacklinkChange();
        } else {
            editorPlugin.refresh();
        }
    }
}

export const asyncDecoBuilderExt = [statefulDecorations.field, asyncViewPlugin]

