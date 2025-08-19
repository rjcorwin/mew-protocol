import { useState, useEffect } from 'react';
import { ConnectionForm, ConnectionFormData } from '@/components/ConnectionForm';
import { ChatInterface } from '@/components/ChatInterface';
import { useMCPx } from '@/hooks/useMCPx';

function App() {
  const [connectionData, setConnectionData] = useState<(ConnectionFormData & { authToken: string }) | null>(null);
  const [shouldConnect, setShouldConnect] = useState(false);

  // Only use the hook with real connection data
  const mcpx = useMCPx({
    serverUrl: connectionData?.serverUrl || 'http://localhost:3000',
    participantId: connectionData?.participantId || '',
    topic: connectionData?.topic || '',
    authToken: connectionData?.authToken,
    autoConnect: false
  });

  // Handle connection after data is set
  useEffect(() => {
    if (shouldConnect && connectionData?.authToken) {
      mcpx.connect().catch(error => {
        console.error('Connection failed:', error);
        setConnectionData(null);
        setShouldConnect(false);
      });
      setShouldConnect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldConnect, connectionData?.authToken]);

  const handleConnect = async (newConnectionData: ConnectionFormData & { authToken: string }) => {
    setConnectionData(newConnectionData);
    setShouldConnect(true);
  };

  const handleDisconnect = () => {
    mcpx.disconnect();
    setConnectionData(null);
  };

  if (!mcpx.isConnected || !connectionData) {
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