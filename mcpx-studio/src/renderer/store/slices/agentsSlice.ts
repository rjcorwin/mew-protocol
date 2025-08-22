import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface Agent {
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  enabled: boolean;
  topic?: string;
  createdAt?: string;
}

interface AgentsState {
  list: Agent[];
  selected: string | null;
  loading: boolean;
  creating: boolean;
  error: string | null;
}

const initialState: AgentsState = {
  list: [],
  selected: null,
  loading: false,
  creating: false,
  error: null,
};

export const fetchAgents = createAsyncThunk(
  'agents/fetch',
  async () => {
    const agents = await window.electronAPI.agent.list();
    return agents;
  }
);

export const createAgent = createAsyncThunk(
  'agents/create',
  async ({ name, template, options }: { name: string; template: string; options?: any }) => {
    const result = await window.electronAPI.agent.create(name, template, options);
    return result;
  }
);

export const startAgent = createAsyncThunk(
  'agents/start',
  async (name: string) => {
    const result = await window.electronAPI.agent.start(name);
    return { name, result };
  }
);

export const stopAgent = createAsyncThunk(
  'agents/stop',
  async (name: string) => {
    const result = await window.electronAPI.agent.stop(name);
    return { name, result };
  }
);

const agentsSlice = createSlice({
  name: 'agents',
  initialState,
  reducers: {
    selectAgent: (state, action) => {
      state.selected = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAgents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAgents.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchAgents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch agents';
      })
      .addCase(createAgent.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createAgent.fulfilled, (state) => {
        state.creating = false;
      })
      .addCase(createAgent.rejected, (state, action) => {
        state.creating = false;
        state.error = action.error.message || 'Failed to create agent';
      })
      .addCase(startAgent.fulfilled, (state, action) => {
        const agent = state.list.find(a => a.name === action.payload.name);
        if (agent) {
          agent.status = 'running';
        }
      })
      .addCase(stopAgent.fulfilled, (state, action) => {
        const agent = state.list.find(a => a.name === action.payload.name);
        if (agent) {
          agent.status = 'stopped';
        }
      });
  },
});

export const { selectAgent, clearError } = agentsSlice.actions;
export default agentsSlice.reducer;