import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    mapInstance: null,
    center: [30.7333, 76.7794], // Chandigarh, India
    zoom: 12,
    selectedLocation: null,
    markers: [],
    heatmapLayer: null,
};

const mapSlice = createSlice({
    name: 'map',
    initialState,
    reducers: {
        setMapInstance: (state, action) => {
            state.mapInstance = action.payload;
        },
        setCenter: (state, action) => {
            state.center = action.payload;
        },
        setZoom: (state, action) => {
            state.zoom = action.payload;
        },
        setSelectedLocation: (state, action) => {
            state.selectedLocation = action.payload;
        },
        addMarker: (state, action) => {
            state.markers.push(action.payload);
        },
        clearMarkers: (state) => {
            state.markers = [];
        },
        setHeatmapLayer: (state, action) => {
            state.heatmapLayer = action.payload;
        },
    },
});

export const {
    setMapInstance,
    setCenter,
    setZoom,
    setSelectedLocation,
    addMarker,
    clearMarkers,
    setHeatmapLayer,
} = mapSlice.actions;

export default mapSlice.reducer;
