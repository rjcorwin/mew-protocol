import { createSlice } from '@reduxjs/toolkit';

interface TopicsState {
  list: string[];
  active: string | null;
  messages: any[];
  participants: any[];
}

const initialState: TopicsState = {
  list: [],
  active: null,
  messages: [],
  participants: [],
};

const topicsSlice = createSlice({
  name: 'topics',
  initialState,
  reducers: {
    setTopics: (state, action) => {
      state.list = action.payload;
    },
    setActiveTopic: (state, action) => {
      state.active = action.payload;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setParticipants: (state, action) => {
      state.participants = action.payload;
    },
  },
});

export const { setTopics, setActiveTopic, addMessage, setParticipants } = topicsSlice.actions;
export default topicsSlice.reducer;