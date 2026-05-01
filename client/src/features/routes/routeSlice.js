import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    selectedRoute: null,
    routePredictions: [],
    routeIncidents: [],
};

const routeSlice = createSlice({
    name: 'routes',
    initialState,
    reducers: {
        setSelectedRoute: (state, action) => {
            state.selectedRoute = action.payload;
        },
        setRoutePredictions: (state, action) => {
            state.routePredictions = action.payload;
        },
        setRouteIncidents: (state, action) => {
            state.routeIncidents = action.payload;
        },
        clearSelectedRoute: (state) => {
            state.selectedRoute = null;
            state.routePredictions = [];
            state.routeIncidents = [];
        },
    },
});

export const { setSelectedRoute, setRoutePredictions, setRouteIncidents, clearSelectedRoute } = routeSlice.actions;
export default routeSlice.reducer;
