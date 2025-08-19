import { useState } from 'react';
import { ConnectionForm, ConnectionFormData } from '@/components/ConnectionForm';
import { ChatInterface } from '@/components/ChatInterface';
import { useMCPx } from '@/hooks/useMCPx';

interface AppState {
  isConnected: boolean;
  connectionData: (ConnectionFormData & { authToken: string }) | null;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    isConnected: false,
    connectionData: null
  });

  const mcpx = useMCPx({
    serverUrl: appState.connectionData?.serverUrl || '',
    participantId: appState.connectionData?.participantId || '',
    topic: appState.connectionData?.topic || '',
    authToken: appState.connectionData?.authToken,
    autoConnect: false
  });

  const handleConnect = async (connectionData: ConnectionFormData & { authToken: string }) => {
    try {
      setAppState({
        isConnected: false,
        connectionData
      });

      // Update the hook with new connection data
      await mcpx.connect();
      
      setAppState({
        isConnected: true,
        connectionData
      });
    } catch (error) {
      console.error('Connection failed:', error);
      setAppState({
        isConnected: false,
        connectionData: null
      });
    }
  };

  const handleDisconnect = () => {
    mcpx.disconnect();
    setAppState({
      isConnected: false,
      connectionData: null
    });
  };

  if (!appState.isConnected || !appState.connectionData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ConnectionForm 
          onConnect={handleConnect}
          loading={mcpx.connectionState.status === 'connecting'}
          error={mcpx.connectionState.error}
        />
      </div>
    );
  }

  return (
    <ChatInterface
      connectionState={mcpx.connectionState}
      participants={mcpx.participants}
      messages={mcpx.messages}
      onSendChatMessage={mcpx.sendChatMessage}
      onSendMCPRequest={mcpx.sendMCPRequest}
      onDisconnect={handleDisconnect}
    />
  );
}

export default App;