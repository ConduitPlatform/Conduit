import { applyMiddleware, compose, createStore } from 'redux';
import rootReducer from './reducers';
import thunk from 'redux-thunk';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

let store: any;

export const initStore = (initialState = {}): any => {
  const composeEnhancers =
    (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) ||
    compose;
  if (process.env.IS_DEV) {
    store = createStore(
      rootReducer,
      initialState,
      composeEnhancers(applyMiddleware(thunk))
    );
  } else {
    store = createStore(rootReducer, initialState, applyMiddleware(thunk));
  }

  return store;
};

// export const initStore = (initialState = {}) => {
//   store = createStore(rootReducer, initialState, applyMiddleware(thunk));
//   return store;
// };

const getStore = (): any => {
  return store;
};

export type RootState = ReturnType<typeof store.getState>;

export default getStore;
