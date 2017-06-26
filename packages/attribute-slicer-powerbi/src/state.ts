/*
 * Copyright (c) Microsoft
 * All rights reserved.
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import {
    setting,
    numberSetting as number,
    HasSettings,
    getSetting,
    ColoredObjectsSettings,
    coloredObjectsSettings,
    colorSetting as color,
} from "@essex/pbi-base";
import { IAttributeSlicerState, ListItem } from "./interfaces";
import { createItem, dataSupportsColorizedInstances } from "./dataConversion";
import { DEFAULT_STATE } from "@essex/attribute-slicer";
import * as _ from "lodash";
import * as models from 'powerbi-models';

const ldget = require("lodash/get"); // tslint:disable-line

/**
 * The set of settings loaded from powerbi
 */
export default class AttributeSlicerVisualState extends HasSettings implements IAttributeSlicerState {

    /**
     * The currently selected search text
     */
    @setting({
        // persist: false, // Don't persist this setting, it is dynamic based on the dataview
        name: "selfFilter",
        hidden: true,
        config: {
            type: { filter: { selfFilter: true } },
        },
        parse(value, desc, dv) {
            const selfFilter: any = ldget(dv, "metadata.objects.general.selfFilter");
            if (selfFilter) {
                const right = ldget(selfFilter.where(), "[0].condition.right");
                return (right && right.value) || "";
            }
            return "";
        },
        compose: (val, c, d) => val ? buildContainsFilter(d, val) : val,
    })
    public searchText?: string;

    /**
     * Whether or not the slicer should show the values column
     */
    @setting({
        persist: false, // Don't persist this setting, it is dynamic based on the dataview
        parse: (v, d, dv) => ldget(dv, "categorical.values", []).length > 0,
        defaultValue: DEFAULT_STATE.showValues,
    })
    public showValues?: boolean;

    /**
     * Whether or not the search box should be shown
     */
    @setting({
        persist: false, // Don't persist this setting, it is dynamic based on the dataview
        parse(v, d, dv) {
            const isSelfFilterEnabled = ldget(dv, "metadata.objects.general.selfFilterEnabled", false);
            return doesDataSupportSearch(dv) && !isSelfFilterEnabled;
        },
    })
    public showSearch?: boolean;

    /**
     * If we are being rendered horizontally
     */
    @setting({
        category: "Display",
        displayName: "Horizontal",
        description: "Display the attributes horizontally, rather than vertically",
        defaultValue: DEFAULT_STATE.horizontal,
    })
    public horizontal?: boolean;

    /**
     * The percentage based width of the value column 0 = hidden, 100 = whole screen
     */
    @setting({
        category: "Display",
        displayName: "Value Width %",
        description: "The percentage of the width that the value column should take up.",
        defaultValue: DEFAULT_STATE.valueColumnWidth,
    })
    public valueColumnWidth?: number;

    /**
     * The list of selected items
     */
    @setting({
        name: "selection",
        displayName: "Selection",
        hidden: true,
        config: {
            type: { text: {} },
        },
        parse: (v, d, dv) => parseSelectionFromPBI(dv),
        compose: (value, d) => convertSelectionToPBI(value),
    })
    public selectedItems?: {
        id: any;
        match: any;
        value: any;
        renderedValue?: any;
        selector: any;
    }[];

    /**
     * The text size in pt
     */
    @setting({
        displayName: "Text Size",
        description: "The size of the text",
        defaultValue: DEFAULT_STATE.textSize,
        parse: val => val ? PixelConverter.fromPointToPixel(parseFloat(val)) : DEFAULT_STATE.textSize,
        compose: val => PixelConverter.toPoint(val ? val : DEFAULT_STATE.textSize),
    })
    public textSize?: number;

   /**
    * The font color used to display item text
    */
   @color({
        displayName: "Text Color",
        description: "Item text color.",
        defaultValue: DEFAULT_STATE.itemTextColor,
    })
    public itemTextColor?: string;

    /**
     * If we should left align the text
     */
     @setting({
        displayName: "Text Align Left",
        description: "On to left align item text.",
        defaultValue: DEFAULT_STATE.leftAlignText,
    })
    public leftAlignText?: boolean;

    /**
     * If we should show the options area
     */
    @setting({
        displayName: "Show options",
        description: "Should the search box and other options be shown.",
        defaultValue: DEFAULT_STATE.showOptions,
    })
    public showOptions?: boolean;

    /**
     * The display units to use when rendering values
     */
    @setting({
        category: "Display",
        displayName: "Units",
        description: "The units to use when displaying values.",
        defaultValue: 0,
        config: {
            type: {
                formatting: {
                    labelDisplayUnits: true,
                },
            },
        },
    })
    public labelDisplayUnits?: number;

    /**
     * The precision of the numbers to render
     */
    @number({
        category: "Display",
        displayName: "Precision",
        description: "The precision to use when displaying values.",
        defaultValue: 0,
    })
    public labelPrecision?: number;

    /**
     * If we should single select
     */
    @setting({
        category: "Selection",
        displayName: "Single Select",
        description: "Only allow for one item to be selected at a time",
        defaultValue: DEFAULT_STATE.singleSelect,
    })
    public singleSelect?: boolean;

    /**
     * If brushMode is enabled
     */
    @setting({
        category: "Selection",
        displayName: "Brush Mode",
        description: "Allow for the drag selecting of attributes",
        defaultValue: DEFAULT_STATE.brushMode,
    })
    public brushMode?: boolean;

    /**
     * If we should show the tokens
     */
    @setting({
        category: "Selection",
        displayName: "Use Tokens",
        description: "Will show the selected attributes as tokens",
        defaultValue: DEFAULT_STATE.showSelections,
    })
    public showSelections?: boolean;

    /**
     * If the value displays should be always shown
     */
    @setting({
        category: "Display",
        displayName: "Always On Values",
        description: "Display value labels.",
        defaultValue: DEFAULT_STATE.displayValueLabels,
    })
    public displayValueLabels?: boolean;

    /**
     * The set of settings for the colored objects
     */
    @coloredObjectsSettings({
        category: "Data Point",
        enumerable: (s, dv) => dataSupportsColorizedInstances(dv),
    })
    public colors: ColoredObjectsSettings;

    /**
     * The scroll position of the visual
     */
    public scrollPosition: [number, number] = [0, 0];

    /**
     * Receives the new properties
     * @param newProps The properties to merge into state
     */
    public receive(newProps?: any) {
        const base = super.receive(newProps);
        if (base) {
            if (base.colors && base.colors.instanceColors) {
                base.colors.instanceColors = base.colors.instanceColors.map((n: any) => ({
                    color: n.color,
                    name: n.name,
                    identity: JSON.parse(n.identity),
                }));
            }

            // HACK: Temporary fix until we switch to selection manager
            // Necessary, because in State -> JSON process, it changes objects with undefined properties to null properties
            // to preserve them in a JSON.stringify call.
            if (base.selectedItems) {
                base.selectedItems.forEach(nullToUndefined);
            }
        }
        return base;
    }

    /**
     * Creates a JSON object version of this state, suitable for storage
     */
    public toJSONObject() {
        const jsonObj = super.toJSONObject() as AttributeSlicerVisualState;
        if (this.colors && this.colors.instanceColors) {
            jsonObj.colors.instanceColors = this.colors.instanceColors.map(n => ({
                color: n.color,
                name: n.name,
                identity: <any>n.identity.getKey(),
            }));
        }
        return jsonObj;
    }
}

/**
 * Calculates whether or not the dataset supports search
 */
function doesDataSupportSearch(dv: powerbi.DataView) {
    "use strict";
    const source = ldget(dv, "categorical.categories[0].source");
    const metadataCols = ldget(dv, "metadata.columns");
    const metadataSource = metadataCols && metadataCols.filter((n: any) => n.roles["Category"])[0];
    if (source && metadataSource) {
        return source && metadataSource && metadataSource.type.text && source.type.text;
    }
    return false;
}

/**
 * Loads the selection from PowerBI
 */
function parseSelectionFromPBI(dataView: powerbi.DataView): ListItem[] {
    "use strict";
    const objects = ldget(dataView, "metadata.objects");
    if (objects) {
        // HACK: Extra special code to restore selection
        const serializedSelectedItems: ListItem[] = JSON.parse(ldget(objects, "general.selection"));
        if (serializedSelectedItems && serializedSelectedItems.length) {
            return serializedSelectedItems.map((n: ListItem, i: number) => {
                const { match, value, renderedValue, id } = serializedSelectedItems[i];
                const item = createItem(match, value, id, renderedValue);
                return item;
            });
        }
        return [];
    } else if (dataView) { // If we have a dataview, but we don't have any selection, then clear it
        return [];
    }
}

/**
 * Converts the given items into a format for PBI
 */
function convertSelectionToPBI(value: ListItem[]) {
    "use strict";
    if (value) {
        return JSON.stringify((value || []).map((n) => ({
            id: n.id,
            match: n.match,
            value: n.value,
            renderedValue: n.renderedValue,
        })));
    }
}

/**
 * Calculates the properties that have changed between the two states
 */
export function calcStateDifferences(newState: IAttributeSlicerState, oldState: IAttributeSlicerState) {
    "use strict";
    const differences: string[] = [];
    newState = newState || <any>{};
    oldState = oldState || <any>{};
    Object.keys(newState || {}).forEach(prop => {
        const oldValue = newState[prop];
        const newValue = oldState[prop];
        if (!_.isEqual(oldValue, newValue)) {
            const descriptor = getSetting(AttributeSlicerVisualState, prop);
            if (descriptor) {
                differences.push(descriptor.displayName || prop);
            }
        }
    });
    return differences;
}

/**
 * Changes all nulls to undefined in an object graph
 * * Temporary *
 * @param obj The object to change null to undefined
 */
function nullToUndefined(obj: object) {
    "use strict";
    if (obj) {
        Object.keys(obj).forEach(key => {
            const val = obj[key];
            // Array
            if (val && val.forEach) {
                val.forEach(nullToUndefined);
            // pojo
            } else if (val === null) { // tslint:disable-line
                obj[key] = undefined;
            } else if (typeof val === "object") {
                nullToUndefined(val);
            }
        });
    }
}

function buildContainsFilter(dataView: powerbi.DataView, value: string) {
    if (dataView) {
        let categories: powerbi.DataViewCategoricalColumn = this.dataView.categorical.categories[0];
        let target: models.IFilterColumnTarget = {
            table: categories.source.queryName.substr(0, categories.source.queryName.indexOf('.')),
            column: categories.source.displayName
        };
        return new models.AdvancedFilter(target, "And", {
            operator: "Contains",
            value
        });
    }
}