// This order is important
import "./type";
import "./svg";
import "./dataview";
    // "node_modules/powerbi-visuals-utils-formattingutils/lib/index.d.ts"
/// <reference path="../node_modules/powerbi-visuals-utils-formattingutils/lib/index.d.ts"/>
import "script-loader!powerbi-visuals-utils-formattingutils";
export const formatting = powerbi.extensibility["utils"].formatting;