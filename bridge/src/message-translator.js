const debug = require('debug')('meup:bridge:translator');

/**
 * MessageTranslator - handles translation between MCP and MEUP protocols
 */
class MessageTranslator {
  constructor() {
    this.requestCounter = 0;
  }

  /**
   * Translate MCP server capabilities to MEUP capabilities
   */
  mcpToMeupCapabilities(mcpCapabilities = {}) {
    const meupCapabilities = [];

    // If server has tools, it can respond to tool requests
    if (mcpCapabilities.tools) {
      meupCapabilities.push({
        kind: 'mcp/response'
      });
    }

    // If server has resources, it can respond to resource requests
    if (mcpCapabilities.resources) {
      meupCapabilities.push({
        kind: 'mcp/response'
      });
    }

    // If server has prompts, it can respond to prompt requests
    if (mcpCapabilities.prompts) {
      meupCapabilities.push({
        kind: 'mcp/response'
      });
    }

    // If server supports logging
    if (mcpCapabilities.logging) {
      meupCapabilities.push({
        kind: 'system/log'
      });
    }

    // Always include system capabilities
    meupCapabilities.push({
      kind: 'system/*'
    });

    debug('Translated capabilities:', mcpCapabilities, '->', meupCapabilities);
    return meupCapabilities;
  }

  /**
   * Translate MEUP request message to MCP JSON-RPC request
   */
  meupToMcpRequest(meupMessage) {
    const { method, params } = meupMessage.payload;
    
    const mcpRequest = {
      jsonrpc: '2.0',
      id: `bridge-req-${++this.requestCounter}`,
      method: method,
      params: params || {}
    };

    debug('MEUP -> MCP request:', meupMessage.payload, '->', mcpRequest);
    return mcpRequest;
  }

  /**
   * Translate MCP JSON-RPC response to MEUP response message
   */
  mcpToMeupResponse(mcpResponse, originalRequest) {
    const meupResponse = {
      protocol: 'meup/v0.2',
      kind: 'mcp/response',
      id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: originalRequest.to[0], // Bridge participant ID
      to: [originalRequest.from],
      correlation_id: [originalRequest.id],
      payload: {
        jsonrpc: '2.0'
      },
      ts: new Date().toISOString()
    };

    if (mcpResponse.error) {
      meupResponse.payload.error = mcpResponse.error;
    } else {
      meupResponse.payload.result = mcpResponse.result;
    }

    debug('MCP -> MEUP response:', mcpResponse, '->', meupResponse);
    return meupResponse;
  }

  /**
   * Translate MCP notification to MEUP message
   */
  mcpNotificationToMeup(notification, participantId) {
    // Map MCP notifications to appropriate MEUP message kinds
    let kind = 'system/notification';
    let payload = notification.params;

    // Special handling for specific notification types
    if (notification.method === 'notifications/message') {
      kind = 'system/log';
      payload = {
        level: notification.params.level || 'info',
        message: notification.params.data || notification.params.message,
        data: notification.params.data
      };
    } else if (notification.method === 'notifications/progress') {
      kind = 'system/progress';
      payload = {
        progress: notification.params.progress,
        total: notification.params.total,
        message: notification.params.progressToken
      };
    } else if (notification.method.startsWith('notifications/')) {
      // Generic notification handling
      kind = 'system/notification';
      payload = {
        type: notification.method.replace('notifications/', ''),
        data: notification.params
      };
    }

    const meupMessage = {
      protocol: 'meup/v0.2',
      kind: kind,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: participantId,
      payload: payload,
      ts: new Date().toISOString()
    };

    debug('MCP notification -> MEUP:', notification, '->', meupMessage);
    return meupMessage;
  }

  /**
   * Check if a MEUP message is an MCP-related request
   */
  isMcpRequest(meupMessage) {
    return meupMessage.kind === 'mcp/request' && 
           meupMessage.payload && 
           meupMessage.payload.method;
  }

  /**
   * Extract MCP method from MEUP message
   */
  extractMcpMethod(meupMessage) {
    if (!this.isMcpRequest(meupMessage)) {
      return null;
    }
    return meupMessage.payload.method;
  }

  /**
   * Map MEUP method patterns to MCP methods
   * Handles wildcard patterns like "tools/*"
   */
  matchMethodPattern(method, pattern) {
    if (pattern === method) {
      return true;
    }
    
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return method.startsWith(prefix + '/');
    }
    
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return method.startsWith(prefix);
    }
    
    return false;
  }

  /**
   * Validate if a method is allowed based on capabilities
   */
  isMethodAllowed(method, capabilities) {
    for (const cap of capabilities) {
      if (cap.kind === 'mcp/request' && cap.payload && cap.payload.method) {
        if (this.matchMethodPattern(method, cap.payload.method)) {
          return true;
        }
      }
    }
    return false;
  }
}

module.exports = { MessageTranslator };