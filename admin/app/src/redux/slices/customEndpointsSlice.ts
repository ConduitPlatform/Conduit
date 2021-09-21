import { createSlice } from '@reduxjs/toolkit';
import OperationsEnum from '../../models/OperationsEnum';

// TODO create proper Interface for the slices' initial state

interface ICustomEndpointSlice {
  data: {
    endpoint: {
      name: string;
      operation: any;
      selectedSchema: string;
      authentication: boolean;
      paginated: boolean;
      sorted: boolean;
      inputs: [];
      queries: [];
      assignments: [];
    };
    schemaFields: [];
    selectedEndpoint: any;
  };
}

const initialState: ICustomEndpointSlice = {
  data: {
    endpoint: {
      name: '',
      operation: -1,
      selectedSchema: '',
      authentication: false,
      paginated: false,
      sorted: false,
      inputs: [],
      queries: [],
      assignments: [],
    },
    schemaFields: [],
    selectedEndpoint: undefined,
  },
};

const customEndpointsSlice = createSlice({
  name: 'customEndpoints',
  initialState,
  reducers: {
    setSelectedEndPoint(state, action) {
      state.data.selectedEndpoint = action.payload;
    },
    setSchemaFields(state, action) {
      state.data.schemaFields = action.payload;
    },
    setEndpointData(state, action) {
      console.log({ ...state.data.endpoint, ...action.payload });
      state.data.endpoint = { ...state.data.endpoint, ...action.payload };
    },
    endpointCleanSlate(state) {
      state = initialState;
    },
  },
});

export default customEndpointsSlice.reducer;
export const {
  setSelectedEndPoint,
  setSchemaFields,
  setEndpointData,
  endpointCleanSlate,
} = customEndpointsSlice.actions;
