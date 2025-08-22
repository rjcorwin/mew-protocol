import { User, Bot, Zap, MessageCircle, Users } from 'lucide-react';
import { Participant, ParticipantKind } from '@/types/mcpx';

export interface ParticipantsListProps {
  participants: Participant[];
  currentParticipantId?: string;
  onParticipantAction?: (participant: Participant, action: string) => void;
}

function getParticipantIcon(kind: ParticipantKind) {
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

function getParticipantColor(kind: ParticipantKind) {
  switch (kind) {
    case 'human':
      return 'text-blue-500';
    case 'robot':
      return 'text-green-500';
    case 'agent':
    default:
      return 'text-purple-500';
  }
}

export function ParticipantsList({ 
  participants, 
  currentParticipantId,
  onParticipantAction 
}: ParticipantsListProps) {
  const handleAction = (participant: Participant, action: string) => {
    onParticipantAction?.(participant, action);
  };

  return (
    <div className="space-y-1 p-2">
      {participants.map((participant) => {
        const Icon = getParticipantIcon(participant.kind);
        const isCurrentUser = participant.id === currentParticipantId;
        
        return (
          <div
            key={participant.id}
            className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
              isCurrentUser 
                ? 'bg-primary/10 border border-primary/20' 
                : 'hover:bg-accent'
            }`}
          >
            <Icon 
              className={`w-4 h-4 ${getParticipantColor(participant.kind)}`} 
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {participant.name}
                </span>
                {isCurrentUser && (
                  <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                    you
                  </span>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground">
                {participant.id}
              </div>
              
              <div className="text-xs text-muted-foreground">
                {participant.kind} • MCP {participant.mcp.version}
              </div>
            </div>

            {!isCurrentUser && onParticipantAction && (
              <div className="flex gap-1">
                <button
                  onClick={() => handleAction(participant, 'tools/list')}
                  className="p-1.5 rounded-md hover:bg-accent-foreground/10 text-muted-foreground hover:text-foreground"
                  title={`List ${participant.name}'s tools`}
                >
                  <Zap className="w-3 h-3" />
                </button>
                
                <button
                  onClick={() => handleAction(participant, 'chat')}
                  className="p-1.5 rounded-md hover:bg-accent-foreground/10 text-muted-foreground hover:text-foreground"
                  title={`Message ${participant.name}`}
                  disabled // Direct messaging not implemented in v0
                >
                  <MessageCircle className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {participants.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No participants yet</p>
        </div>
      )}
    </div>
  );
}