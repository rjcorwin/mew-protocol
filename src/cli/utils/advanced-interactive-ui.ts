// @ts-nocheck
/**
 * Advanced Interactive UI using Ink
 *
 * Provides a modern terminal interface with native scrolling, MCP confirmations,
 * and rich formatting for MEW protocol interactions.
 * 
 * Based on Gemini CLI patterns and MEW Protocol v0.4 specification.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { render, Box, Text, Static, useInput, useApp, useFocus, useStdout } from 'ink';
import { v4 as uuidv4 } from 'uuid';
import EnhancedInput from '../ui/components/EnhancedInput.js';
import { slashCommandList, slashCommandGroups } from '../ui/utils/slashCommands.js';

const DECORATIVE_SYSTEM_KINDS = new Set([
  'system/welcome',
  'system/heartbeat'
]);

function isDecorativeSystemMessage(message) {
  if (!message || !message.kind) {
    return false;
  }
  return DECORATIVE_SYSTEM_KINDS.has(message.kind);
}

function createSignalBoardSummary(ackCount, statusCount, pauseState, includeAck = true) {
  const parts = [];
  if (includeAck && ackCount > 0) {
    parts.push(`acks:${ackCount}`);
  }
  if (statusCount > 0) {
    parts.push(`status:${statusCount}`);
  }
  if (pauseState) {
    parts.push('paused');
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Main Advanced Interactive UI Component
 */
function AdvancedInteractiveUI({ ws, participantId, spaceId }) {
  const [messages, setMessages] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [verbose, setVerbose] = useState(false);
  const [showStreams, setShowStreams] = useState(false);
  const [activeReasoning, setActiveReasoning] = useState(null); // Track active reasoning sessions
  const [grantedCapabilities, setGrantedCapabilities] = useState(new Map()); // Track granted capabilities by participant
  const [pendingAcknowledgements, setPendingAcknowledgements] = useState([]);
  const [myPendingAcknowledgements, setMyPendingAcknowledgements] = useState([]);
  const [participantStatuses, setParticipantStatuses] = useState(new Map());
  const [pauseState, setPauseState] = useState(null);
  const [activeStreams, setActiveStreams] = useState(new Map());
  const [streamFrames, setStreamFrames] = useState([]);
  const [knownParticipants, setKnownParticipants] = useState(() => []);
  const [toolCatalog, setToolCatalog] = useState(() => new Map());
  const reasoningStreamRequestsRef = useRef(new Map());
  const reasoningStreamsRef = useRef(new Map());
  const reasoningUpdateTimerRef = useRef(null);
  const pendingReasoningUpdateRef = useRef(null);
  const contextUsageEntries = useMemo(() => buildContextUsageEntries(participantStatuses), [participantStatuses]);
  const [signalBoardExpanded, setSignalBoardExpanded] = useState(false);
  const [signalBoardOverride, setSignalBoardOverride] = useState(null);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(() => {
    if (stdout && typeof stdout.columns === 'number') {
      return stdout.columns;
    }
    if (typeof process?.stdout?.columns === 'number') {
      return process.stdout.columns;
    }
    return null;
  });

  useEffect(() => {
    if (!stdout || typeof stdout.on !== 'function') {
      return undefined;
    }

    const handleResize = () => {
      if (typeof stdout.columns === 'number') {
        setTerminalWidth(stdout.columns);
      }
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  const registerParticipants = useCallback((ids) => {
    if (!ids) {
      return;
    }

    const list = Array.isArray(ids) ? ids : [ids];

    setKnownParticipants(prev => {
      const nextSet = new Set(prev);
      let changed = false;

      for (const id of list) {
        if (!id || typeof id !== 'string') {
          continue;
        }

        if (!nextSet.has(id)) {
          nextSet.add(id);
          changed = true;
        }
      }

      if (!changed) {
        return prev;
      }

      return Array.from(nextSet).sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const registerTools = useCallback((participant, tools) => {
    if (!participant || !Array.isArray(tools)) {
      return;
    }

    const normalized = tools
      .map(tool => {
        if (!tool) {
          return null;
        }

        if (typeof tool === 'string') {
          return { name: tool, description: null, displayName: null, inputSchema: null };
        }

        if (typeof tool === 'object') {
          const name = tool.name || tool.id || tool.value;
          if (!name) {
            return null;
          }

          const description = typeof tool.description === 'string' ? tool.description : null;
          const displayName = tool.display_name || tool.displayName || null;
          const inputSchema = tool.inputSchema || tool.input_schema || tool.schema || tool.parameters || null;

          return {
            name,
            description,
            displayName,
            inputSchema: inputSchema || null
          };
        }

        return null;
      })
      .filter(Boolean);

    setToolCatalog(prev => {
      const existing = prev.get(participant);

      if (existing && existing.length === normalized.length) {
        let identical = true;
        for (let index = 0; index < normalized.length; index += 1) {
          const current = existing[index];
          const next = normalized[index];
          if (!current || !next ||
              current.name !== next.name ||
              current.description !== next.description ||
              current.displayName !== next.displayName ||
              JSON.stringify(current.inputSchema) !== JSON.stringify(next.inputSchema)) {
            identical = false;
            break;
          }
        }

        if (identical) {
          return prev;
        }
      }

      const nextCatalog = new Map(prev);
      nextCatalog.set(participant, normalized);
      return nextCatalog;
    });
  }, []);

  useEffect(() => {
    registerParticipants([participantId]);
  }, [participantId, registerParticipants]);

  const meaningfulMessageCount = useMemo(() => {
    return messages.reduce((count, entry) => {
      return count + (isDecorativeSystemMessage(entry.message) ? 0 : 1);
    }, 0);
  }, [messages]);
  const signalBoardHasActivity = myPendingAcknowledgements.length > 0 ||
    participantStatuses.size > 0 ||
    Boolean(pauseState) ||
    activeStreams.size > 0 ||
    streamFrames.length > 0;
  const wideEnoughForDockedLayout = terminalWidth === null || terminalWidth >= 110;
  const desiredLayout = wideEnoughForDockedLayout && (signalBoardHasActivity || meaningfulMessageCount >= 2)
    ? 'docked'
    : 'stacked';
  const [layoutMode, setLayoutMode] = useState(desiredLayout);

  useEffect(() => {
    setLayoutMode(prev => {
      if (desiredLayout !== prev) {
        return desiredLayout;
      }
      return prev;
    });
  }, [desiredLayout]);
  const showEmptyStateCard = !signalBoardHasActivity && meaningfulMessageCount === 0;

  useEffect(() => {
    if (signalBoardOverride === 'open' && !signalBoardExpanded) {
      setSignalBoardExpanded(true);
    }
    if (signalBoardOverride === 'closed' && signalBoardExpanded) {
      setSignalBoardExpanded(false);
    }
  }, [signalBoardOverride, signalBoardExpanded]);

  useEffect(() => {
    if (signalBoardOverride === 'open') {
      return;
    }
    if (!signalBoardHasActivity && signalBoardExpanded) {
      setSignalBoardExpanded(false);
    }
  }, [signalBoardHasActivity, signalBoardExpanded, signalBoardOverride]);

  // Throttled reasoning update to prevent performance issues during streaming
  const updateReasoningThrottled = useCallback((updateFn) => {
    // Store the latest update function
    pendingReasoningUpdateRef.current = updateFn;

    // If no timer is running, start one
    if (!reasoningUpdateTimerRef.current) {
      reasoningUpdateTimerRef.current = setTimeout(() => {
        // Apply the latest pending update
        if (pendingReasoningUpdateRef.current) {
          setActiveReasoning(pendingReasoningUpdateRef.current);
          pendingReasoningUpdateRef.current = null;
        }
        reasoningUpdateTimerRef.current = null;
      }, 100); // Update at most every 100ms
    }
  }, []);

  // Environment configuration
  const showHeartbeat = process.env.MEW_INTERACTIVE_SHOW_HEARTBEAT === 'true';
  const showSystem = process.env.MEW_INTERACTIVE_SHOW_SYSTEM !== 'false';
  const useColor = process.env.MEW_INTERACTIVE_COLOR !== 'false';

  // Cleanup throttle timer on unmount
  useEffect(() => {
    return () => {
      if (reasoningUpdateTimerRef.current) {
        clearTimeout(reasoningUpdateTimerRef.current);
        reasoningUpdateTimerRef.current = null;
      }
    };
  }, []);

  // Setup WebSocket handlers
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (data) => {
      const raw = typeof data === 'string' ? data : data.toString();

      // Check if this is a stream data frame (format: #streamID#data)
      if (raw.startsWith('#')) {
        const match = raw.match(/^#([^#]+)#([\s\S]*)$/);
        if (match) {
          const streamId = match[1];
          const streamData = match[2];

          // Store frame for display
          handleStreamFrame(streamId, streamData);

          // Process stream data for reasoning
          handleStreamData(streamId, streamData);
          return;
        }
      }

      try {
        const message = JSON.parse(raw);
        const participantsToRegister = [];
        if (message.from) {
          participantsToRegister.push(message.from);
        }
        if (Array.isArray(message.to)) {
          participantsToRegister.push(...message.to);
        }
        if (participantsToRegister.length > 0) {
          registerParticipants(participantsToRegister);
        }
        handleIncomingMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    const handleClose = () => {
      exit();
    };

    const handleError = (err) => {
      console.error('WebSocket error:', err);
      exit();
    };

    ws.on('message', handleMessage);
    ws.on('close', handleClose);
    ws.on('error', handleError);

    return () => {
      ws.off('message', handleMessage);
      ws.off('close', handleClose);
      ws.off('error', handleError);
    };
  }, [ws, exit]);

  const addMessage = (message, sent = false) => {
    setMessages(prev => [...prev, {
      id: message.id || uuidv4(),
      message,
      sent,
      timestamp: new Date(),
    }]);
  };

  const handleStreamFrame = (streamId, payload) => {
    const timestamp = new Date();
    const frame = {
      streamId,
      payload,
      timestamp
    };

    setStreamFrames(prev => {
      const next = [...prev, frame];
      return next.slice(-50);
    });

    setActiveStreams(prev => {
      const next = new Map(prev);
      const existing = next.get(streamId);
      if (existing) {
        next.set(streamId, { ...existing, lastActivityAt: timestamp });
      } else {
        next.set(streamId, {
          streamId,
          openedBy: 'unknown',
          openedAt: timestamp,
          lastActivityAt: timestamp,
        });
      }
      return next;
    });

    let shouldAddMessage = true;
    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      parsed = null;
    }

    let reasoningStream = reasoningStreamsRef.current.get(streamId);
    if (!reasoningStream && parsed && parsed.context) {
      reasoningStreamsRef.current.set(streamId, { contextId: parsed.context, from: parsed.from || 'unknown' });
      reasoningStream = reasoningStreamsRef.current.get(streamId);
    }

    if (reasoningStream && parsed && parsed.context === reasoningStream.contextId) {
      const chunkType = parsed.type || 'token';
      if (chunkType === 'token' && typeof parsed.value === 'string') {
        const chunkText = parsed.value;
        shouldAddMessage = false;
        setActiveReasoning(prev => {
          if (!prev || prev.id !== parsed.context) {
            return prev;
          }
          const combined = `${prev.streamText || ''}${chunkText}`;
          const trimmed = combined.length > 4000 ? combined.slice(-4000) : combined;
          return {
            ...prev,
            streamText: trimmed,
            lastTokenUpdate: new Date()
          };
        });
      } else if (chunkType === 'thought') {
        shouldAddMessage = false;
        const reasoningText = parsed.value?.reasoning || parsed.value?.message;
        setActiveReasoning(prev => {
          if (!prev || prev.id !== parsed.context) {
            return prev;
          }
          const nextStreamText = reasoningText || prev.streamText;
          return {
            ...prev,
            message: reasoningText || prev.message,
            streamText: nextStreamText,
            lastTokenUpdate: new Date()
          };
        });
      } else if (chunkType === 'status') {
        shouldAddMessage = false;
        if (parsed.event === 'conclusion' || parsed.event === 'cancelled') {
          reasoningStreamsRef.current.delete(streamId);
        }
      }
    }

    // Don't add stream/data messages to the message list
    // They're already displayed in the Signal Board's stream monitor
  };

  const handleStreamData = (streamId, data) => {
    // Show stream data if streams mode is enabled
    if (showStreams) {
      addSystemMessage(`[STREAM ${streamId}] ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}`, 'stream');
    }

    try {
      const parsed = JSON.parse(data);

      // Check if this is reasoning stream data
      const streamInfo = reasoningStreamsRef.current.get(streamId);
      if (streamInfo) {
        const { contextId } = streamInfo;

        if (parsed.type === 'progress' && parsed.tokenCount) {
          // Update token count to show progress in the active reasoning bar (throttled)
          updateReasoningThrottled(prev => {
            if (prev && prev.id === contextId) {
              return {
                ...prev,
                tokenCount: parsed.tokenCount,
                updateCount: (prev.updateCount || 0) + 1
              };
            }
            return prev;
          });
        } else if (parsed.type === 'token' && parsed.value) {
          // Update reasoning session with actual token content (if any)
          setActiveReasoning(prev => {
            if (prev && prev.id === contextId) {
              return {
                ...prev,
                message: (prev.message || '') + parsed.value,
                updateCount: (prev.updateCount || 0) + 1
              };
            }
            return prev;
          });
        } else if (parsed.type === 'thought' && parsed.value) {
          // Handle complete thoughts
          const thoughtText = parsed.value.reasoning || parsed.value.message || parsed.value;
          setActiveReasoning(prev => {
            if (prev && prev.id === contextId) {
              return {
                ...prev,
                message: thoughtText,
                thoughtCount: (prev.thoughtCount || 0) + 1,
                updateCount: (prev.updateCount || 0) + 1
              };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      // Not JSON, might be raw text stream data
      console.error('[Stream] Raw data on stream', streamId, ':', data);
    }
  };

  const handleIncomingMessage = (message) => {
    // Filter out echo messages - don't show messages from ourselves coming back
    // EXCEPT for errors and grant acknowledgments which we want to see
    if (message.from === participantId &&
        message.kind !== 'system/error' &&
        message.kind !== 'capability/grant-ack') {
      return;
    }

    const addressedToMe = !message.to || message.to.length === 0 || message.to.includes(participantId);

    if (message.kind === 'chat' && message.from !== participantId) {
      const text = message.payload?.text || '';
      setPendingAcknowledgements(prev => {
        if (prev.some(entry => entry.id === message.id)) {
          return prev;
        }
        return [...prev, {
          id: message.id,
          from: message.from,
          text,
          timestamp: message.ts ? new Date(message.ts) : new Date(),
          to: message.to
        }];
      });
    }

    if (message.kind === 'chat/acknowledge' || message.kind === 'chat/cancel') {
      const target = message.correlation_id?.[0];
      if (target) {
        setPendingAcknowledgements(prev => prev.filter(entry => entry.id !== target));
        setMyPendingAcknowledgements(prev => {
          const index = prev.findIndex(entry => entry.id === target);
          if (index === -1) {
            return prev;
          }

          if (message.kind === 'chat/cancel') {
            return prev.filter(entry => entry.id !== target);
          }

          const entry = prev[index];
          const recipients = Array.isArray(entry.to) ? entry.to : [];

          // For broadcast messages (no recipients), any acknowledgment removes it
          if (recipients.length === 0) {
            if (message.from) {
              // Someone acknowledged our broadcast message
              return prev.filter(item => item.id !== target);
            }
            return prev;
          }

          // For targeted messages, track individual acknowledgments
          if (message.from && recipients.includes(message.from)) {
            const acked = new Set(entry.acked || []);
            acked.add(message.from);

            if (acked.size >= recipients.length) {
              return prev.filter(item => item.id !== target);
            }

            const updated = { ...entry, acked: Array.from(acked) };
            return [
              ...prev.slice(0, index),
              updated,
              ...prev.slice(index + 1)
            ];
          }

          return prev;
        });
      }
    }

    if (message.kind === 'participant/pause' && addressedToMe) {
      const timeoutSeconds = message.payload?.timeout_seconds;
      const until = timeoutSeconds ? Date.now() + timeoutSeconds * 1000 : null;
      setPauseState({
        reason: message.payload?.reason,
        from: message.from,
        until
      });
    }

    if (message.kind === 'participant/resume' && addressedToMe) {
      setPauseState(null);
    }

    if (message.kind === 'participant/status') {
      setParticipantStatuses(prev => {
        const next = new Map(prev);
        next.set(message.from, {
          payload: message.payload,
          timestamp: message.ts ? new Date(message.ts) : new Date()
        });
        return next;
      });
    }

    if (message.kind === 'participant/compact-done') {
      const freedTokens = message.payload?.freed_tokens;
      const freedMessages = message.payload?.freed_messages;
      const status = message.payload?.status || (message.payload?.skipped ? 'skipped' : 'compacted');
      const details = [];
      if (typeof freedTokens === 'number') {
        details.push(`tokens=${freedTokens}`);
      }
      if (typeof freedMessages === 'number') {
        details.push(`messages=${freedMessages}`);
      }
      if (message.payload?.reason) {
        details.push(`reason=${message.payload.reason}`);
      }

      addMessage({
        kind: 'system/info',
        from: 'system',
        payload: {
          text: `participant ${message.from} compact complete (${status}${details.length ? '; ' + details.join(', ') : ''})`
        }
      }, false);
    }

    if (message.kind === 'mcp/response') {
      const tools = message.payload?.result?.tools;
      if (Array.isArray(tools) && message.from) {
        registerParticipants([message.from]);
        registerTools(message.from, tools);
      }
    }

    if (message.kind === 'stream/open') {
      const streamId = message.payload?.stream_id;
      if (streamId) {
        setActiveStreams(prev => {
          const next = new Map(prev);
          next.set(streamId, {
            streamId,
            description: message.payload?.description,
            encoding: message.payload?.encoding,
            correlationId: message.correlation_id?.[0],
            openEnvelopeId: message.id,
            openedBy: message.from,
            openedAt: message.ts ? new Date(message.ts) : new Date(),
            lastActivityAt: new Date()
          });
          return next;
        });
      }
      // Continue processing for reasoning-specific logic below
    }

    if (message.kind === 'stream/close') {
      const correlationId = message.correlation_id?.[0];
      const streamId = message.payload?.stream_id;
      const reason = message.payload?.reason;
      setActiveStreams(prev => {
        const next = new Map(prev);
        if (streamId && next.has(streamId)) {
          next.delete(streamId);
        } else if (correlationId) {
          for (const [id, meta] of next.entries()) {
            if (meta.openEnvelopeId === correlationId || meta.correlationId === correlationId || id === correlationId) {
              next.delete(id);
            }
          }
        }
        return next;
      });

      if (reason) {
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `Stream closed (${reason})` }
        }, false);
      }
    }

    // Filter messages based on configuration
    if (!showHeartbeat && message.kind === 'system/heartbeat') {
      return;
    }

    if (
      !showSystem &&
      message.kind?.startsWith('system/') &&
      message.kind !== 'system/error'
    ) {
      return;
    }

    // Handle reasoning messages
    if (message.kind === 'reasoning/start') {
      const tokenMetrics = extractReasoningTokenMetrics(message.payload);
      for (const [id, info] of reasoningStreamsRef.current.entries()) {
        if (info.contextId === message.id) {
          reasoningStreamsRef.current.delete(id);
        }
      }
      setActiveReasoning({
        id: message.id,
        from: message.from,
        message: '',
        streamText: '',
        streamId: null,
        streamRequestId: null,
        startTime: new Date(),
        thoughtCount: 0,
        tokenMetrics,
        lastTokenUpdate: tokenMetrics ? new Date() : null
      });
    } else if (message.kind === 'reasoning/thought') {
      setActiveReasoning(prev => {
        if (!prev) return prev;
        if (message.context && message.context !== prev.id) {
          return prev;
        }
        const tokenUpdate = extractReasoningTokenMetrics(message.payload);
        const { metrics, changed } = mergeReasoningTokenMetrics(prev.tokenMetrics, tokenUpdate);
        const reasoningText = message.payload?.reasoning || message.payload?.message;
        const nextStreamText = prev.streamText || reasoningText || '';
        const action = message.payload?.action;
        return {
          ...prev,
          message: reasoningText || prev.message,
          streamText: nextStreamText,
          action: action || prev.action,
          thoughtCount: prev.thoughtCount + 1,
          tokenMetrics: metrics,
          lastTokenUpdate: changed ? new Date() : prev.lastTokenUpdate
        };
      });
    } else if (message.kind === 'reasoning/conclusion') {
      const contextId = message.context || message.id;
      if (contextId) {
        for (const [id, info] of reasoningStreamsRef.current.entries()) {
          if (info.contextId === contextId) {
            reasoningStreamsRef.current.delete(id);
          }
        }
        for (const [requestId, info] of reasoningStreamRequestsRef.current.entries()) {
          if (info?.contextId === contextId) {
            reasoningStreamRequestsRef.current.delete(requestId);
          }
        }
      }
      setActiveReasoning(prev => {
        if (!prev) return null;
        if (contextId && prev.id !== contextId) {
          return prev;
        }
        return null;
      });
    } else if (message.kind === 'reasoning/cancel') {
      const contextId = message.context || message.id;
      if (contextId) {
        for (const [id, info] of reasoningStreamsRef.current.entries()) {
          if (info.contextId === contextId) {
            reasoningStreamsRef.current.delete(id);
          }
        }
        for (const [requestId, info] of reasoningStreamRequestsRef.current.entries()) {
          if (info?.contextId === contextId) {
            reasoningStreamRequestsRef.current.delete(requestId);
          }
        }
      }
      setActiveReasoning(prev => {
        if (!prev) return prev;
        if (contextId && prev.id !== contextId) {
          return prev;
        }
        return null;
      });
      if (message.payload?.reason) {
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `Reasoning cancelled (${message.payload.reason})` }
        }, false);
      }
    }

    if (message.kind === 'stream/request') {
      const description = message.payload?.description;
      if (typeof description === 'string' && description.startsWith('reasoning:')) {
        const contextId = description.slice('reasoning:'.length);
        reasoningStreamRequestsRef.current.set(message.id, { contextId, from: message.from });
        setActiveReasoning(prev => {
          if (!prev || prev.id !== contextId) {
            return prev;
          }
          return { ...prev, streamRequestId: message.id };
        });
      }
    }

    // Handle reasoning-specific stream logic (this is a second handler for the same event)
    if (message.kind === 'stream/open') {
      const streamId = message.payload?.stream_id;
      let contextId = null;
      const requestId = message.correlation_id?.[0];
      if (requestId && reasoningStreamRequestsRef.current.has(requestId)) {
        const info = reasoningStreamRequestsRef.current.get(requestId);
        reasoningStreamRequestsRef.current.delete(requestId);
        contextId = info?.contextId || null;
      }
      const description = message.payload?.description;
      if (!contextId && typeof description === 'string' && description.startsWith('reasoning:')) {
        contextId = description.slice('reasoning:'.length);
      }
      if (contextId && streamId) {
        reasoningStreamsRef.current.set(streamId, { contextId, from: message.from });
        setActiveReasoning(prev => {
          if (!prev || prev.id !== contextId) {
            return prev;
          }
          return { ...prev, streamId };
        });
      }
    }

    if (message.kind === 'stream/close') {
      const streamId = message.payload?.stream_id;
      const correlationId = message.correlation_id?.[0];
      if (streamId && reasoningStreamsRef.current.has(streamId)) {
        reasoningStreamsRef.current.delete(streamId);
      }
      if (correlationId) {
        reasoningStreamRequestsRef.current.delete(correlationId);
        if (reasoningStreamsRef.current.has(correlationId)) {
          reasoningStreamsRef.current.delete(correlationId);
        }
      }
    }

    // Handle capability grant acknowledgments
    if (message.kind === 'capability/grant-ack') {
      console.error('[DEBUG] Received grant acknowledgment:', JSON.stringify(message.payload));
      addMessage({
        kind: 'system/info',
        from: 'system',
        payload: { text: `✅ Capability grant acknowledged by ${message.from}` }
      }, false);
    }

    // Handle welcome message updates (after capability grants)
    if (message.kind === 'system/welcome' && message.to?.includes(participantId)) {
      // This could be an updated welcome after a grant
      const capabilities = message.payload?.you?.capabilities || [];
      console.error('[DEBUG] Received welcome with capabilities:', capabilities.length);

      // Check if this is an update (not the initial welcome)
      if (messages.length > 5) { // Heuristic: not the initial connection
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `📋 Your capabilities have been updated (${capabilities.length} total)` }
        }, false);
      }
    }

    // Handle errors (especially for capability violations)
    if (message.kind === 'system/error') {
      console.error('[DEBUG] Received error:', JSON.stringify(message.payload));
      if (message.payload?.error === 'capability_violation' &&
          message.payload?.attempted_kind === 'capability/grant') {
        addMessage({
          kind: 'system/error',
          from: 'system',
          payload: { text: `❌ Cannot grant capabilities: You lack the 'capability/grant' permission` }
        }, false);
      }
    }

    // Check if this is an MCP proposal requiring confirmation
    // In MEW v0.4, mcp/proposal contains operation details that need approval
    if (message.kind === 'mcp/proposal') {
      // Check if we've already granted this capability
      const proposerGrants = grantedCapabilities.get(message.from) || [];
      const method = message.payload?.method;
      const toolName = message.payload?.params?.name;

      // Check if we have a matching grant for this operation
      const hasGrant = proposerGrants.some(grant => {
        // Check if the granted capability matches this proposal
        if (grant.kind === 'mcp/request' || grant.kind === 'mcp/*') {
          // Check method match
          if (!grant.payload || !grant.payload.method) return true; // Broad grant
          if (grant.payload.method === method || grant.payload.method === '*') {
            // Check tool name match for tools/call
            if (method === 'tools/call' && grant.payload.params?.name) {
              return grant.payload.params.name === toolName ||
                     grant.payload.params.name === '*' ||
                     (grant.payload.params.name.endsWith('*') &&
                      toolName?.startsWith(grant.payload.params.name.slice(0, -1)));
            }
            return true;
          }
        }
        return false;
      });

      if (hasGrant) {
        // Auto-approve based on grant
        const fulfillmentMessage = {
          kind: 'mcp/request',
          correlation_id: [message.id],
          payload: {
            jsonrpc: '2.0',
            id: Date.now(),
            method: method,
            params: message.payload?.params
          }
        };

        if (message.to && message.to.length > 0) {
          fulfillmentMessage.to = message.to;
        }

        sendMessage(fulfillmentMessage);

        // Add a system message indicating auto-approval
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `Auto-approved ${method} from ${message.from} (capability granted)` }
        }, false);
      } else {
        // Show dialog for manual approval
        setPendingOperation({
          id: message.id,
          from: message.from,
          to: message.to,  // Capture the target participant(s)
          operation: message.payload,
          timestamp: new Date(),
          correlationId: message.correlation_id,
        });
      }
    }

    // Don't add stream/data messages to the message list - they're handled separately
    // and displayed in the Signal Board's stream monitor
    if (message.kind !== 'stream/data') {
      addMessage(message, false);
    }
  };

  const sendMessage = (message) => {
    if (ws.readyState !== 1) {
      console.error('WebSocket is not connected');
      return null;
    }

    const envelope = wrapEnvelope(message);

    // Debug log for capability/grant messages
    if (message.kind === 'capability/grant') {
      console.error('[DEBUG] Sending wrapped grant envelope:', JSON.stringify(envelope, null, 2));
    }

    ws.send(JSON.stringify(envelope));

    const participantsToRegister = new Set();
    if (envelope.from) {
      participantsToRegister.add(envelope.from);
    }
    if (Array.isArray(envelope.to)) {
      envelope.to.forEach(id => {
        if (id) {
          participantsToRegister.add(id);
        }
      });
    }
    if (participantsToRegister.size > 0) {
      registerParticipants(Array.from(participantsToRegister));
    }

    setMessages(prev => [...prev, {
      id: envelope.id,
      message: envelope,
      sent: true,
      timestamp: new Date(),
    }]);

    if (envelope.kind === 'chat') {
      const recipients = Array.isArray(envelope.to)
        ? envelope.to.filter(id => id && id !== participantId)
        : [];

      const timestamp = envelope.ts ? new Date(envelope.ts) : new Date();
      const entry = {
        id: envelope.id,
        text: envelope.payload?.text || '',
        timestamp,
        to: recipients,
        acked: [],
      };

      setMyPendingAcknowledgements(prev => [...prev.filter(item => item.id !== entry.id), entry]);
    }

    if (envelope.kind === 'chat/cancel') {
      const target = envelope.correlation_id?.[0];
      if (target) {
        setMyPendingAcknowledgements(prev => prev.filter(entry => entry.id !== target));
      }
    }

    return envelope;
  };

  const sendChat = (text) => {
    sendMessage({
      kind: 'chat',
      payload: { text },
    });
  };

  const addSystemMessage = (text, type = 'info') => {
    setMessages(prev => [...prev, {
      id: uuidv4(),
      message: { kind: `system/${type}`, payload: { text } },
      sent: false,
      timestamp: new Date(),
    }]);
  };

  const addHelpMessage = () => {
    const lines = ['Available Commands'];

    const generalCommands = slashCommandList.filter(entry => entry.category === 'General');
    generalCommands.forEach(entry => {
      const label = (entry.usage || entry.command).padEnd(48);
      lines.push(`${label}${entry.description}`);
    });

    const otherGroups = slashCommandGroups.filter(group => group !== 'General');
    otherGroups.forEach(group => {
      const commands = slashCommandList.filter(entry => entry.category === group);
      if (commands.length === 0) return;
      lines.push('');
      lines.push(group);
      commands.forEach(entry => {
        const label = (entry.usage || entry.command).padEnd(48);
        lines.push(`${label}${entry.description}`);
      });
    });

    setMessages(prev => [...prev, {
      id: uuidv4(),
      message: {
        kind: 'system/help',
        payload: { lines }
      },
      sent: false,
      timestamp: new Date()
    }]);
  };

  const pickAcknowledgementEntries = (args) => {
    if (pendingAcknowledgements.length === 0) {
      return { entries: [], rest: [] };
    }

    if (!args || args.length === 0) {
      return { entries: pendingAcknowledgements, rest: [] };
    }

    const [selector, ...rest] = args;
    if (!selector || selector === 'all') {
      return { entries: pendingAcknowledgements, rest };
    }

    const index = Number.parseInt(selector, 10);
    if (!Number.isNaN(index) && index > 0) {
      const entry = pendingAcknowledgements[index - 1];
      return { entries: entry ? [entry] : [], rest };
    }

    const matches = pendingAcknowledgements.filter(entry =>
      entry.id.startsWith(selector) ||
      (entry.from && entry.from.includes(selector))
    );

    return { entries: matches, rest };
  };

  const acknowledgeEntries = (entries, status = 'received') => {
    entries.forEach(entry => {
      const payload = status ? { status } : {};
      const ackEnvelope = {
        kind: 'chat/acknowledge',
        correlation_id: [entry.id],
        payload,
      };
      if (entry.from) {
        ackEnvelope.to = [entry.from];
      }
      sendMessage(ackEnvelope);
    });

    setPendingAcknowledgements(prev => prev.filter(item => !entries.some(entry => entry.id === item.id)));
  };

  const cancelEntries = (entries, reason = 'cleared') => {
    entries.forEach(entry => {
      const cancelEnvelope = {
        kind: 'chat/cancel',
        correlation_id: [entry.id],
        payload: reason ? { reason } : {},
      };
      if (entry.from) {
        cancelEnvelope.to = [entry.from];
      }
      sendMessage(cancelEnvelope);
    });

    setPendingAcknowledgements(prev => prev.filter(item => !entries.some(entry => entry.id === item.id)));
  };

  const processInput = (input) => {
    // Allow empty input to clear the input field
    // but don't send empty messages
    if (!input || !input.trim()) {
      // Just return without sending anything
      // The input component already cleared itself
      return;
    }

    // Handle commands
    if (input.startsWith('/')) {
      handleCommand(input);
      return;
    }

    // Try JSON
    try {
      const json = JSON.parse(input);
      if (isValidEnvelope(json)) {
        sendMessage(json);
      } else if (json.kind) {
        sendMessage(json);
      } else {
        sendChat(JSON.stringify(json));
      }
    } catch {
      // Plain text - send as chat
      sendChat(input);
    }
  };

  const slashContext = useMemo(() => {
    const participantSet = new Set(knownParticipants);
    if (participantId) {
      participantSet.add(participantId);
    }

    for (const [id] of participantStatuses.entries()) {
      if (id) {
        participantSet.add(id);
      }
    }

    for (const [id] of toolCatalog.entries()) {
      if (id) {
        participantSet.add(id);
      }
    }

    const participants = Array.from(participantSet)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const participantDetails = {};
    for (const [id, info] of participantStatuses.entries()) {
      if (!id) {
        continue;
      }
      participantDetails[id] = {
        summary: typeof info?.payload?.summary === 'string' ? info.payload.summary : null,
        status: typeof info?.payload?.status === 'string' ? info.payload.status : null,
        description: typeof info?.payload?.description === 'string' ? info.payload.description : null
      };
    }

    const toolsByParticipant = {};
    for (const [id, tools] of toolCatalog.entries()) {
      toolsByParticipant[id] = tools.map(tool => ({ ...tool }));
    }

    return {
      participants,
      participantDetails,
      toolsByParticipant
    };
  }, [knownParticipants, participantId, participantStatuses, toolCatalog]);

  const handleCommand = (command) => {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case '/help':
        addHelpMessage();
        break;
      case '/verbose':
        setVerbose(prev => !prev);
        addSystemMessage(`Verbose mode ${!verbose ? 'enabled' : 'disabled'}.`);
        break;
      case '/envelope': {
        if (args.length < 4) {
          addSystemMessage('Usage: /envelope mcp/request tool/call <participant> <tool> [jsonArguments]');
          break;
        }

        const [kind, method, target, toolName, ...restArgs] = args;

        if (kind !== 'mcp/request') {
          addSystemMessage(`Unsupported envelope kind: ${kind}. Only mcp/request is supported.`);
          break;
        }

        if (method !== 'tool/call') {
          addSystemMessage(`Unsupported MCP method: ${method}. Only tool/call is supported.`);
          break;
        }

        if (!target) {
          addSystemMessage('Specify a participant to target.');
          break;
        }

        if (!toolName) {
          addSystemMessage('Specify a tool name to call.');
          break;
        }

        let toolArguments;
        if (restArgs.length > 0) {
          const raw = restArgs.join(' ').trim();
          if (raw.length > 0) {
            try {
              toolArguments = JSON.parse(raw);
            } catch (err) {
              const reason = err && err.message ? err.message : 'Invalid JSON';
              addSystemMessage(`Invalid JSON for tool arguments: ${reason}`);
              break;
            }
          }
        }

        const params = { name: toolName };
        if (toolArguments !== undefined) {
          params.arguments = toolArguments;
        } else {
          params.arguments = {};
        }

        const envelope = {
          kind: 'mcp/request',
          to: [target],
          payload: {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params
          }
        };

        sendMessage(envelope);
        addSystemMessage(`Requested ${toolName} from ${target} via MCP tool call.`);
        break;
      }
      case '/streams':
        setShowStreams(prev => !prev);
        addSystemMessage(`Stream data display ${!showStreams ? 'enabled' : 'disabled'}.`);
        break;
      case '/ui-clear':
        setMessages([]);
        setPendingAcknowledgements([]);
        setMyPendingAcknowledgements([]);
        setParticipantStatuses(new Map());
        setActiveStreams(new Map());
        setStreamFrames([]);
        addSystemMessage('Cleared local UI state.');
        break;
      case '/exit':
        exit();
        break;
      case '/ack': {
        const { entries, rest } = pickAcknowledgementEntries(args);
        if (entries.length === 0) {
          addSystemMessage('No chat messages matched for acknowledgement.');
          break;
        }
        const status = rest.length > 0 ? rest.join(' ') : 'received';
        acknowledgeEntries(entries, status);
        addSystemMessage(`Acknowledged ${entries.length} chat message${entries.length === 1 ? '' : 's'}${status ? ` (${status})` : ''}.`);
        break;
      }
      case '/cancel': {
        // First check for active reasoning session
        if (activeReasoning) {
          const reason = args.length > 0 ? args.join(' ') : undefined;
          sendMessage({
            kind: 'reasoning/cancel',
            context: activeReasoning.id,
            payload: reason ? { reason } : {}
          });
          setActiveReasoning(null);
          addSystemMessage(`Sent reasoning cancel${reason ? ` (${reason})` : ''}.`);
          break;
        }

        // Otherwise handle chat acknowledgement cancellation
        const { entries, rest } = pickAcknowledgementEntries(args);
        if (entries.length === 0) {
          addSystemMessage('No chat messages matched for cancellation.');
          break;
        }
        const reason = rest.length > 0 ? rest.join(' ') : 'cleared';
        cancelEntries(entries, reason);
        addSystemMessage(`Cancelled ${entries.length} chat message${entries.length === 1 ? '' : 's'}${reason ? ` (${reason})` : ''}.`);
        break;
      }
      case '/status': {
        if (args.length === 0) {
          addSystemMessage('Usage: /status <participant> [field ...]');
          break;
        }
        const target = args[0];
        const fields = args.slice(1);
        sendMessage({
          kind: 'participant/request-status',
          to: [target],
          payload: fields.length > 0 ? { fields } : {}
        });
        addSystemMessage(`Requested status from ${target}${fields.length ? ` (${fields.join(', ')})` : ''}.`);
        break;
      }
      case '/pause': {
        if (args.length === 0) {
          addSystemMessage('Usage: /pause <participant> [timeoutSeconds] [reason]');
          break;
        }
        const target = args[0];
        let timeout;
        let reasonParts = [];
        if (args.length > 1) {
          const maybeTimeout = Number.parseInt(args[1], 10);
          if (!Number.isNaN(maybeTimeout)) {
            timeout = maybeTimeout;
            reasonParts = args.slice(2);
          } else {
            reasonParts = args.slice(1);
          }
        }
        const payload = {};
        if (timeout !== undefined) {
          payload.timeout_seconds = timeout;
        }
        if (reasonParts.length > 0) {
          payload.reason = reasonParts.join(' ');
        }
        sendMessage({
          kind: 'participant/pause',
          to: [target],
          payload
        });
        addSystemMessage(`Pause requested for ${target}${payload.reason ? ` (${payload.reason})` : ''}${timeout ? ` for ${timeout}s` : ''}.`);
        break;
      }
      case '/resume': {
        if (args.length === 0) {
          addSystemMessage('Usage: /resume <participant> [reason]');
          break;
        }
        const target = args[0];
        const reason = args.slice(1).join(' ');
        const payload = reason ? { reason } : {};
        sendMessage({
          kind: 'participant/resume',
          to: [target],
          payload
        });
        addSystemMessage(`Resume requested for ${target}${reason ? ` (${reason})` : ''}.`);
        break;
      }
      case '/forget': {
        if (args.length === 0) {
          addSystemMessage('Usage: /forget <participant> [oldest|newest] [entries]');
          break;
        }
        const target = args[0];
        let direction = 'oldest';
        let entriesCount;
        if (args.length > 1) {
          if (args[1] === 'oldest' || args[1] === 'newest') {
            direction = args[1];
            if (args.length > 2) {
              const maybeEntries = Number.parseInt(args[2], 10);
              if (!Number.isNaN(maybeEntries)) {
                entriesCount = maybeEntries;
              }
            }
          } else {
            const maybeEntries = Number.parseInt(args[1], 10);
            if (!Number.isNaN(maybeEntries)) {
              entriesCount = maybeEntries;
            }
          }
        }
        const payload = { direction };
        if (entriesCount !== undefined) {
          payload.entries = entriesCount;
        }
        sendMessage({
          kind: 'participant/forget',
          to: [target],
          payload
        });
        addSystemMessage(`Forget requested for ${target} (${direction}${entriesCount !== undefined ? `, ${entriesCount}` : ''}).`);
        break;
      }
      case '/compact': {
        if (args.length === 0) {
          addSystemMessage('Usage: /compact <participant> [targetTokens] [reason]');
          break;
        }
        const target = args[0];
        let targetTokens;
        let reasonParts = [];
        if (args.length > 1) {
          const maybeTokens = Number.parseInt(args[1], 10);
          if (!Number.isNaN(maybeTokens)) {
            targetTokens = maybeTokens;
            reasonParts = args.slice(2);
          } else {
            reasonParts = args.slice(1);
          }
        }
        const payload = {};
        if (typeof targetTokens === 'number') {
          payload.target_tokens = targetTokens;
        }
        if (reasonParts.length > 0) {
          payload.reason = reasonParts.join(' ');
        }
        sendMessage({
          kind: 'participant/compact',
          to: [target],
          payload
        });
        const detailParts = [];
        if (typeof targetTokens === 'number') {
          detailParts.push(`target ${targetTokens}`);
        }
        if (reasonParts.length > 0) {
          detailParts.push(`reason ${payload.reason}`);
        }
        addSystemMessage(`Compact requested for ${target}${detailParts.length ? ` (${detailParts.join(', ')})` : ''}.`);
        break;
      }
      case '/clear': {
        if (args.length === 0) {
          addSystemMessage('Usage: /clear <participant> [reason]');
          break;
        }
        const target = args[0];
        const reason = args.slice(1).join(' ');
        sendMessage({
          kind: 'participant/clear',
          to: [target],
          payload: reason ? { reason } : {}
        });
        addSystemMessage(`Clear requested for ${target}${reason ? ` (${reason})` : ''}.`);
        break;
      }
      case '/restart': {
        if (args.length === 0) {
          addSystemMessage('Usage: /restart <participant> [mode] [reason]');
          break;
        }
        const target = args[0];
        let mode;
        let reasonParts = [];
        if (args.length > 1) {
          mode = args[1];
          reasonParts = args.slice(2);
        }
        const payload = {};
        if (mode) {
          payload.mode = mode;
        }
        if (reasonParts.length > 0) {
          payload.reason = reasonParts.join(' ');
        }
        sendMessage({
          kind: 'participant/restart',
          to: [target],
          payload
        });
        addSystemMessage(`Restart requested for ${target}${mode ? ` (${mode})` : ''}${payload.reason ? ` - ${payload.reason}` : ''}.`);
        break;
      }
      case '/shutdown': {
        if (args.length === 0) {
          addSystemMessage('Usage: /shutdown <participant> [reason]');
          break;
        }
        const target = args[0];
        const reason = args.slice(1).join(' ');
        sendMessage({
          kind: 'participant/shutdown',
          to: [target],
          payload: reason ? { reason } : {}
        });
        addSystemMessage(`Shutdown requested for ${target}${reason ? ` (${reason})` : ''}.`);
        break;
      }
      case '/stream': {
        if (args.length === 0) {
          addSystemMessage('Usage: /stream request <participant> <direction> [description] [size=bytes] | /stream close <streamId> [reason]');
          break;
        }
        const subcommand = args[0];
        if (subcommand === 'request') {
          if (args.length < 3) {
            addSystemMessage('Usage: /stream request <participant> <direction> [description] [size=bytes]');
            break;
          }
          const target = args[1];
          const direction = args[2];
          const rest = args.slice(3);
          const payload = { direction };
          const descriptionParts = [];
          rest.forEach(part => {
            if (part.startsWith('size=')) {
              const maybeSize = Number.parseInt(part.slice(5), 10);
              if (!Number.isNaN(maybeSize)) {
                payload.expected_size_bytes = maybeSize;
              }
            } else if (part.startsWith('bytes=')) {
              const maybeSize = Number.parseInt(part.slice(6), 10);
              if (!Number.isNaN(maybeSize)) {
                payload.expected_size_bytes = maybeSize;
              }
            } else {
              descriptionParts.push(part);
            }
          });
          if (descriptionParts.length > 0) {
            payload.description = descriptionParts.join(' ');
          }
          sendMessage({
            kind: 'stream/request',
            to: [target],
            payload
          });
          addSystemMessage(`Stream request sent to ${target} (${direction}${payload.description ? ` - ${payload.description}` : ''}${payload.expected_size_bytes ? `, ~${payload.expected_size_bytes} bytes` : ''}).`);
        } else if (subcommand === 'close') {
          if (args.length < 2) {
            addSystemMessage('Usage: /stream close <streamId> [reason]');
            break;
          }
          const streamId = args[1];
          const reason = args.slice(2).join(' ');
          const streamMeta = activeStreams.get(streamId);
          const correlation = streamMeta?.openEnvelopeId || streamMeta?.correlationId || streamId;
          const payload = reason ? { reason, stream_id: streamId } : { stream_id: streamId };
          const envelope = {
            kind: 'stream/close',
            payload
          };
          if (correlation) {
            envelope.correlation_id = [correlation];
          }
          sendMessage(envelope);
          setActiveStreams(prev => {
            const next = new Map(prev);
            next.delete(streamId);
            return next;
          });
          addSystemMessage(`Requested stream close for ${streamId}${reason ? ` (${reason})` : ''}.`);
        } else {
          addSystemMessage(`Unknown /stream subcommand: ${subcommand}`);
        }
        break;
      }
      case '/streams': {
        if (activeStreams.size === 0) {
          addSystemMessage('No active streams.');
          break;
        }
        const summaries = Array.from(activeStreams.values()).map(meta => {
          const description = meta.description ? ` - ${meta.description}` : '';
          return `${meta.streamId || ''} (${meta.openedBy || 'unknown'}${description})`;
        });
        addSystemMessage(`Active streams: ${summaries.join('; ')}`);
        break;
      }
      case '/ui': {
        if (args.length === 0) {
          addSystemMessage('Usage: /ui board [open|close]');
          break;
        }
        const sub = args[0];
        if (sub !== 'board') {
          addSystemMessage(`Unknown /ui subcommand: ${sub}`);
          break;
        }
        let nextState;
        if (args[1] === 'open') {
          nextState = true;
          setSignalBoardOverride('open');
        } else if (args[1] === 'close') {
          nextState = false;
          setSignalBoardOverride('closed');
        } else if (args[1] === 'auto') {
          setSignalBoardOverride(null);
          const autoState = signalBoardHasActivity;
          setSignalBoardExpanded(autoState);
          addSystemMessage(`Signal Board set to auto (currently ${autoState ? 'expanded' : 'collapsed'}).`);
          break;
        } else {
          nextState = !signalBoardExpanded;
          setSignalBoardOverride(nextState ? 'open' : 'closed');
        }
        setSignalBoardExpanded(nextState);
        addSystemMessage(`Signal Board ${nextState ? 'expanded' : 'collapsed'}.`);
        break;
      }
      case '/ui-board': {
        const nextState = !signalBoardExpanded;
        setSignalBoardOverride(nextState ? 'open' : 'closed');
        setSignalBoardExpanded(nextState);
        addSystemMessage(`Signal Board ${nextState ? 'expanded' : 'collapsed'}.`);
        break;
      }
      default:
        addSystemMessage(`Unknown command: ${cmd}`);
    }
  };

  const wrapEnvelope = (message) => {
    return {
      protocol: 'mew/v0.4',
      id: `msg-${uuidv4()}`,
      ts: new Date().toISOString(),
      from: participantId,
      kind: message.kind,
      payload: message.payload,
      ...message,
    };
  };

  const isValidEnvelope = (obj) => {
    return obj && obj.protocol === 'mew/v0.4' && obj.id && obj.ts && obj.kind;
  };

  const isDockedLayout = layoutMode === 'docked';

  return React.createElement(Box, { flexDirection: "column", height: "100%" },
    React.createElement(Box, {
      flexDirection: isDockedLayout ? "row" : "column",
      flexGrow: 1,
      marginTop: 1
    },
      React.createElement(Box, {
        flexGrow: 1,
        flexDirection: "column",
        marginRight: signalBoardExpanded && isDockedLayout ? 1 : 0
      },
        showEmptyStateCard && React.createElement(EmptyStateCard, {
          spaceId,
          participantId
        }),
        React.createElement(Static, { items: messages }, (item) =>
          React.createElement(MessageDisplay, {
            key: item.id,
            item: item,
            verbose: verbose,
            useColor: useColor
          })
        )
      ),
      signalBoardExpanded && isDockedLayout && React.createElement(SidePanel, {
        participantId,
        myPendingAcknowledgements,
        participantStatuses,
        pauseState,
        activeStreams,
        streamFrames,
        variant: 'docked'
      })
    ),
    signalBoardExpanded && !isDockedLayout && React.createElement(Box, {
      flexDirection: "row",
      justifyContent: "flex-start",
      marginTop: 1
    },
      React.createElement(SidePanel, {
        participantId,
        myPendingAcknowledgements,
        participantStatuses,
        pauseState,
        activeStreams,
        streamFrames,
        variant: 'stacked'
      })
    ),

    // MCP Operation Confirmation
    pendingOperation && React.createElement(OperationConfirmation, {
      operation: pendingOperation,
      onApprove: () => {
        // Fulfill the proposal by sending the actual MCP request
        // According to MEW spec, approval is done by fulfillment with correlation_id
        if (pendingOperation.operation) {
          // Extract the method and params from the proposal payload
          const { method, params } = pendingOperation.operation;

          // Send the MCP request with correlation_id pointing to the proposal
          // IMPORTANT: Send to the participant specified in the proposal's 'to' field
          const message = {
            kind: 'mcp/request',
            correlation_id: [pendingOperation.id],
            payload: {
              jsonrpc: '2.0',
              id: Date.now(), // Generate a unique request ID
              method: method,
              params: params
            }
          };

          // If the proposal specified a target participant, send to them
          if (pendingOperation.to && pendingOperation.to.length > 0) {
            message.to = pendingOperation.to;
          }

          sendMessage(message);
        }
        setPendingOperation(null);
      },
      onGrant: () => {
        // Grant capability for this operation type
        const proposer = pendingOperation.from;
        const method = pendingOperation.operation?.method;
        const params = pendingOperation.operation?.params;
        const toolName = params?.name;

        // Create capability pattern for this specific operation
        const capabilityPattern = {
          kind: 'mcp/request',
          payload: {
            method: method
          }
        };

        // For tools/call, include the specific tool name pattern
        if (method === 'tools/call' && toolName) {
          capabilityPattern.payload.params = {
            name: toolName
          };
        }

        // Update local grant tracking
        setGrantedCapabilities(prev => {
          const existing = prev.get(proposer) || [];
          return new Map(prev).set(proposer, [...existing, capabilityPattern]);
        });

        // Send capability grant message
        const grantMessage = {
          kind: 'capability/grant',
          to: [proposer],
          payload: {
            recipient: proposer,
            capabilities: [capabilityPattern],
            reason: `Granted ${method}${toolName ? ` for tool '${toolName}'` : ''} for this session`
          }
        };

        // Debug: Log the grant message being sent
        console.error('[DEBUG] Sending capability grant:', JSON.stringify(grantMessage, null, 2));
        sendMessage(grantMessage);

        // Add a visible message to confirm grant was sent
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `Granted ${method}${toolName ? ` for tool '${toolName}'` : ''} to ${proposer} for this session` }
        }, true);

        // Also fulfill the current proposal
        if (pendingOperation.operation) {
          const { method, params } = pendingOperation.operation;
          const fulfillMessage = {
            kind: 'mcp/request',
            correlation_id: [pendingOperation.id],
            payload: {
              jsonrpc: '2.0',
              id: Date.now(),
              method: method,
              params: params
            }
          };

          if (pendingOperation.to && pendingOperation.to.length > 0) {
            fulfillMessage.to = pendingOperation.to;
          }

          sendMessage(fulfillMessage);
        }

        setPendingOperation(null);
      },
      onDeny: () => {
        // Send rejection according to MEW spec
        sendMessage({
          kind: 'mcp/reject',
          to: [pendingOperation.from], // Send rejection back to proposer
          correlation_id: [pendingOperation.id], // Must be an array
          payload: {
            reason: 'disagree'
          }
        });
        setPendingOperation(null);
      }
    }),
    // Reasoning Status
    activeReasoning && React.createElement(ReasoningStatus, {
      reasoning: activeReasoning
    }),
    
    // Enhanced Input Component
    React.createElement(EnhancedInput, {
      onSubmit: processInput,
      placeholder: 'Type a message or /help for commands...',
      multiline: true,  // Enable multi-line for Shift+Enter support
      disabled: pendingOperation !== null,
      history: commandHistory,
      onHistoryChange: setCommandHistory,
      prompt: '> ',
      showCursor: true,
      slashContext
    }),
    
    // Status Bar
    React.createElement(StatusBar, {
      connected: ws?.readyState === 1,
      messageCount: messages.length,
      verbose: verbose,
      pendingOperation: !!pendingOperation,
      spaceId: spaceId,
      participantId: participantId,
      awaitingAckCount: myPendingAcknowledgements.length,
      pauseState: pauseState,
      activeStreamCount: activeStreams.size,
      contextUsage: contextUsageEntries,
      participantStatusCount: participantStatuses.size
    })
  );
}

/**
 * Message Display Component
 */
function MessageDisplay({ item, verbose, useColor }) {
  const { message, sent, timestamp } = item;
  const time = timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const direction = sent ? '→' : '←';
  const participant = sent ? 'you' : message.from || 'system';
  const kind = message.kind || 'unknown';

  // Add context indicator
  const contextPrefix = message.context ? '  └─ ' : '';

  if (verbose) {
    return React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
      React.createElement(Text, { color: "gray" },
        `${contextPrefix}[${time}] ${direction} ${participant} ${kind}`
      ),
      React.createElement(Text, null, JSON.stringify(message, null, 2))
    );
  }

  let headerColor = useColor ? getColorForKind(kind) : 'white';

  return React.createElement(Box, { flexDirection: "column", marginBottom: kind === 'reasoning/thought' ? 2 : 1 },
    React.createElement(Text, { color: headerColor },
      `${contextPrefix}[${time}] ${direction} ${participant} ${kind}`
    ),
    message.payload && React.createElement(ReasoningDisplay, {
      payload: message.payload,
      kind: kind,
      contextPrefix: contextPrefix
    })
  );
}

/**
 * Reasoning Display Component - Shows payload with better formatting for reasoning
 */
function ReasoningDisplay({ payload, kind, contextPrefix }) {
  const preview = getPayloadPreview(payload, kind);

  // Special formatting for reasoning/thought messages
  if (kind === 'reasoning/thought' && payload.reasoning) {
    return React.createElement(Box, { flexDirection: "column" },
      React.createElement(Text, { color: "blue" }, `${contextPrefix}└─ reasoning/thought`),
      React.createElement(Text, {
        color: "blackBright",
        marginLeft: 6,
        marginTop: 1,
        wrap: "wrap"
      }, payload.reasoning),
      payload.action && React.createElement(Text, {
        color: "gray",
        marginLeft: 6,
        marginTop: 1
      }, `→ action: ${payload.action}`)
    );
  }

  if (kind === 'system/help' && Array.isArray(payload.lines)) {
    const sectionTitles = new Set(['Available Commands', 'Chat Queue', 'Participant Controls', 'Streams']);
    const basePrefix = contextPrefix || '';
    const firstLinePrefix = `${basePrefix}└─ `;
    const baseSpaces = basePrefix.replace(/[^\s]/g, ' ');
    const subsequentPrefix = `${baseSpaces}   `;
    return React.createElement(Box, { flexDirection: "column" },
      payload.lines.map((line, index) => {
        if (!line) {
          return React.createElement(Text, { key: index, color: "gray" }, ' ');
        }
        const color = sectionTitles.has(line) ? 'cyan' : 'gray';
        return React.createElement(Text, {
          key: index,
          color,
          wrap: "wrap"
        }, `${index === 0 ? firstLinePrefix : subsequentPrefix}${line}`);
      })
    );
  }

  // Special formatting for chat messages
  if (kind === 'chat') {
    return React.createElement(Text, {
      color: "white",
      wrap: "wrap"
    }, `${contextPrefix}└─ ${preview}`);
  }

  // Default single-line display for other message types
  return React.createElement(Text, {
    color: "blackBright"
  }, `${contextPrefix}└─ ${preview}`);
}

/**
 * Operation Confirmation Dialog - Simple Numbered List (Option 2 from ADR-009)
 *
 * Provides a minimal numbered list implementation for MCP operation approval.
 * Supports both number keys and arrow/enter navigation for better UX.
 * Phase 3: Includes capability grant option
 */
function OperationConfirmation({ operation, onApprove, onDeny, onGrant }) {
  // Focus management - ensure this component takes priority for input
  const { isFocused } = useFocus({ autoFocus: true });

  // Track selected option (0 = Yes once, 1 = Grant, 2 = No)
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    // Only handle input when focused
    if (!isFocused) return;

    // Number key shortcuts
    if (input === '1') {
      onApprove();
      return;
    }
    if (input === '2') {
      onGrant();
      return;
    }
    if (input === '3') {
      onDeny();
      return;
    }

    // Arrow key navigation
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(2, selectedIndex + 1));
      return;
    }

    // Enter key to confirm selection
    if (key.return) {
      if (selectedIndex === 0) {
        onApprove();
      } else if (selectedIndex === 1) {
        onGrant();
      } else {
        onDeny();
      }
      return;
    }

    // Escape to cancel
    if (key.escape) {
      onDeny();
      return;
    }
  });

  // Format the arguments for display
  const formatArguments = (args) => {
    if (!args) return 'none';
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return String(args);
    }
  };

  // Extract operation details
  const method = operation.operation?.method || 'unknown';
  const params = operation.operation?.params || {};
  const target = operation.to?.[0] || 'unknown';

  // For tools/call, extract the tool name
  const toolName = params.name || null;

  return React.createElement(Box, {
      borderStyle: "round",
      borderColor: "yellow",
      paddingX: 2,
      paddingY: 1,
      marginY: 1,
      width: 60
    },
    React.createElement(Box, { flexDirection: "column" },
      // Header
      React.createElement(Text, { bold: true },
        `${operation.from} wants to execute operation`
      ),
      React.createElement(Box, { marginTop: 1 }),

      // Operation details
      React.createElement(Text, null, `Method: ${method}`),
      toolName && React.createElement(Text, null, `Tool: ${toolName}`),
      React.createElement(Text, null, `Target: ${target}`),

      React.createElement(Box, { marginTop: 1 }),

      // Arguments section
      React.createElement(Text, null, "Arguments:"),
      React.createElement(Box, {
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        marginTop: 0,
        marginBottom: 1
      },
        React.createElement(Text, { color: "cyan" },
          formatArguments(params.arguments || params)
        )
      ),

      // Options
      React.createElement(Text, null, "Do you want to allow this?"),
      React.createElement(Text, { color: selectedIndex === 0 ? "green" : "white" },
        `${selectedIndex === 0 ? '❯' : ' '} 1. Yes (this time only)`
      ),
      React.createElement(Text, { color: selectedIndex === 1 ? "cyan" : "white" },
        `${selectedIndex === 1 ? '❯' : ' '} 2. Yes, allow ${operation.from} to ${method === 'tools/call' && toolName ? `use '${toolName}'` : method} for this session`
      ),
      React.createElement(Text, { color: selectedIndex === 2 ? "red" : "white" },
        `${selectedIndex === 2 ? '❯' : ' '} 3. No`
      ),
      React.createElement(Box, { marginTop: 1 }),
      React.createElement(Text, { color: "gray", fontSize: 12 },
        "Use ↑↓ arrows + Enter, or press 1/2/3, or Esc to cancel"
      )
    )
  );
}

/**
 * Reasoning Status Component
 */
function ReasoningStatus({ reasoning }) {
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  // Animate the thinking indicator with a rotating spinner
  useEffect(() => {
    const interval = setInterval(() => {
      setSpinnerIndex(prev => (prev + 1) % spinnerChars.length);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const elapsedTime = Math.floor((Date.now() - reasoning.startTime) / 1000);
  const tokenSummary = formatReasoningTokenSummary(reasoning.tokenMetrics);
  const tokenUpdatedAgo = reasoning.lastTokenUpdate ? formatRelativeTime(reasoning.lastTokenUpdate) : null;
  const displayText = reasoning.streamText && reasoning.streamText.trim().length > 0
    ? reasoning.streamText
    : reasoning.message;
  const textLimit = 400;
  const maxLines = 3; // Limit to 3 lines to prevent height changes
  let textPreview = null;
  if (displayText) {
    // First apply character limit
    let preview = displayText.length > textLimit
      ? `…${displayText.slice(displayText.length - textLimit)}`
      : displayText;
    // Then limit line count
    const lines = preview.split('\n');
    if (lines.length > maxLines) {
      preview = '…' + lines.slice(-maxLines).join('\n');
    }
    textPreview = preview;
  }

  return React.createElement(Box, {
    borderStyle: "round",
    borderColor: "cyan",
    paddingX: 1,
    marginBottom: 1,
    height: 8  // Fixed height to completely prevent jitter
  },
    React.createElement(Box, { flexDirection: "column", height: "100%" },
      React.createElement(Box, { width: "100%" },
        React.createElement(Text, { color: "cyan", bold: true }, spinnerChars[spinnerIndex] + " "),
        React.createElement(Text, { color: "cyan" }, `${reasoning.from} is thinking`),
        React.createElement(Text, { color: "gray", marginLeft: 4 }, `  ${elapsedTime}s  `),
        reasoning.tokenCount || reasoning.thoughtCount > 0 ? React.createElement(Text, { color: "gray", marginLeft: 3 },
          reasoning.tokenCount ? `${reasoning.tokenCount} tokens` : `${reasoning.thoughtCount} thoughts`
        ) : null
      ),
      React.createElement(Box, { height: 1 },  // Fixed height for action line
        React.createElement(Text, { color: "gray" }, reasoning.action || ' ')  // Use space instead of empty string
      ),
      React.createElement(Box, { marginTop: 0, height: maxLines },  // Fixed height for text preview - always rendered
        React.createElement(Text, { color: "gray", italic: true, wrap: "wrap" },
          textPreview || ' '  // Use space to avoid empty string error
        )
      ),
      tokenSummary?.summary ? React.createElement(Box, { marginTop: 0 },
        React.createElement(Text, { color: "cyan" }, `Tokens: ${tokenSummary.summary}`)
      ) : null,
      tokenSummary?.deltas ? React.createElement(Box, { marginTop: 0 },
        React.createElement(Text, { color: "cyan" }, `Δ ${tokenSummary.deltas}`)
      ) : null,
      tokenSummary?.details ? React.createElement(Box, { marginTop: 0 },
        React.createElement(Text, { color: "gray" }, tokenSummary.details)
      ) : null,
      tokenSummary && tokenUpdatedAgo ? React.createElement(Box, { marginTop: 0 },
        React.createElement(Text, { color: "gray" }, `Updated ${tokenUpdatedAgo}`)
      ) : null,
      React.createElement(Box, { marginTop: 0, flexGrow: 1 }),  // Spacer to push cancel hint to bottom
      React.createElement(Box, null,
        React.createElement(Text, { color: "gray" }, 'Use /cancel to interrupt reasoning.')
      )
    )
  );
}

/**
 * Input Composer Component
 */
// InputComposer replaced by EnhancedInput component

/**
 * Status Bar Component
 */
function StatusBar({ connected, messageCount, verbose, pendingOperation, spaceId, participantId, awaitingAckCount = 0, pauseState, activeStreamCount = 0, contextUsage = [], participantStatusCount = 0 }) {
  const status = connected ? 'Connected' : 'Disconnected';
  const statusColor = connected ? 'green' : 'red';

  const extras = [];
  extras.push(`${messageCount} msgs`);
  if (awaitingAckCount > 0) {
    extras.push(`${awaitingAckCount} awaiting`);
  }
  if (activeStreamCount > 0) {
    extras.push(`${activeStreamCount} stream${activeStreamCount === 1 ? '' : 's'}`);
  }
  if (pendingOperation) {
    extras.push('pending op');
  }
  if (verbose) {
    extras.push('verbose');
  }
  if (pauseState) {
    const reason = pauseState.reason ? `: ${pauseState.reason}` : '';
    const remaining = pauseState.until ? ` (${formatTimeRemaining(pauseState.until)})` : '';
    extras.push(`paused${reason}${remaining}`);
  }
  if (contextUsage.length > 0) {
    const ctxSegments = contextUsage.slice(0, 3).map(formatContextUsageForBar).filter(Boolean);
    if (ctxSegments.length > 0) {
      extras.push(`ctx ${ctxSegments.join(', ')}`);
    }
  }

  const boardSummary = createSignalBoardSummary(awaitingAckCount, participantStatusCount, pauseState, awaitingAckCount === 0);
  if (boardSummary) {
    extras.push(boardSummary);
  }

  const extrasText = extras.length > 0 ? ` | ${extras.join(' | ')}` : '';

  return React.createElement(Box, { justifyContent: "space-between", paddingX: 1 },
    React.createElement(Text, null,
      "🐱 | ",
      React.createElement(Text, { color: statusColor }, status),
      " | ",
      React.createElement(Text, { color: "cyan" }, spaceId),
      " | ",
      React.createElement(Text, { color: "blue" }, participantId),
      extrasText
    ),
    React.createElement(Text, { color: "gray" }, "Ctrl+C to exit")
  );
}

// Helper functions
function getColorForKind(kind) {
  if (kind.startsWith('system/error')) return 'red';
  if (kind.startsWith('system/')) return 'blackBright';
  if (kind.startsWith('mcp/')) return 'blackBright';
  if (kind.startsWith('reasoning/')) return 'blue';  // Reasoning headers in blue
  if (kind === 'chat') return 'white';  // Clean white for chat messages
  return 'blackBright';
}

function getPayloadPreview(payload, kind) {
  if (kind === 'system/help') {
    return 'help overview';
  }

  if (kind === 'chat' && payload.text) {
    return `"${payload.text}"`;
  }

  if (kind === 'mcp/request' && payload.method) {
    let preview = `method: "${payload.method}"`;
    if (payload.params?.name) {
      preview += `, name: "${payload.params.name}"`;
    }
    return preview;
  }

  if (kind === 'mcp/response') {
    if (payload.result) {
      if (payload.result.content && Array.isArray(payload.result.content)) {
        // Show first content item if it's text
        const firstContent = payload.result.content[0];
        if (firstContent?.type === 'text') {
          const text = firstContent.text;
          return `result: "${text.length > 1000 ? text.substring(0, 1000) + '...' : text}"`;
        }
        return `result: ${payload.result.content.length} content items`;
      }
      if (typeof payload.result === 'object') {
        const keys = Object.keys(payload.result);
        return `result: {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
      }
      // For string results (like file operations), show more of the path
      const resultStr = String(payload.result);
      return `result: ${resultStr.length > 200 ? '...' + resultStr.substring(resultStr.length - 200) : resultStr}`;
    }
    if (payload.error) {
      return `error: ${payload.error.message || payload.error}`;
    }
    return 'response';
  }

  if (kind === 'mcp/proposal' && payload.method) {
    let preview = `proposing: "${payload.method}"`;
    if (payload.params?.name) {
      preview += `, name: "${payload.params.name}"`;
    }
    return preview;
  }

  if (kind === 'reasoning/thought') {
    // Try to show both reasoning and action if available
    let parts = [];
    if (payload.reasoning && payload.reasoning !== payload.action) {
      parts.push(`reasoning: "${payload.reasoning}"`);
    }
    if (payload.action) {
      parts.push(`action: "${payload.action}"`);
    }
    if (payload.actionInput && typeof payload.actionInput === 'object') {
      const input = JSON.stringify(payload.actionInput);
      parts.push(`input: ${input.length > 80 ? input.substring(0, 80) + '...' : input}`);
    }
    if (payload.message) {
      parts.push(`"${payload.message}"`);
    }

    let combined = parts.join(' | ');
    return combined.length > 1000 ? combined.substring(0, 1000) + '...' : combined;
  }

  if (kind === 'reasoning/start') {
    if (payload.message) {
      const message = payload.message;
      return `🧠 Starting: "${message.length > 120 ? message.substring(0, 120) + '...' : message}"`;
    }
    return '🧠 Started reasoning session';
  }

  if (kind === 'reasoning/conclusion') {
    if (payload.message) {
      const message = payload.message;
      return `✅ Concluded: "${message.length > 120 ? message.substring(0, 120) + '...' : message}"`;
    }
    return '✅ Reasoning session complete';
  }

  if (typeof payload === 'string') {
    return `"${payload}"`;
  }
  if (Array.isArray(payload)) {
    return `[${payload.length} items]`;
  }
  if (typeof payload === 'object') {
    const keys = Object.keys(payload);
    return `{${keys.slice(0, 2).join(', ')}${keys.length > 2 ? '...' : ''}}`;
  }
  return String(payload);
}

function truncateText(text, maxLength = 40) {
  if (!text) return '(no text)';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function formatRelativeTime(date) {
  if (!date) return 'unknown';
  const value = date instanceof Date ? date.getTime() : date;
  const diff = Date.now() - value;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function formatTimeRemaining(timestamp) {
  const now = Date.now();
  const remaining = timestamp - now;
  if (remaining <= 0) return 'expired';
  if (remaining < 60000) {
    return `${Math.ceil(remaining / 1000)}s remaining`;
  }
  if (remaining < 3600000) {
    return `${Math.ceil(remaining / 60000)}m remaining`;
  }
  return `${Math.ceil(remaining / 3600000)}h remaining`;
}

function formatStatusPayload(payload) {
  if (!payload) return 'unknown';
  const parts = [];
  if (typeof payload.tokens === 'number') {
    if (typeof payload.max_tokens === 'number') {
      parts.push(`tokens ${payload.tokens}/${payload.max_tokens}`);
    } else {
      parts.push(`tokens ${payload.tokens}`);
    }
  }
  if (typeof payload.messages_in_context === 'number') {
    parts.push(`${payload.messages_in_context} msgs`);
  }
  if (typeof payload.latency_ms === 'number') {
    parts.push(`${payload.latency_ms}ms`);
  }
  if (payload.status) {
    parts.push(payload.status);
  }
  return parts.length > 0 ? parts.join(' | ') : 'status received';
}

function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value);
  }
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function normalizeTokenKey(rawKey) {
  if (!rawKey) return '';
  const segments = rawKey
    .split(/[.\-_]/)
    .filter(segment => segment && !/^\d+$/.test(segment) &&
      !/^(delta|deltas|increment|increments|inc)$/i.test(segment));
  return segments.join('_');
}

function extractReasoningTokenMetrics(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const absolute = new Map();
  const deltas = new Map();

  const visit = (value, pathSegments) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === 'number') {
      const key = pathSegments.join('_');
      const lowerKey = key.toLowerCase();
      if (!lowerKey.includes('token')) {
        return;
      }

      const normalized = normalizeTokenKey(key);
      if (!normalized) {
        return;
      }

      const hasDeltaSegment = pathSegments.some(segment => segment && segment.toLowerCase().includes('delta')) ||
        lowerKey.includes('delta') || lowerKey.includes('increment') || lowerKey.includes('inc');

      if (hasDeltaSegment) {
        deltas.set(normalized, (deltas.get(normalized) || 0) + value);
      } else {
        absolute.set(normalized, value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'number') {
          // Skip bare numeric arrays without context
          return;
        }
        if (typeof item === 'object' && item !== null) {
          visit(item, pathSegments.concat(String(index)));
        }
      });
      return;
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        visit(child, pathSegments.concat(key));
      });
    }
  };

  visit(payload, []);

  if (absolute.size === 0 && deltas.size === 0) {
    return null;
  }

  return {
    absolute,
    deltas
  };
}

function mergeReasoningTokenMetrics(existingMetrics, update) {
  if (!existingMetrics && !update) {
    return { metrics: null, changed: false };
  }

  if (!existingMetrics) {
    if (!update) {
      return { metrics: null, changed: false };
    }
    return {
      metrics: {
        absolute: new Map(update.absolute || []),
        deltaTotals: new Map(update.deltas || []),
        lastDeltas: new Map(update.deltas || [])
      },
      changed: true
    };
  }

  if (!update) {
    return { metrics: existingMetrics, changed: false };
  }

  const absolute = new Map(existingMetrics.absolute || []);
  const deltaTotals = new Map(existingMetrics.deltaTotals || []);
  const lastDeltas = new Map(existingMetrics.lastDeltas || []);
  let changed = false;

  update.absolute?.forEach((value, key) => {
    if (absolute.get(key) !== value) {
      absolute.set(key, value);
      changed = true;
    }
  });

  update.deltas?.forEach((value, key) => {
    const nextTotal = (deltaTotals.get(key) || 0) + value;
    deltaTotals.set(key, nextTotal);
    lastDeltas.set(key, value);
    if (value !== 0) {
      changed = true;
    }
  });

  return {
    metrics: {
      absolute,
      deltaTotals,
      lastDeltas
    },
    changed
  };
}

function findTokenEntry(entries, substrings) {
  if (!entries || entries.length === 0) {
    return null;
  }
  const lowered = substrings.map(sub => sub.toLowerCase());
  for (const [key, value] of entries) {
    const lowerKey = key.toLowerCase();
    if (lowered.every(sub => lowerKey.includes(sub))) {
      return { key, value };
    }
  }
  return null;
}

function formatTokenLabel(key) {
  if (!key) {
    return '';
  }
  return key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function formatReasoningTokenSummary(tokenMetrics) {
  if (!tokenMetrics) {
    return null;
  }

  const absoluteEntries = tokenMetrics.absolute ? Array.from(tokenMetrics.absolute.entries()) : [];
  const deltaTotalEntries = tokenMetrics.deltaTotals ? Array.from(tokenMetrics.deltaTotals.entries()) : [];
  const lastDeltaEntries = tokenMetrics.lastDeltas ? Array.from(tokenMetrics.lastDeltas.entries()) : [];

  if (absoluteEntries.length === 0 && deltaTotalEntries.length === 0 && lastDeltaEntries.length === 0) {
    return null;
  }

  const usedAbsoluteKeys = new Set();
  const summaryParts = [];

  let totalEntry = findTokenEntry(absoluteEntries, ['total', 'token']) || findTokenEntry(absoluteEntries, ['tokens']);
  let totalSource = 'absolute';
  if (!totalEntry) {
    totalEntry = findTokenEntry(deltaTotalEntries, ['total', 'token']) || findTokenEntry(deltaTotalEntries, ['tokens']);
    totalSource = 'delta';
  }
  if (totalEntry) {
    summaryParts.push(`total ${formatNumber(totalEntry.value)}`);
    if (totalSource === 'absolute') {
      usedAbsoluteKeys.add(totalEntry.key);
    }
  }

  const promptEntry = findTokenEntry(absoluteEntries, ['prompt', 'token']) || findTokenEntry(absoluteEntries, ['input', 'token']);
  if (promptEntry) {
    summaryParts.push(`prompt ${formatNumber(promptEntry.value)}`);
    usedAbsoluteKeys.add(promptEntry.key);
  }

  const completionEntry = findTokenEntry(absoluteEntries, ['completion', 'token']) || findTokenEntry(absoluteEntries, ['output', 'token']);
  if (completionEntry) {
    summaryParts.push(`completion ${formatNumber(completionEntry.value)}`);
    usedAbsoluteKeys.add(completionEntry.key);
  }

  let reasoningEntry = findTokenEntry(absoluteEntries, ['reasoning', 'token']);
  let reasoningSource = 'absolute';
  if (!reasoningEntry) {
    reasoningEntry = findTokenEntry(deltaTotalEntries, ['reasoning', 'token']) || findTokenEntry(deltaTotalEntries, ['reasoning']);
    reasoningSource = 'delta';
  }
  if (reasoningEntry) {
    summaryParts.push(`reasoning ${formatNumber(reasoningEntry.value)}`);
    if (reasoningSource === 'absolute') {
      usedAbsoluteKeys.add(reasoningEntry.key);
    }
  }

  let streamEntry = findTokenEntry(deltaTotalEntries, ['stream']) || findTokenEntry(absoluteEntries, ['stream', 'token']);
  if (!streamEntry) {
    streamEntry = findTokenEntry(deltaTotalEntries, ['reasoning']);
  }
  if (streamEntry) {
    summaryParts.push(`stream ${formatNumber(streamEntry.value)}`);
    if (absoluteEntries.some(([key]) => key === streamEntry.key)) {
      usedAbsoluteKeys.add(streamEntry.key);
    }
  }

  if (summaryParts.length === 0 && absoluteEntries.length > 0) {
    absoluteEntries.slice(0, 3).forEach(([key, value]) => {
      summaryParts.push(`${formatTokenLabel(key)} ${formatNumber(value)}`);
      usedAbsoluteKeys.add(key);
    });
  }

  const deltaParts = [];
  const reasoningDelta = findTokenEntry(lastDeltaEntries, ['reasoning']);
  if (reasoningDelta && reasoningDelta.value !== 0) {
    deltaParts.push(`reasoning +${formatNumber(reasoningDelta.value)}`);
  }
  const streamDelta = findTokenEntry(lastDeltaEntries, ['stream']);
  if (streamDelta && streamDelta.value !== 0 && (!reasoningDelta || streamDelta.key !== reasoningDelta.key || streamDelta.value !== reasoningDelta.value)) {
    deltaParts.push(`stream +${formatNumber(streamDelta.value)}`);
  }
  const totalDelta = findTokenEntry(lastDeltaEntries, ['total', 'token']) || findTokenEntry(lastDeltaEntries, ['tokens']);
  if (totalDelta && totalDelta.value !== 0 && (!reasoningDelta || totalDelta.key !== reasoningDelta.key || totalDelta.value !== reasoningDelta.value) && (!streamDelta || totalDelta.key !== streamDelta.key || totalDelta.value !== streamDelta.value)) {
    deltaParts.push(`total +${formatNumber(totalDelta.value)}`);
  }

  const detailEntries = absoluteEntries.filter(([key]) => !usedAbsoluteKeys.has(key));
  const detailParts = detailEntries.slice(0, 3).map(([key, value]) => `${formatTokenLabel(key)} ${formatNumber(value)}`);

  const summary = summaryParts.length > 0 ? summaryParts.join(' | ') : null;
  const deltas = deltaParts.length > 0 ? deltaParts.join(' | ') : null;
  const details = detailParts.length > 0 ? `Details: ${detailParts.join(' | ')}` : null;

  if (!summary && !deltas && !details) {
    return null;
  }

  return { summary, deltas, details };
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function buildContextUsageEntries(participantStatuses) {
  if (!participantStatuses || participantStatuses.size === 0) {
    return [];
  }

  const entries = [];
  for (const [id, info] of participantStatuses.entries()) {
    const payload = info?.payload || {};
    const tokens = typeof payload.tokens === 'number' ? payload.tokens : null;
    const maxTokens = typeof payload.max_tokens === 'number' ? payload.max_tokens : null;
    const contextTokens = typeof payload.context_tokens === 'number' ? payload.context_tokens : null;
    const maxContextTokens = typeof payload.max_context_tokens === 'number' ? payload.max_context_tokens : null;
    const messages = typeof payload.messages_in_context === 'number' ? payload.messages_in_context : null;
    const maxMessages = typeof payload.max_messages_in_context === 'number' ? payload.max_messages_in_context : null;

    let percent = null;
    if (tokens !== null && maxTokens) {
      const maybe = clampPercent((tokens / maxTokens) * 100);
      percent = maybe === null ? null : maybe;
    } else if (contextTokens !== null && maxContextTokens) {
      const maybe = clampPercent((contextTokens / maxContextTokens) * 100);
      percent = maybe === null ? null : maybe;
    } else if (messages !== null && maxMessages) {
      const maybe = clampPercent((messages / maxMessages) * 100);
      percent = maybe === null ? null : maybe;
    }

    const timestamp = info?.timestamp instanceof Date ? info.timestamp.getTime() : Date.now();

    entries.push({
      id,
      percent,
      tokens,
      maxTokens,
      contextTokens,
      maxContextTokens,
      messages,
      maxMessages,
      timestamp
    });
  }

  entries.sort((a, b) => b.timestamp - a.timestamp);
  return entries;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const normalized = clampPercent(value);
  if (normalized === null) {
    return null;
  }
  if (normalized >= 99.5) {
    return '100%';
  }
  if (normalized >= 10) {
    return `${Math.round(normalized)}%`;
  }
  return `${normalized.toFixed(1)}%`;
}

function formatContextUsageForBar(entry) {
  if (!entry) {
    return null;
  }

  const pieces = [];
  const percentText = formatPercent(entry.percent);
  if (percentText) {
    pieces.push(percentText);
  }

  if (entry.tokens !== null && entry.tokens !== undefined) {
    if (entry.maxTokens) {
      pieces.push(`${formatNumber(entry.tokens)}/${formatNumber(entry.maxTokens)} tok`);
    } else {
      pieces.push(`${formatNumber(entry.tokens)} tok`);
    }
  } else if (entry.contextTokens !== null && entry.contextTokens !== undefined) {
    if (entry.maxContextTokens) {
      pieces.push(`${formatNumber(entry.contextTokens)}/${formatNumber(entry.maxContextTokens)} ctx`);
    } else {
      pieces.push(`${formatNumber(entry.contextTokens)} ctx`);
    }
  } else if (entry.messages !== null && entry.messages !== undefined) {
    pieces.push(`${formatNumber(entry.messages)} msgs`);
  }

  if (pieces.length === 0) {
    return null;
  }

  return `${entry.id} ${pieces.join(' ')}`.trim();
}

function formatAckRecipients(recipients, participantId) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return 'broadcast';
  }

  if (recipients.length === 1) {
    return recipients[0] === participantId ? 'you' : recipients[0];
  }

  return recipients
    .map(recipient => (recipient === participantId ? 'you' : recipient))
    .join(', ');
}

function EmptyStateCard({ spaceId, participantId }) {
  return React.createElement(Box, {
      borderStyle: "round",
      borderColor: "gray",
      paddingX: 2,
      paddingY: 1,
      marginBottom: 1,
      flexDirection: "column"
    },
    React.createElement(Text, { color: "gray" }, `Connected to ${spaceId} as ${participantId}.`),
    React.createElement(Text, { color: "gray" }, "Type a message or use /help to get started."),
    React.createElement(Text, { color: "gray" }, "Signal Board docks once there is activity.")
  );
}

function SidePanel({ participantId, myPendingAcknowledgements, participantStatuses, pauseState, activeStreams, streamFrames, variant = 'docked' }) {
  const ackEntries = myPendingAcknowledgements
    .slice()
    .sort((a, b) => {
      const at = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
      const bt = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
      return at - bt;
    })
    .slice(0, 5);
  const statusEntries = Array.from(participantStatuses.entries())
    .sort(([, a], [, b]) => {
      const at = a.timestamp ? a.timestamp.getTime() : 0;
      const bt = b.timestamp ? b.timestamp.getTime() : 0;
      return bt - at;
    })
    .slice(0, 5);
  const streamEntries = Array.from(activeStreams.values());
  const latestFrames = streamFrames.slice(-3);

  const panelProps = {
    flexDirection: "column",
    borderStyle: "round",
    borderColor: "gray",
    paddingX: 1,
    paddingY: 0,
    width: variant === 'docked' ? 42 : undefined
  };

  if (variant === 'stacked') {
    panelProps.alignSelf = 'flex-start';
  }

  return React.createElement(Box, panelProps,
    React.createElement(Text, { color: "cyan", bold: true }, "Signal Board"),

    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { color: "yellow", bold: true }, `Awaiting Their Acks (${myPendingAcknowledgements.length})`),
    ackEntries.length > 0
      ? ackEntries.map((entry, index) => {
          const recipients = formatAckRecipients(entry.to, participantId);
          return React.createElement(Text, { key: entry.id, color: "yellow" },
            `${index + 1}. you → ${recipients} – ${truncateText(entry.text, 28)} (${formatRelativeTime(entry.timestamp)})`
          );
        })
      : React.createElement(Text, { color: "gray" }, 'All acknowledged'),

    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { color: "green", bold: true }, `Participant Status (${participantStatuses.size})`),
    statusEntries.length > 0
      ? statusEntries.map(([id, info]) => React.createElement(Text, { key: id, color: "green" },
          `${id}: ${truncateText(formatStatusPayload(info.payload), 34)} (${formatRelativeTime(info.timestamp)})`
        ))
      : React.createElement(Text, { color: "gray" }, 'No status reported'),

    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { color: "magenta", bold: true }, 'Pause State'),
    pauseState
      ? React.createElement(Text, { color: "magenta" },
          `Paused by ${pauseState.from || 'unknown'}${pauseState.reason ? `: ${pauseState.reason}` : ''}${pauseState.until ? ` (${formatTimeRemaining(pauseState.until)})` : ''}`
        )
      : React.createElement(Text, { color: "gray" }, 'Active'),

    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { color: "blue", bold: true }, `Streams (${activeStreams.size})`),
    streamEntries.length > 0
      ? streamEntries.slice(0, 4).map(entry => React.createElement(Text, { key: entry.streamId, color: "blue" },
          `${entry.streamId}: ${entry.openedBy || 'unknown'}${entry.description ? ` – ${truncateText(entry.description, 24)}` : ''}`
        ))
      : React.createElement(Text, { color: "gray" }, 'No active streams'),

    latestFrames.length > 0 && React.createElement(Box, { marginTop: 1, flexDirection: "column" },
      React.createElement(Text, { color: "blue", bold: true }, 'Last Frames'),
      latestFrames.map((frame, index) => React.createElement(Text, { key: `${frame.streamId}-${index}`, color: "blue" },
        `${frame.streamId}: ${truncateText(frame.payload, 30)}`
      ))
    )
    ,
    React.createElement(Box, { marginTop: 1 }),
    React.createElement(Text, { color: "gray" }, 'Use /ui board close or /ui board auto')
  );
}

// Risk assessment functions - kept for potential future use with more advanced approval dialogs
// function assessRisk(operation) {
//   const method = operation.method?.toLowerCase() || '';
//
//   if (method.includes('read') || method.includes('list') || method.includes('browse')) {
//     return 'SAFE';
//   }
//   if (method.includes('write') || method.includes('create') || method.includes('delete')) {
//     return 'CAUTION';
//   }
//   if (method.includes('execute') || method.includes('run') || method.includes('eval')) {
//     return 'DANGEROUS';
//   }
//
//   return 'CAUTION';
// }
//
// function getRiskColor(riskLevel) {
//   switch (riskLevel) {
//     case 'SAFE': return 'green';
//     case 'CAUTION': return 'yellow';
//     case 'DANGEROUS': return 'red';
//     default: return 'yellow';
//   }
// }

/**
 * Starts the advanced interactive UI
 */
function startAdvancedInteractiveUI(ws, participantId, spaceId) {
  const { rerender, unmount } = render(
    React.createElement(AdvancedInteractiveUI, { ws, participantId, spaceId })
  );

  // Handle cleanup
  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });

  return { rerender, unmount };
}

export { startAdvancedInteractiveUI, AdvancedInteractiveUI };
