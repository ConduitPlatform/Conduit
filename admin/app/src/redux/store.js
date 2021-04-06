import { applyMiddleware, createStore } from 'redux';
import rootReducer from './reducers';
import thunk from 'redux-thunk';

let store;

// export const initStore = (initialState = {}) => {
//   const composeEnhancers =
//     (typeof window !== 'undefined' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) ||
//     compose;
//
//   store = createStore(
//     rootReducer,
//     initialState,
//     composeEnhancers(applyMiddleware(thunk))
//   );
//   return store;
// };

export const initStore = (initialState = {}) => {
  store = createStore(rootReducer, initialState, applyMiddleware(thunk));
  return store;
};

const getStore = () => {
  return store;
};

export default getStore;
