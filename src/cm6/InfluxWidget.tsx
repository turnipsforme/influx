import { WidgetType, EditorView } from "@codemirror/view";
import InfluxFile from '../InfluxFile';
import InfluxReactComponent from '../InfluxReactComponent';
import * as React from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import {
    createInfluxBlockDecoration,
    INFLUX_WIDGET_SIDE,
} from "./decoration-placement";

// Global WeakMap to track React roots for proper cleanup and reuse
const reactRoots = new WeakMap<HTMLElement, Root>();

// Use a unique custom element name to avoid conflicts with other plugins
const INFLUX_ELEMENT_TAG = "obsidian-influx-element";
const INFLUX_EDITOR_CLASS = "influx-editor-has-widget";

try {
    customElements.define(INFLUX_ELEMENT_TAG, class extends HTMLElement {
        disconnectedCallback() {
            this.dispatchEvent(new CustomEvent("disconnected"))
        }
    })
}
catch (e) {
    // Element already defined, which is fine
}



interface InfluxWidgetSpec {
    influxFile: InfluxFile;
    show: boolean;
    side?: number;
}


export class InfluxWidget extends WidgetType {
    protected influxFile
    protected show

    constructor({ influxFile, show }: InfluxWidgetSpec) {
        super()
        this.influxFile = influxFile
        this.show = show

    }

    eq(influxWidget: WidgetType) {
        // Proper comparison to avoid unnecessary re-renders
        // Only recreate if show status or file path changes
        if (!(influxWidget instanceof InfluxWidget)) {
            return false;
        }
        return this.show === influxWidget.show &&
               this.influxFile?.file?.path === influxWidget.influxFile?.file?.path;
    }

    toDOM(view: EditorView) {
        const container = document.createElement(INFLUX_ELEMENT_TAG)
        view.dom.classList.add(INFLUX_EDITOR_CLASS)
        container.style.display = 'block'
        container.style.width = '100%'
        container.id = `influx-react-anchor-${this.influxFile.uuid}`;

        // Get or create React root using WeakMap for proper cleanup
        // Use container directly as the React root anchor to ensure WeakMap key matches disconnect listener target
        let root = reactRoots.get(container);
        if (!root) {
            root = createRoot(container);
            reactRoots.set(container, root);
        }

        if (this.show) {
            root.render(<InfluxReactComponent
                key={this.influxFile.file?.path || 'influx'}
                influxFile={this.influxFile}
                preview={false}
                sheet={this.influxFile.influx.stylesheet}
            />);
        }
        else {
            root.render(null)
        }

        // Cleanup when element is disconnected from DOM
        const disconnectedHandler = () => {
            // Remove event listener to prevent memory leaks
            container.removeEventListener("disconnected", disconnectedHandler);

            // Unmount React root to prevent memory leaks
            const rootToCleanup = reactRoots.get(container);
            if (rootToCleanup) {
                rootToCleanup.unmount();
                reactRoots.delete(container);
            }
            // Deregister the influx component
            this.unmount(this.influxFile);

            if (!view.dom.querySelector(INFLUX_ELEMENT_TAG)) {
                view.dom.classList.remove(INFLUX_EDITOR_CLASS)
            }
        };

        container.addEventListener("disconnected", disconnectedHandler)

        return container
    }


    unmount(influxFile: InfluxFile) {
        this.influxFile.influx.deregisterInfluxComponent(influxFile.uuid)
    }
}


export const influxDecoration = (influxWidgetSpec: InfluxWidgetSpec) =>  {
    // Positive affinity keeps end-of-note typing before the footer widget.
    const side = influxWidgetSpec.side ?? INFLUX_WIDGET_SIDE;
    return createInfluxBlockDecoration(new InfluxWidget(influxWidgetSpec), side)
}
