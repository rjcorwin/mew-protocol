import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

interface ComponentStatus {
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  url?: string;
  pid?: number;
}

interface SystemState {
  status: 'idle' | 'loading' | 'running' | 'stopped' | 'error';
  components: ComponentStatus[];
  error: string | null;
}

const initialState: SystemState = {
  status: 'idle',
  components: [],
  error: null,
};

export const fetchSystemStatus = createAsyncThunk(
  'system/fetchStatus',
  async () => {
    const result = await window.electronAPI.system.status();
    return result;
  }
);

export const startSystem = createAsyncThunk(
  'system/start',
  async () => {
    const result = await window.electronAPI.system.start();
    return result;
  }
);

export const stopSystem = createAsyncThunk(
  'system/stop',
  async () => {
    const result = await window.electronAPI.system.stop();
    return result;
  }
);

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemStatus.pending, (state) => {
        // Don't set loading state for periodic updates
        if (state.status === 'idle') {
          state.status = 'loading';
        }
      })
      .addCase(fetchSystemStatus.fulfilled, (state, action) => {
        // Handle the response from backend
        const data = action.payload;
        const components = [];
        
        // Add server component
        if (data.server) {
          components.push({
            name: 'Server',
            type: 'server',
            status: (data.server.running ? 'running' : 'stopped') as 'running' | 'stopped',
            pid: data.server.pid
          });
        }
        
        // Add frontend component  
        if (data.frontend) {
          components.push({
            name: 'Frontend',
            type: 'frontend',
            status: (data.frontend.running ? 'running' : 'stopped') as 'running' | 'stopped',
            pid: data.frontend.pid
          });
        }
        
        // Add agents
        if (data.agents && Array.isArray(data.agents)) {
          data.agents.forEach((agent: any) => {
            components.push({
              name: agent.name,
              type: 'agent',
              status: (agent.running ? 'running' : 'stopped') as 'running' | 'stopped',
              pid: agent.pid
            });
          });
        }
        
        state.components = components as ComponentStatus[];
        state.status = components.some(c => c.status === 'running') ? 'running' : 'stopped';
        state.error = null;
      })
      .addCase(fetchSystemStatus.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message || 'Failed to fetch system status';
      })
      .addCase(startSystem.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(startSystem.fulfilled, (state) => {
        state.status = 'running';
      })
      .addCase(startSystem.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message || 'Failed to start system';
      })
      .addCase(stopSystem.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(stopSystem.fulfilled, (state) => {
        state.status = 'stopped';
        state.components = [];
      })
      .addCase(stopSystem.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message || 'Failed to stop system';
      });
  },
});

export const { clearError } = systemSlice.actions;
export default systemSlice.reducer;