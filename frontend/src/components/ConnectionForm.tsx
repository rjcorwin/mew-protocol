import { useState } from 'react';
import { AuthService } from '@/services/AuthService';

export interface ConnectionFormData {
  serverUrl: string;
  participantId: string;
  topic: string;
}

export interface ConnectionFormProps {
  onConnect: (data: ConnectionFormData & { authToken: string }) => void;
  loading?: boolean;
  error?: string;
}

export function ConnectionForm({ onConnect, loading, error }: ConnectionFormProps) {
  const [formData, setFormData] = useState<ConnectionFormData>({
    serverUrl: 'http://localhost:3000',
    participantId: '',
    topic: ''
  });

  const [authError, setAuthError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!formData.participantId.trim() || !formData.topic.trim()) {
      setAuthError('Participant ID and topic are required');
      return;
    }

    try {
      const authService = new AuthService(formData.serverUrl);
      const authToken = await authService.generateToken({
        participantId: formData.participantId.trim(),
        topic: formData.topic.trim()
      });

      onConnect({
        ...formData,
        participantId: formData.participantId.trim(),
        topic: formData.topic.trim(),
        authToken: authToken.token
      });
    } catch (error) {
      setAuthError(`Authentication failed: ${(error as Error).message}`);
    }
  };

  const handleChange = (field: keyof ConnectionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-md mx-auto bg-card p-6 rounded-lg border">
      <h2 className="text-2xl font-bold mb-6 text-center">Connect to MCPx</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="serverUrl" className="block text-sm font-medium mb-1">
            Server URL
          </label>
          <input
            id="serverUrl"
            type="url"
            value={formData.serverUrl}
            onChange={(e) => handleChange('serverUrl', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="http://localhost:3000"
            required
          />
        </div>

        <div>
          <label htmlFor="participantId" className="block text-sm font-medium mb-1">
            Participant ID
          </label>
          <input
            id="participantId"
            type="text"
            value={formData.participantId}
            onChange={(e) => handleChange('participantId', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="my-agent-id"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Your unique identifier in the topic
          </p>
        </div>

        <div>
          <label htmlFor="topic" className="block text-sm font-medium mb-1">
            Topic
          </label>
          <input
            id="topic"
            type="text"
            value={formData.topic}
            onChange={(e) => handleChange('topic', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="room:general"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            The topic/room to join
          </p>
        </div>

        {(error || authError) && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
            {error || authError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </form>

      <div className="mt-6 text-xs text-muted-foreground">
        <h3 className="font-medium mb-2">Quick Examples:</h3>
        <div className="space-y-1">
          <div><strong>Topic:</strong> room:general, room:dev, fleet:robots</div>
          <div><strong>Participant:</strong> alice, robot-1, weather-agent</div>
        </div>
      </div>
    </div>
  );
}