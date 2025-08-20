import { useState } from 'react';
import { Play, Code, FileText, List, Zap } from 'lucide-react';
import { Participant } from '@/types/mcpx';

export interface MCPDevToolsProps {
  participants: Participant[];
  onSendMCPRequest: (to: string, method: string, params?: Record<string, any>) => void;
}

interface QuickTool {
  name: string;
  method: string;
  params?: Record<string, any>;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const quickTools: QuickTool[] = [
  {
    name: 'List Tools',
    method: 'tools/list',
    description: 'Get available tools from MCP server',
    icon: List
  },
  {
    name: 'Read File',
    method: 'tools/call',
    params: { name: 'read_file', arguments: { path: 'hi.txt' } },
    description: 'Read hi.txt file',
    icon: FileText
  },
  {
    name: 'List Directory',
    method: 'tools/call',
    params: { name: 'list_directory', arguments: { path: '.' } },
    description: 'List current directory',
    icon: FileText
  }
];

export function MCPDevTools({ participants, onSendMCPRequest }: MCPDevToolsProps) {
  const [selectedParticipant, setSelectedParticipant] = useState('mcp-bridge');
  const [customMethod, setCustomMethod] = useState('tools/list');
  const [customParams, setCustomParams] = useState('{}');
  const [paramsError, setParamsError] = useState('');

  // Show all participants - let user choose any target
  const mcpParticipants = participants;

  const handleQuickTool = (tool: QuickTool) => {
    if (!selectedParticipant) return;
    onSendMCPRequest(selectedParticipant, tool.method, tool.params);
  };

  const handleCustomRequest = () => {
    if (!selectedParticipant || !customMethod) return;

    let params: Record<string, any> | undefined;
    
    try {
      params = customParams.trim() ? JSON.parse(customParams) : undefined;
      setParamsError('');
    } catch (error) {
      setParamsError('Invalid JSON format');
      return;
    }

    onSendMCPRequest(selectedParticipant, customMethod, params);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">MCP Developer Tools</h3>
            <p className="text-sm text-muted-foreground">
              Send Model Context Protocol requests to connected participants
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Participant Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Target Participant</label>
        <select
          value={selectedParticipant}
          onChange={(e) => setSelectedParticipant(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select participant...</option>
          {mcpParticipants.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.id}) - {p.kind}
            </option>
          ))}
          {mcpParticipants.length === 0 && (
            <option value="mcp-bridge-2">mcp-bridge-2 (manual entry)</option>
          )}
        </select>
      </div>

      {/* Quick Tools */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Quick Tools
        </h4>
        <div className="grid gap-3">
          {quickTools.map((tool, index) => (
            <button
              key={index}
              onClick={() => handleQuickTool(tool)}
              disabled={!selectedParticipant}
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed text-left transition-all group"
            >
              <div className="p-2 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                <tool.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{tool.name}</div>
                <div className="text-sm text-muted-foreground">{tool.description}</div>
                <div className="text-xs font-mono text-muted-foreground mt-1 bg-muted/50 px-2 py-1 rounded">
                  {tool.method}{tool.params ? ` ${JSON.stringify(tool.params)}` : ''}
                </div>
              </div>
              <Play className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Custom Request */}
      <div className="border-t pt-6">
        <h4 className="font-medium mb-3">Custom Request</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Method</label>
            <input
              type="text"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
              placeholder="e.g., tools/call"
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Parameters (JSON)</label>
            <textarea
              value={customParams}
              onChange={(e) => setCustomParams(e.target.value)}
              placeholder='{"name": "read_file", "arguments": {"path": "example.txt"}}'
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary h-24 font-mono text-sm"
            />
            {paramsError && (
              <p className="text-sm text-destructive mt-1">{paramsError}</p>
            )}
          </div>
          
          <button
            onClick={handleCustomRequest}
            disabled={!selectedParticipant || !customMethod}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Send Request
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-2">Common Methods</h4>
        <div className="text-sm text-muted-foreground space-y-1">
          <div><code>tools/list</code> - List available tools</div>
          <div><code>tools/call</code> - Call a specific tool</div>
          <div><code>resources/list</code> - List available resources</div>
          <div><code>prompts/list</code> - List available prompts</div>
        </div>
      </div>
      </div>
    </div>
  );
}