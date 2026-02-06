import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import predictionService from '@services/predictionService';

const initialState = {
    currentPrediction: null,
    batchPredictions: [],
    riskZones: null,
    isLoading: false,
    error: null,
};

// Async thunks
export const fetchSinglePrediction = createAsyncThunk(
    'predictions/fetchSingle',
    async ({ latitude, longitude, features }, { rejectWithValue }) => {
        try {
            const data = await predictionService.getSinglePrediction(
                latitude,
                longitude,
                features
            );
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.error || 'Prediction failed'
            );
        }
    }
);

export const fetchBatchPredictions = createAsyncThunk(
    'predictions/fetchBatch',
    async (locations, { rejectWithValue }) => {
        try {
            const data = await predictionService.getBatchPredictions(locations);
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.error || 'Batch prediction failed'
            );
        }
    }
);

export const fetchRiskZones = createAsyncThunk(
    'predictions/fetchRiskZones',
    async ({ bounds, resolution }, { rejectWithValue }) => {
        try {
            const data = await predictionService.getRiskZones(bounds, resolution);
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.error || 'Failed to load risk zones'
            );
        }
    }
);

const predictionsSlice = createSlice({
    name: 'predictions',
    initialState,
    reducers: {
        clearPrediction: (state) => {
            state.currentPrediction = null;
            state.error = null;
        },
        clearBatchPredictions: (state) => {
            state.batchPredictions = [];
        },
    },
    extraReducers: (builder) => {
        builder
            // Single prediction
            .addCase(fetchSinglePrediction.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchSinglePrediction.fulfilled, (state, action) => {
                state.isLoading = false;
                state.currentPrediction = action.payload;
            })
            .addCase(fetchSinglePrediction.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // Batch predictions
            .addCase(fetchBatchPredictions.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchBatchPredictions.fulfilled, (state, action) => {
                state.isLoading = false;
                state.batchPredictions = action.payload.predictions;
            })
            .addCase(fetchBatchPredictions.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            })
            // Risk zones
            .addCase(fetchRiskZones.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(fetchRiskZones.fulfilled, (state, action) => {
                state.isLoading = false;
                state.riskZones = action.payload;
            })
            .addCase(fetchRiskZones.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload;
            });
    },
});

export const { clearPrediction, clearBatchPredictions } =
    predictionsSlice.actions;
export default predictionsSlice.reducer;
