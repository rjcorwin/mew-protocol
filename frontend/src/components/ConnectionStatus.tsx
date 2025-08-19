import { Wifi, WifiOff, Loader, AlertTriangle } from 'lucide-react';
import { ConnectionState } from '@/types/mcpx';

export interface ConnectionStatusProps {
  connectionState: ConnectionState;
  className?: string;
}

export function ConnectionStatus({ connectionState, className = '' }: ConnectionStatusProps) {
  const getStatusDisplay = () => {
    switch (connectionState.status) {
      case 'connected':
        return {
          icon: Wifi,
          text: 'Connected',
          color: 'text-green-500',
          bgColor: 'bg-green-100'
        };
      case 'connecting':
        return {
          icon: Loader,
          text: 'Connecting...',
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          animate: true
        };
      case 'error':
        return {
          icon: AlertTriangle,
          text: 'Error',
          color: 'text-red-500',
          bgColor: 'bg-red-100'
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          text: 'Disconnected',
          color: 'text-gray-500',
          bgColor: 'bg-gray-100'
        };
    }
  };

  const { icon: Icon, text, color, bgColor, animate } = getStatusDisplay();

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${bgColor} ${className}`}>
      <Icon className={`w-4 h-4 ${color} ${animate ? 'animate-spin' : ''}`} />
      <span className={color}>{text}</span>
      {connectionState.topic && (
        <span className="text-xs text-muted-foreground">
          • {connectionState.topic}
        </span>
      )}
      {connectionState.error && (
        <span className="text-xs text-red-600 max-w-xs truncate" title={connectionState.error}>
          • {connectionState.error}
        </span>
      )}
    </div>
  );
}