import { configureStore } from '@reduxjs/toolkit';
import systemReducer from './slices/systemSlice';
import agentsReducer from './slices/agentsSlice';
import bridgesReducer from './slices/bridgesSlice';
import topicsReducer from './slices/topicsSlice';
import uiReducer from './slices/uiSlice';
import logsReducer from './slices/logsSlice';

export const store = configureStore({
  reducer: {
    system: systemReducer,
    agents: agentsReducer,
    bridges: bridgesReducer,
    topics: topicsReducer,
    ui: uiReducer,
    logs: logsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;