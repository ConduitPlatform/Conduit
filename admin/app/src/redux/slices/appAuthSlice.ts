import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';

export type AppAuthState = {
  token: any;
  loading: boolean;
  error: any;
  enabledModules: any;
};

const initialState: AppAuthState = {
  token: null,
  loading: false,
  error: null,
  enabledModules: [],
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
