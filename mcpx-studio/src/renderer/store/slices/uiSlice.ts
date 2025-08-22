import { createSlice } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark';
  activeView: string;
  sidebarCollapsed: boolean;
  notifications: any[];
}

const initialState: UIState = {
  theme: 'light',
  activeView: 'dashboard',
  sidebarCollapsed: false,
  notifications: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setActiveView: (state, action) => {
      state.activeView = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    addNotification: (state, action) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
  },
});

export const { setTheme, setActiveView, toggleSidebar, addNotification, removeNotification } = uiSlice.actions;
export default uiSlice.reducer;