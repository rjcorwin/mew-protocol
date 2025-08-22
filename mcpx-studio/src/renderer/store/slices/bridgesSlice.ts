import { createSlice } from '@reduxjs/toolkit';

interface BridgesState {
  list: any[];
  selected: string | null;
}

const initialState: BridgesState = {
  list: [],
  selected: null,
};

const bridgesSlice = createSlice({
  name: 'bridges',
  initialState,
  reducers: {
    setBridges: (state, action) => {
      state.list = action.payload;
    },
    selectBridge: (state, action) => {
      state.selected = action.payload;
    },
  },
});

export const { setBridges, selectBridge } = bridgesSlice.actions;
export default bridgesSlice.reducer;