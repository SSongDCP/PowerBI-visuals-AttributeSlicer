// Wen't this route vs doing exports-loader in webpack config, to preserve typings
///// <reference path="../node_modules/powerbi-visuals-utils-typeutils/lib/index.d.ts"/>
import "script-loader!powerbi-visuals-utils-typeutils";
export const type = powerbi.extensibility["utils"].type;