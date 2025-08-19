import { useState, useEffect, useCallback, useRef } from 'react';
import { MCPxClient, MCPxClientConfig } from '@/services/MCPxClient';
import { 
  Envelope, 
  Participant, 
  ConnectionState, 
  SystemWelcomePayload, 
  PresencePayload,
  isChatMessage,
  isPresenceMessage,
  isSystemMessage
} from '@/types/mcpx';

export interface UseMCPxOptions extends Omit<MCPxClientConfig, 'authToken'> {
  authToken?: string;
  autoConnect?: boolean;
}

export interface UseMCPxReturn {
  // Connection state
  connectionState: ConnectionState;
  participants: Participant[];
  messages: Envelope[];
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (envelope: Envelope) => void;
  sendChatMessage: (text: string, format?: 'plain' | 'markdown') => void;
  sendMCPRequest: (to: string, method: string, params?: Record<string, any>, id?: string | number) => void;
  clearMessages: () => void;
  
  // Utilities
  isConnected: boolean;
  chatMessages: Envelope[];
  presenceMessages: Envelope[];
  systemMessages: Envelope[];
}

export function useMCPx(options: UseMCPxOptions): UseMCPxReturn {
  const clientRef = useRef<MCPxClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'disconnected' });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Envelope[]>([]);

  const connect = useCallback(async () => {
    if (!options.authToken) {
      throw new Error('Auth token is required to connect');
    }

    if (clientRef.current) {
      clientRef.current.disconnect();
    }

    const config: MCPxClientConfig = {
      ...options,
      authToken: options.authToken
    };

    const client = new MCPxClient(config);
    clientRef.current = client;

    // Set up event listeners
    client.on('connected', () => {
      setConnectionState(client.getConnectionState());
    });

    client.on('disconnected', () => {
      setConnectionState(client.getConnectionState());
    });

    client.on('error', (error) => {
      setConnectionState(client.getConnectionState());
      console.error('MCPx client error:', error);
    });

    client.on('message', (envelope) => {
      setMessages(prev => [...prev, envelope]);
    });

    client.on('presence', (presencePayload: PresencePayload) => {
      setParticipants(prev => {
        const filtered = prev.filter(p => p.id !== presencePayload.participant.id);
        
        switch (presencePayload.event) {
          case 'join':
            return [...filtered, presencePayload.participant];
          case 'leave':
            return filtered;
          case 'heartbeat':
            // Update existing participant or add if not exists
            const exists = prev.some(p => p.id === presencePayload.participant.id);
            return exists ? prev : [...filtered, presencePayload.participant];
          default:
            return prev;
        }
      });
    });

    client.on('welcome', (welcome: SystemWelcomePayload) => {
      setParticipants(welcome.participants);
    });

    await client.connect();
  }, [options]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setConnectionState({ status: 'disconnected' });
    setParticipants([]);
  }, []);

  const sendMessage = useCallback((envelope: Envelope) => {
    if (!clientRef.current) {
      throw new Error('Client not connected');
    }
    clientRef.current.sendMessage(envelope);
  }, []);

  const sendChatMessage = useCallback((text: string, format: 'plain' | 'markdown' = 'plain') => {
    if (!clientRef.current) {
      throw new Error('Client not connected');
    }
    clientRef.current.sendChatMessage(text, format);
  }, []);

  const sendMCPRequest = useCallback((
    to: string, 
    method: string, 
    params?: Record<string, any>, 
    id?: string | number
  ) => {
    if (!clientRef.current) {
      throw new Error('Client not connected');
    }
    clientRef.current.sendMCPRequest(to, method, params, id);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect && options.authToken) {
      connect().catch(console.error);
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect, options.authToken, connect, disconnect]);

  // Derived state
  const isConnected = connectionState.status === 'connected';
  const chatMessages = messages.filter(isChatMessage);
  const presenceMessages = messages.filter(isPresenceMessage);
  const systemMessages = messages.filter(isSystemMessage);

  return {
    // State
    connectionState,
    participants,
    messages,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    sendChatMessage,
    sendMCPRequest,
    clearMessages,
    
    // Derived state
    isConnected,
    chatMessages,
    presenceMessages,
    systemMessages
  };
}