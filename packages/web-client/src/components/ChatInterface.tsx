import { useState, useRef, useEffect } from 'react';
import { Send, Users, Settings, MessageSquare, Zap, Code } from 'lucide-react';
import { Envelope, Participant, isChatMessage, ConnectionState } from '@/types/mcpx';
import { ParticipantsList } from './ParticipantsList';
import { MessagesList } from './MessagesList';
import { ConnectionStatus } from './ConnectionStatus';
import { MCPDevTools } from './MCPDevTools';

export interface ChatInterfaceProps {
  connectionState: ConnectionState;
  participants: Participant[];
  messages: Envelope[];
  onSendChatMessage: (text: string, format?: 'plain' | 'markdown') => void;
  onSendMCPRequest: (to: string, method: string, params?: Record<string, any>) => void;
  onDisconnect: () => void;
}

export function ChatInterface({
  connectionState,
  participants,
  messages,
  onSendChatMessage,
  onSendMCPRequest,
  onDisconnect
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const [messageFormat, setMessageFormat] = useState<'plain' | 'markdown'>('plain');
  const [showParticipants, setShowParticipants] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'chat' | 'all' | 'mcp' | 'dev'>('chat');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    onSendChatMessage(messageText.trim(), messageFormat);
    setMessageText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Derived message filters
  const chatMessages = messages.filter(isChatMessage);
  const mcpMessages = messages.filter(m => m.kind === 'mcp' && !isChatMessage(m));
  
  const filteredMessages = messages.filter(msg => {
    switch (selectedTab) {
      case 'chat':
        return isChatMessage(msg);
      case 'mcp':
        return msg.kind === 'mcp' && !isChatMessage(msg);
      case 'all':
      default:
        return true;
    }
  });

  const isConnected = connectionState.status === 'connected';

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Fixed Top Bar */}
      <div className="flex-none border-b bg-card shadow-sm">
        {/* Header Row */}
        <div className="px-4 py-3 flex items-center justify-between border-b">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">
                {connectionState.topic || 'MCPx Chat'}
              </h1>
              <ConnectionStatus connectionState={connectionState} />
            </div>
            
            {/* Channel Meta Info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{participants.length} participants</span>
              </div>
              {connectionState.participantId && (
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <span className="font-medium">You: {connectionState.participantId}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span>•</span>
                <span>{filteredMessages.length} messages</span>
              </div>
              {isConnected && (
                <div className="flex items-center gap-2">
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-600 dark:text-green-400">Live</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className={`p-2 rounded-md hover:bg-accent transition-colors ${
                showParticipants ? 'bg-accent text-accent-foreground' : ''
              }`}
              title="Toggle participants sidebar"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={onDisconnect}
              className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4">
          <div className="flex items-center justify-between">
            <div className="flex">
              {[
                { key: 'chat', label: 'Chat', icon: MessageSquare, count: chatMessages.length },
                { key: 'mcp', label: 'MCP', icon: Zap, count: mcpMessages.length },
                { key: 'dev', label: 'Dev Tools', icon: Code },
                { key: 'all', label: 'All', icon: Settings, count: messages.length }
              ].map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  onClick={() => setSelectedTab(key as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                    selectedTab === key
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent hover:text-accent-foreground hover:bg-accent/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      selectedTab === key 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Tab Actions */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {selectedTab === 'dev' && (
                <span className="flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  MCP Developer Tools
                </span>
              )}
              {selectedTab === 'mcp' && (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Protocol Messages
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="w-64 border-r bg-card flex-none">
            <div className="p-4 border-b">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-4 h-4" />
                Participants ({participants.length})
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ParticipantsList 
                participants={participants}
                currentParticipantId={connectionState.participantId}
                onParticipantAction={(participant, action) => {
                  if (action === 'tools/list') {
                    onSendMCPRequest(participant.id, 'tools/list');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            {selectedTab === 'dev' ? (
              <MCPDevTools 
                participants={participants}
                onSendMCPRequest={onSendMCPRequest}
              />
            ) : (
              <div className="p-4">
                <MessagesList 
                  messages={filteredMessages}
                  currentParticipantId={connectionState.participantId}
                />
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Message Input */}
          {selectedTab !== 'dev' && (
            <div className="flex-none border-t bg-card p-4">
              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isConnected ? "Type a message..." : "Connect to start chatting"}
                      disabled={!isConnected}
                      className="w-full px-3 py-2 bg-background text-foreground border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 placeholder:text-muted-foreground"
                      rows={1}
                      style={{ 
                        minHeight: '2.5rem',
                        maxHeight: '8rem',
                        height: Math.min(8, Math.max(1, messageText.split('\n').length)) + 'rem'
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!messageText.trim() || !isConnected}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2 text-foreground">
                    <input
                      type="radio"
                      name="format"
                      value="plain"
                      checked={messageFormat === 'plain'}
                      onChange={(e) => setMessageFormat(e.target.value as 'plain')}
                      className="text-primary focus:ring-primary"
                    />
                    Plain text
                  </label>
                  <label className="flex items-center gap-2 text-foreground">
                    <input
                      type="radio"
                      name="format"
                      value="markdown"
                      checked={messageFormat === 'markdown'}
                      onChange={(e) => setMessageFormat(e.target.value as 'markdown')}
                      className="text-primary focus:ring-primary"
                    />
                    Markdown
                  </label>
                  
                  {isConnected && (
                    <div className="ml-auto text-muted-foreground">
                      Press Enter to send, Shift+Enter for new line
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}