/**
 * MCP Client wrapper for MEW Agent
 * Handles MCP tool requests through the MEW protocol
 */

class MCPClient {
  constructor(mewClient, participantId = 'mcp-fs-bridge') {
    this.mewClient = mewClient;
    this.mcpParticipantId = participantId;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }
  
  /**
   * Send a tool request to the MCP bridge
   */
  async sendToolRequest(toolName, params = {}) {
    const requestId = `req-${++this.requestId}`;
    
    // Map common tool names to MCP tool names
    const mcpToolMap = {
      'list_directory': 'list_directory',
      'read_file': 'read_file',
      'write_file': 'write_file',
      'create_directory': 'create_directory',
      'delete_file': 'delete_file',
      'search_files': 'search_files'
    };
    
    const mcpTool = mcpToolMap[toolName] || toolName;
    
    // Create promise for this request
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`MCP request timeout for ${toolName}`));
        }
      }, 30000);
    });
    
    // Send MCP request using tools/call method
    this.mewClient.send({
      kind: 'mcp/request',
      to: this.mcpParticipantId,
      payload: {
        id: requestId,
        method: 'tools/call',
        params: {
          name: mcpTool,
          arguments: params
        }
      }
    });
    
    return promise;
  }
  
  /**
   * Handle MCP response
   */
  handleResponse(envelope) {
    console.log('MCPClient: Received response:', JSON.stringify(envelope.payload));
    
    // Try different field names for request ID
    const requestId = envelope.payload.request_id || 
                      envelope.payload.requestId || 
                      envelope.payload.id;
    const result = envelope.payload.result;
    const error = envelope.payload.error;
    
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      if (error) {
        reject(new Error(error.message || JSON.stringify(error) || 'MCP request failed'));
      } else {
        resolve(result);
      }
    } else {
      console.log('MCPClient: No pending request for ID:', requestId);
      console.log('MCPClient: Pending requests:', Array.from(this.pendingRequests.keys()));
    }
  }
}

module.exports = { MCPClient };