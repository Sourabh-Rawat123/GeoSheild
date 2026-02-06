const sampleAdmin = {
    name: 'Admin User',
    email: 'admin@geoshield.com',
    password: 'admin123',
    role: 'admin',
    location: {
        coordinates: [78.0322, 30.3165],
        address: 'Rajpur Road',
        city: 'Dehradun',
        state: 'Uttarakhand'
    },
    alertPreferences: {
        sms: {
            enabled: false,
            phone: '7456931978'
        },
        severityThreshold: 'Moderate'
    }
};

const historicalIncidents = [
    {
        location: {
            coordinates: [88.2636, 27.0410],
            address: 'Darjeeling Hills',
            city: 'Darjeeling',
            state: 'West Bengal',
            country: 'India'
        },
        incidentDate: new Date('2023-07-15'),
        severity: 'Major',
        details: {
            casualties: { deaths: 12, injuries: 45 },
            damage: { housesDestroyed: 23, roadsBlocked: 5, estimatedCost: 15000000 },
            area: { affectedAreaKm2: 2.5, volumeM3: 45000 }
        },
        triggers: { rainfall: 185, earthquake: false, humanActivity: false },
        conditions: { slope: 42, soilType: 'Clay-loam', vegetation: 'Sparse', previousSlides: true },
        description: 'Heavy monsoon rainfall triggered multiple landslides in Darjeeling hills, blocking NH-55 and destroying several houses.',
        source: 'official',
        verified: true
    },
    {
        location: {
            coordinates: [92.9376, 26.2006],
            address: 'Dima Hasao',
            city: 'Haflong',
            state: 'Assam',
            country: 'India'
        },
        incidentDate: new Date('2022-05-18'),
        severity: 'Catastrophic',
        details: {
            casualties: { deaths: 28, injuries: 67 },
            damage: { housesDestroyed: 54, roadsBlocked: 12, estimatedCost: 35000000 },
            area: { affectedAreaKm2: 5.2, volumeM3: 125000 }
        },
        triggers: { rainfall: 245, earthquake: false, humanActivity: true },
        conditions: { slope: 48, soilType: 'Sandy-clay', vegetation: 'Deforested', previousSlides: true },
        description: 'Severe landslides following intense rainfall and deforestation caused massive destruction in Dima Hasao district.',
        source: 'official',
        verified: true
    },
    {
        location: {
            coordinates: [76.9558, 8.5241],
            address: 'Munnar',
            city: 'Idukki',
            state: 'Kerala',
            country: 'India'
        },
        incidentDate: new Date('2023-08-20'),
        severity: 'Moderate',
        details: {
            casualties: { deaths: 3, injuries: 15 },
            damage: { housesDestroyed: 8, roadsBlocked: 3, estimatedCost: 5000000 },
            area: { affectedAreaKm2: 1.2, volumeM3: 18000 }
        },
        triggers: { rainfall: 125, earthquake: false, humanActivity: false },
        conditions: { slope: 38, soilType: 'Laterite', vegetation: 'Tea plantations', previousSlides: false },
        description: 'Monsoon-triggered landslide in tea estate areas, damaged workers quarters and blocked access roads.',
        source: 'official',
        verified: true
    },
    {
        location: {
            coordinates: [77.2090, 28.6139],
            address: 'East Delhi',
            city: 'Delhi',
            state: 'Delhi',
            country: 'India'
        },
        incidentDate: new Date('2024-07-05'),
        severity: 'Minor',
        details: {
            casualties: { deaths: 0, injuries: 2 },
            damage: { housesDestroyed: 1, roadsBlocked: 1, estimatedCost: 800000 },
            area: { affectedAreaKm2: 0.3, volumeM3: 3500 }
        },
        triggers: { rainfall: 65, earthquake: false, humanActivity: true },
        conditions: { slope: 25, soilType: 'Fill material', vegetation: 'Urban', previousSlides: false },
        description: 'Small landslide near construction site after heavy rainfall, minor damage reported.',
        source: 'news',
        verified: true
    },
    {
        location: {
            coordinates: [73.8567, 18.5204],
            address: 'Malin Village',
            city: 'Pune',
            state: 'Maharashtra',
            country: 'India'
        },
        incidentDate: new Date('2022-07-30'),
        severity: 'Catastrophic',
        details: {
            casualties: { deaths: 151, injuries: 78 },
            damage: { housesDestroyed: 156, roadsBlocked: 8, estimatedCost: 85000000 },
            area: { affectedAreaKm2: 3.8, volumeM3: 185000 }
        },
        triggers: { rainfall: 310, earthquake: false, humanActivity: false },
        conditions: { slope: 45, soilType: 'Weathered basalt', vegetation: 'Moderate', previousSlides: true },
        description: 'One of the worst landslide disasters, entire village buried under debris during heavy monsoon.',
        source: 'official',
        verified: true
    }
];

module.exports = { data: sampleAdmin, historicalIncidents };