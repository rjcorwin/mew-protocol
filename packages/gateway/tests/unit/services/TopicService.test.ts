import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { TopicService } from '../../../src/services/TopicService';
import { testConfig, createTestParticipant, createTestEnvelope } from '../../helpers/testUtils';
import { validateEnvelope } from '../../../src/types/mcpx';

// Mock WebSocket
const mockWebSocket = {
  readyState: WebSocket.OPEN,
  send: vi.fn(),
  close: vi.fn()
} as any as WebSocket;

describe('TopicService', () => {
  let topicService: TopicService;

  beforeEach(() => {
    topicService = new TopicService(testConfig);
    vi.clearAllMocks();
  });

  describe('createTopic', () => {
    it('should create a new topic', () => {
      const topicName = 'test-topic';
      const topic = topicService.createTopic(topicName);

      expect(topic.participants.size).toBe(0);
      expect(topic.messageHistory).toEqual([]);
      expect(topic.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getTopic', () => {
    it('should return existing topic', () => {
      const topicName = 'test-topic';
      topicService.createTopic(topicName);
      
      const topic = topicService.getTopic(topicName);
      expect(topic).toBeDefined();
    });

    it('should return undefined for non-existent topic', () => {
      const topic = topicService.getTopic('non-existent');
      expect(topic).toBeUndefined();
    });
  });

  describe('getOrCreateTopic', () => {
    it('should return existing topic if it exists', () => {
      const topicName = 'test-topic';
      const original = topicService.createTopic(topicName);
      
      const retrieved = topicService.getOrCreateTopic(topicName);
      expect(retrieved).toBe(original);
    });

    it('should create new topic if it does not exist', () => {
      const topicName = 'new-topic';
      const topic = topicService.getOrCreateTopic(topicName);
      
      expect(topic).toBeDefined();
      expect(topic.participants.size).toBe(0);
    });
  });

  describe('joinTopic', () => {
    it('should allow participant to join topic', () => {
      const topicName = 'test-topic';
      const participant = createTestParticipant('user1');
      
      const client = topicService.joinTopic(topicName, participant, mockWebSocket);
      
      expect(client.participant).toBe(participant);
      expect(client.ws).toBe(mockWebSocket);
      expect(client.topic).toBe(topicName);
      
      const topic = topicService.getTopic(topicName);
      expect(topic!.participants.has('user1')).toBe(true);
    });

    it('should reject participant if topic is full', () => {
      const topicName = 'test-topic';
      
      // Fill up the topic
      for (let i = 0; i < testConfig.topics.maxParticipants; i++) {
        const participant = createTestParticipant(`user${i}`);
        topicService.joinTopic(topicName, participant, mockWebSocket);
      }
      
      // Try to add one more
      const extraParticipant = createTestParticipant('extra-user');
      expect(() => {
        topicService.joinTopic(topicName, extraParticipant, mockWebSocket);
      }).toThrow('Topic test-topic is full');
    });

    it('should reject duplicate participant', () => {
      const topicName = 'test-topic';
      const participant = createTestParticipant('user1');
      
      topicService.joinTopic(topicName, participant, mockWebSocket);
      
      expect(() => {
        topicService.joinTopic(topicName, participant, mockWebSocket);
      }).toThrow('Participant user1 already in topic test-topic');
    });
  });

  describe('leaveTopic', () => {
    it('should remove participant from topic', () => {
      const topicName = 'test-topic';
      const participant1 = createTestParticipant('user1');
      const participant2 = createTestParticipant('user2');
      
      topicService.joinTopic(topicName, participant1, mockWebSocket);
      topicService.joinTopic(topicName, participant2, mockWebSocket);
      topicService.leaveTopic(topicName, 'user1');
      
      const topic = topicService.getTopic(topicName);
      expect(topic!.participants.has('user1')).toBe(false);
      expect(topic!.participants.has('user2')).toBe(true);
    });

    it('should handle leaving non-existent topic gracefully', () => {
      expect(() => {
        topicService.leaveTopic('non-existent', 'user1');
      }).not.toThrow();
    });

    it('should handle leaving with non-existent participant gracefully', () => {
      const topicName = 'test-topic';
      topicService.createTopic(topicName);
      
      expect(() => {
        topicService.leaveTopic(topicName, 'non-existent-user');
      }).not.toThrow();
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message to all participants', () => {
      const topicName = 'test-topic';
      const participant1 = createTestParticipant('user1');
      const participant2 = createTestParticipant('user2');
      
      const mockWs1 = { ...mockWebSocket, send: vi.fn() } as any as WebSocket;
      const mockWs2 = { ...mockWebSocket, send: vi.fn() } as any as WebSocket;
      
      topicService.joinTopic(topicName, participant1, mockWs1);
      topicService.joinTopic(topicName, participant2, mockWs2);
      
      const envelope = createTestEnvelope('user1');
      topicService.broadcastMessage(topicName, envelope, 'user1');
      
      expect(mockWs1.send).toHaveBeenCalledWith(JSON.stringify(envelope));
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(envelope));
    });

    it('should send message only to specified recipients', () => {
      const topicName = 'test-topic';
      const participant1 = createTestParticipant('user1');
      const participant2 = createTestParticipant('user2');
      const participant3 = createTestParticipant('user3');
      
      const mockWs1 = { ...mockWebSocket, send: vi.fn() } as any as WebSocket;
      const mockWs2 = { ...mockWebSocket, send: vi.fn() } as any as WebSocket;
      const mockWs3 = { ...mockWebSocket, send: vi.fn() } as any as WebSocket;
      
      topicService.joinTopic(topicName, participant1, mockWs1);
      topicService.joinTopic(topicName, participant2, mockWs2);
      topicService.joinTopic(topicName, participant3, mockWs3);
      
      // Clear mock calls from join operations
      vi.clearAllMocks();
      
      const envelope = createTestEnvelope('user1');
      envelope.to = ['user2']; // Only send to user2
      
      topicService.broadcastMessage(topicName, envelope, 'user1');
      
      expect(mockWs1.send).not.toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalledWith(JSON.stringify(envelope));
      expect(mockWs3.send).not.toHaveBeenCalled();
    });

    it('should add message to history', () => {
      const topicName = 'test-topic';
      const participant = createTestParticipant('user1');
      
      topicService.joinTopic(topicName, participant, mockWebSocket);
      
      const envelope = createTestEnvelope('user1');
      topicService.broadcastMessage(topicName, envelope, 'user1');
      
      const topic = topicService.getTopic(topicName);
      expect(topic!.messageHistory).toContain(envelope);
    });
  });

  describe('getParticipants', () => {
    it('should return all participants in topic', () => {
      const topicName = 'test-topic';
      const participant1 = createTestParticipant('user1');
      const participant2 = createTestParticipant('user2');
      
      topicService.joinTopic(topicName, participant1, mockWebSocket);
      topicService.joinTopic(topicName, participant2, mockWebSocket);
      
      const participants = topicService.getParticipants(topicName);
      
      expect(participants).toHaveLength(2);
      expect(participants.some(p => p.id === 'user1')).toBe(true);
      expect(participants.some(p => p.id === 'user2')).toBe(true);
    });

    it('should return empty array for non-existent topic', () => {
      const participants = topicService.getParticipants('non-existent');
      expect(participants).toEqual([]);
    });
  });

  describe('getHistory', () => {
    it('should return message history', () => {
      const topicName = 'test-topic';
      const participant = createTestParticipant('user1');
      
      topicService.joinTopic(topicName, participant, mockWebSocket);
      
      const envelope1 = createTestEnvelope('user1');
      const envelope2 = createTestEnvelope('user1');
      
      topicService.broadcastMessage(topicName, envelope1, 'user1');
      topicService.broadcastMessage(topicName, envelope2, 'user1');
      
      const history = topicService.getHistory(topicName);
      
      expect(history).toHaveLength(2);
      // Most recent first
      expect(history[0]).toBe(envelope2);
      expect(history[1]).toBe(envelope1);
    });

    it('should limit history results', () => {
      const topicName = 'test-topic';
      const participant = createTestParticipant('user1');
      
      topicService.joinTopic(topicName, participant, mockWebSocket);
      
      // Add multiple messages
      for (let i = 0; i < 5; i++) {
        const envelope = createTestEnvelope('user1');
        topicService.broadcastMessage(topicName, envelope, 'user1');
      }
      
      const history = topicService.getHistory(topicName, 3);
      expect(history).toHaveLength(3);
    });

    it('should return empty array for non-existent topic', () => {
      const history = topicService.getHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('getTopics', () => {
    it('should return list of topic names', () => {
      topicService.createTopic('topic1');
      topicService.createTopic('topic2');
      
      const topics = topicService.getTopics();
      
      expect(topics).toContain('topic1');
      expect(topics).toContain('topic2');
    });

    it('should return empty array when no topics exist', () => {
      const topics = topicService.getTopics();
      expect(topics).toEqual([]);
    });
  });
});