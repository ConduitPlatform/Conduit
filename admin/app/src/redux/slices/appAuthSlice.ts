import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export type AppAuthState = {
  value: number;
};

const initialState: AppAuthState = {
  value: 0,
};

export const appAuthSlice = createSlice({
  name: 'appAuth',
  initialState,
  reducers: {
    //add some reducer
    // addSomething: (state, action: PayloadAction<number>) => {
    //   state.value += action.payload;
    // },
  },
});

//export some actions
export const {} = appAuthSlice.actions;
// export const {  addSomething } = appAuthSlice.actions;

// export some thunk
// export const selectCount = (state: RootState) => state.counter.value;

export default appAuthSlice.reducer;
