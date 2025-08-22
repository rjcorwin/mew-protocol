import { createSlice } from '@reduxjs/toolkit';

interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
}

interface LogsState {
  entries: LogEntry[];
  filters: {
    level: string | null;
    component: string | null;
  };
  following: boolean;
}

const initialState: LogsState = {
  entries: [],
  filters: {
    level: null,
    component: null,
  },
  following: true,
};

const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {
    addLogEntry: (state, action) => {
      state.entries.push(action.payload);
      // Keep only last 1000 entries
      if (state.entries.length > 1000) {
        state.entries = state.entries.slice(-1000);
      }
    },
    clearLogs: (state) => {
      state.entries = [];
    },
    setFilter: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    toggleFollowing: (state) => {
      state.following = !state.following;
    },
  },
});

export const { addLogEntry, clearLogs, setFilter, toggleFollowing } = logsSlice.actions;
export default logsSlice.reducer;