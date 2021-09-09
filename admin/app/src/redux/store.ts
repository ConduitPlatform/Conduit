import { applyMiddleware } from 'redux';
import rootReducer from './reducers';
import thunk from 'redux-thunk';
import { Action, configureStore, ThunkAction } from '@reduxjs/toolkit';

// declare global {
//   interface Window {
//     __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
//   }
// }

// let store: any;

export const store = configureStore(
  {
    reducer: rootReducer,
  }
  // initialState,
  // composeEnhancers(applyMiddleware(thunk))
);

// export const initStore = (initialState = {}): any => {
//   const composeEnhancers =
//     (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) ||
//     compose;
//   if (process.env.IS_DEV) {
//     store = createStore(
//       rootReducer,
//       initialState,
//       composeEnhancers(applyMiddleware(thunk))
//     );
//   } else {
//     store = createStore(rootReducer, initialState, applyMiddleware(thunk));
//   }
//
//   return store;
// };

// export const initStore = (initialState = {}) => {
//   store = createStore(rootReducer, initialState, applyMiddleware(thunk));
//   return store;
// };

const getStore = (): any => {
  return store;
};

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

export default getStore;
