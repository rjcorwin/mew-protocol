"use strict";
/**
 * @meup/types
 *
 * Shared TypeScript type definitions for MEUP protocol
 *
 * @packageDocumentation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPMethods = exports.MessageKinds = exports.MCP_VERSION = exports.PROTOCOL_VERSION = void 0;
// Export all protocol types
__exportStar(require("./protocol"), exports);
// Export all MCP types
__exportStar(require("./mcp"), exports);
// Export constants
var protocol_1 = require("./protocol");
Object.defineProperty(exports, "PROTOCOL_VERSION", { enumerable: true, get: function () { return protocol_1.PROTOCOL_VERSION; } });
Object.defineProperty(exports, "MCP_VERSION", { enumerable: true, get: function () { return protocol_1.MCP_VERSION; } });
Object.defineProperty(exports, "MessageKinds", { enumerable: true, get: function () { return protocol_1.MessageKinds; } });
var mcp_1 = require("./mcp");
Object.defineProperty(exports, "MCPMethods", { enumerable: true, get: function () { return mcp_1.MCPMethods; } });
//# sourceMappingURL=index.js.map