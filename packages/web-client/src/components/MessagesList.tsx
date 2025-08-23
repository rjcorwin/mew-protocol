import { format } from 'date-fns';
import { User, Bot, Zap, CheckCircle, XCircle } from 'lucide-react';
import { 
  Envelope, 
  isChatMessage, 
  isPresenceMessage, 
  isSystemMessage,
  ParticipantKind 
} from '@/types/mcpx';

export interface MessagesListProps {
  messages: Envelope[];
  currentParticipantId?: string;
}

function getParticipantIcon(kind?: ParticipantKind) {
  switch (kind) {
    case 'human':
      return User;
    case 'robot':
      return Bot;
    case 'agent':
    default:
      return Zap;
  }
}

function MessageBubble({ 
  envelope, 
  isFromCurrentUser 
}: { 
  envelope: Envelope; 
  isFromCurrentUser: boolean;
}) {
  const timestamp = format(new Date(envelope.ts), 'HH:mm:ss');
  
  if (isChatMessage(envelope)) {
    const { text, format: messageFormat } = envelope.payload.params;
    
    return (
      <div className={`flex gap-3 mb-4 ${isFromCurrentUser ? 'flex-row-reverse' : ''}`}>
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
        </div>
        
        <div className={`flex-1 max-w-xs lg:max-w-md xl:max-w-lg ${isFromCurrentUser ? 'text-right' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{envelope.from}</span>
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          </div>
          
          <div className={`rounded-lg px-3 py-2 ${
            isFromCurrentUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}>
            {messageFormat === 'markdown' ? (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br>') }}
              />
            ) : (
              <p className="whitespace-pre-wrap">{text}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isPresenceMessage(envelope)) {
    const { event, participant } = envelope.payload;
    const Icon = getParticipantIcon(participant.kind);
    
    return (
      <div className="flex items-center justify-center my-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
          <Icon className="w-3 h-3" />
          <span>
            <strong>{participant.name}</strong>
            {event === 'join' && ' joined the topic'}
            {event === 'leave' && ' left the topic'}
            {event === 'heartbeat' && ' is active'}
          </span>
          <span className="text-xs">{timestamp}</span>
        </div>
      </div>
    );
  }

  if (isSystemMessage(envelope)) {
    return (
      <div className="flex items-center justify-center my-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
          <CheckCircle className="w-3 h-3" />
          <span>System: {envelope.payload.event}</span>
          <span className="text-xs">{timestamp}</span>
        </div>
      </div>
    );
  }

  // MCP Request/Response/Notification
  const { method, id, result, error } = envelope.payload;
  const isRequest = method && id;
  const isResponse = id && (result !== undefined || error);
  const isNotification = method && !id;

  return (
    <div className="mb-4 p-3 border rounded-lg bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">{envelope.from}</span>
          {envelope.to && envelope.to.length > 0 && (
            <>
              <span className="text-muted-foreground">→</span>
              <span className="text-sm text-muted-foreground">
                {envelope.to.join(', ')}
              </span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{timestamp}</span>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {isRequest && (
            <>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                REQUEST
              </span>
              <code className="text-sm">{method}</code>
            </>
          )}
          
          {isResponse && (
            <>
              {error ? (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                    ERROR
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                    RESPONSE
                  </span>
                </>
              )}
            </>
          )}
          
          {isNotification && (
            <>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                NOTIFICATION
              </span>
              <code className="text-sm">{method}</code>
            </>
          )}
        </div>

        {id && (
          <div className="text-xs text-muted-foreground">ID: {id}</div>
        )}

        {envelope.correlation_id && (
          <div className="text-xs text-muted-foreground">
            Correlation: {envelope.correlation_id}
          </div>
        )}
        
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Payload
          </summary>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
            {JSON.stringify(envelope.payload, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

export function MessagesList({ messages, currentParticipantId }: MessagesListProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {messages.map((envelope) => (
        <MessageBubble
          key={envelope.id}
          envelope={envelope}
          isFromCurrentUser={envelope.from === currentParticipantId}
        />
      ))}
    </div>
  );
}