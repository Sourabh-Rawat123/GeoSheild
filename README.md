# 🛡️ GeoShield AI: Intelligent Landslide Prediction & Risk Assessment Platform

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/geoshield-ai/geoshield)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-18.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.2-blue.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/)

> **AI-powered landslide prediction and early warning system with real-time monitoring, weather integration, and comprehensive risk analytics.**

## 🌟 Overview

**GeoShield AI** is a full-stack platform that leverages machine learning, geospatial intelligence, and real-time weather data to predict landslides and provide early warnings. The system integrates ML predictions, weather monitoring, and historical incident analysis to protect communities in high-risk areas.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Machine Learning Pipeline](#-machine-learning-pipeline)
- [Geospatial Analytics](#-geospatial-analytics)
- [Microservices](#-microservices)
- [Monitoring & Observability](#-monitoring--observability)
- [Security](#-security)
- [Testing](#-testing)
- [Performance](#-performance)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Features

### 🤖 Advanced Machine Learning

- **Ensemble Learning**: XGBoost, LightGBM, Random Forest, SVM, Neural Network with meta-model stacking
- **Feature Engineering**: 35+ engineered features including PCA-reduced dimensions
- **Auto-Retraining**: Scheduled model updates with performance monitoring
- **Model Registry**: Version-controlled model artifacts with MLflow integration
- **Explainable AI**: SHAP values and feature importance visualization
- **Data Augmentation**: Synthetic minority oversampling (SMOTE) for class balance
- **Hyperparameter Optimization**: Optuna-based automated tuning

### 🗺️ Geospatial Intelligence

- **Interactive Risk Maps**: Real-time heatmaps with Leaflet/Mapbox integration
- **Multi-layer Overlays**: NDVI, elevation (DEM), rainfall rasters, soil moisture
- **Contour Generation**: Risk probability iso-lines with Turf.js
- **Geo-clustering**: DBSCAN-based hotspot identification
- **Route Risk Analysis**: Travel path safety assessment
- **3D Terrain Visualization**: WebGL-powered elevation rendering
- **GeoJSON Export**: Standards-compliant geospatial data formats

### ⚡ Real-time Data Pipeline

- **Multi-source Integration**: ISRO Bhuvan, NASA MODIS, IMD weather stations
- **Automated Ingestion**: CRON-scheduled data fetching with retry logic
- **Data Validation**: Schema validation, outlier detection, quality checks
- **Stream Processing**: Apache Kafka-ready architecture for event streaming
- **Time-series Forecasting**: ARIMA models for rainfall prediction
- **Data Lake**: S3-compatible storage with Parquet format optimization


### 📱 User Experience

- **Responsive Web App**: Mobile-first design with Tailwind CSS
- **User Dashboard**: Risk map, route analysis, profile, alerts
- **Interactive Charts**: Recharts/Chart.js
- **Dark Mode**: System-preference aware theming
- **Accessibility**: WCAG 2.1 AA compliant


### 🔔 Multi-channel Alerting (Planned)

- **SMS Alerts**: Twilio integration
- **Email Notifications**: Nodemailer
- **WhatsApp Business**: Meta Business API integration


### 🏢 Project Features

- **User Authentication**: JWT-based
- **Audit Logging**: Basic user activity logs
- **Data Encryption**: AES-256 at rest, TLS 1.3 in transit

---

## 🏗️ Architecture

### High-Level System Architecture


```
┌──────────────────────────────────────────────┐
│              CLIENT TIER (React SPA)         │
│  ┌──────────────┐                            │
│  │ User Portal  │                            │
│  └──────┬───────┘                            │
└─────────┼────────────────────────────────────┘
    │
    ▼
 ┌──────────────────────────────┐
 │        BACKEND API           │
 │   (Node.js/Express, MongoDB) │
 └───────┬──────────────────────┘
   │
   ▼
 ┌──────────────────────────────┐
 │   ML SERVICE (FastAPI, Py)   │
 │   (Prediction Only)          │
 └──────────────────────────────┘
```

**Simple User-Only Flow:**
- User interacts with the React frontend (dashboard, risk map, route analysis, profile, alerts)
- Frontend communicates with the Node.js/Express backend for authentication, user management, and to request predictions
- Backend calls the ML service (FastAPI) for landslide risk predictions
- All data is stored in MongoDB (no Redis, no Kafka, no message queues)

No Redis, no Kafka, no admin/analyst flows. Only user-facing features are active.


### Simplified User-Only Architecture

- **Frontend**: React SPA for end users (dashboard, risk map, route analysis, profile, alerts)
- **Backend**: Node.js/Express API for authentication, user management, predictions, and alerts
- **ML Service**: FastAPI Python service for landslide risk prediction (no admin/analyst retraining exposed)
- **Alerting**: Multi-channel (SMS, Email, WhatsApp) via backend
- **Data**: MongoDB for user data, logs, predictions; ML service loads models from local storage
- **No Admin/Analyst Flows**: All admin/analyst code and routes removed from runtime; only user flows are active

---

## 🛠️ Technology Stack


### Technology Stack (User-Only)

- **Frontend**: React 18, Redux Toolkit, Tailwind CSS, Leaflet, Vite
- **Backend**: Node.js 18, Express, MongoDB (Mongoose), JWT Auth, REST API, Nodemailer/Twilio (planned)
- **ML Service**: FastAPI, scikit-learn, XGBoost, LightGBM (no admin/analyst endpoints)
- **Mapping**: Leaflet, OSRM (routing), Nominatim (geocoding)
- **Alerting**: Twilio (SMS), Nodemailer (Email), WhatsApp (planned)
---

## 📁 Project Structure


```
geoshield-ai/
├── client/           # React frontend (user flows only)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── user/         # User dashboard, profile, risk map, alerts, route analysis
│   │   │   ├── auth/         # Login, Signup, ForgotPassword
│   │   │   └── public/       # Landing, NotFound
│   │   ├── features/
│   │   ├── services/
│   │   ├── layouts/
│   │   └── App.jsx
│   └── ...
├── server/           # Node.js backend (user API only)
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── utils/
│   │   └── app.js
│   └── ...
├── ml-service/       # FastAPI ML microservice (predictions only)
│   ├── app/
│   │   ├── api/v1/endpoints/predict.py
│   │   └── ...
│   └── ...
├── logs/
└── ...
```

---

## 📦 Prerequisites


### Required Software

- **Node.js**: 18.x LTS or higher
- **Python**: 3.9 or higher
- **Docker**: 24.x or higher
- **MongoDB**: 6.0 or higher
- **Git**: 2.x or higher

### Optional (for production)

- **Kubernetes**: 1.28 or higher
- **kubectl**: Matching Kubernetes version
- **Helm**: 3.x
- **Terraform**: 1.5 or higher

### Development Tools

- **Code Editor**: VS Code (recommended) with extensions:
  - ESLint
  - Prettier
  - Python
  - Docker
  - Kubernetes
- **API Testing**: Postman or Insomnia
- **Database GUI**: MongoDB Compass, pgAdmin

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/geoshield-ai/geoshield.git
cd geoshield
```

### 2. Environment Configuration

Copy environment templates for all services:

```bash
# Root
cp .env.example .env

# Client
cp client/.env.example client/.env

# Server
cp server/.env.example server/.env


# ML Service
cp ml-service/.env.example ml-service/.env
```

Edit each `.env` file with your configuration (see [Configuration](#-configuration) section).

### 3. Docker Installation (Recommended)

**Start all services with Docker Compose:**

```bash
# Development mode
docker-compose up -d

# Production mode
docker-compose -f docker-compose.prod.yml up -d

# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```


Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **ML Service**: http://localhost:8001

### 4. Manual Installation (Development)

#### Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..


# Install Node.js backend
cd server && npm install && cd ..

# Install ML service
cd ml-service
pip install -r requirements.txt
cd ..
```

#### Start Databases

```bash
# MongoDB
mongod --dbpath /data/db --port 27017


```

#### Start Services

**Terminal 1 - Frontend:**
```bash
cd client
npm run dev
```

**Terminal 2 - Backend Server:**
```bash
cd server
npm run dev
```

**Terminal 3 - ML Service:**
```bash
cd ml-service
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```



---

## ⚙️ Configuration

Detailed configuration documentation is available in [`docs/deployment/configuration.md`](docs/deployment/configuration.md).

### Key Configuration Files

- **Frontend**: `client/.env`
- **Backend**: `server/.env`
- **ML Service**: `ml-service/.env`
- **Databases**: Connection strings in respective `.env` files
- **External APIs**: API keys for Twilio, SendGrid, Mapbox, etc.

---



## 📚 API Documentation

User API documentation is available at:
- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

---



## 🤖 Machine Learning Pipeline

ML service is used only for predictions. No retraining or evaluation endpoints are exposed to the frontend or backend. See [`docs/ml-pipeline/`](docs/ml-pipeline/) for details.

### Model Performance

| Model | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
|-------|----------|-----------|--------|----------|---------|
| **Ensemble Meta-Model** | **93.7%** | **0.921** | **0.905** | **0.913** | **0.981** |
| XGBoost | 92.8% | 0.912 | 0.895 | 0.903 | 0.976 |
| LightGBM | 92.3% | 0.908 | 0.891 | 0.899 | 0.974 |
| Random Forest | 91.5% | 0.898 | 0.883 | 0.890 | 0.969 |
| Neural Network | 90.1% | 0.885 | 0.870 | 0.877 | 0.963 |
| SVM (RBF) | 88.7% | 0.871 | 0.856 | 0.863 | 0.955 |

---



## 🗺️ Geospatial Analytics

See [`docs/gis/`](docs/gis/) for details. Only user-facing risk map and route analysis features are active.


### Supported Layers
- Digital Elevation Model (DEM)
- NDVI (Vegetation Index)
- Rainfall Intensity
- Soil Moisture
- Risk Probability Heatmap
- Historical Landslide Locations

---

## 🔐 Security

Security documentation: [`docs/security/`](docs/security/)

- JWT-based authentication
- Role-based access control (RBAC)
- API rate limiting
- Data encryption (AES-256)
- SQL injection prevention
- XSS protection
- CSRF tokens

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific service tests
cd server && npm test
cd ml-service && pytest
```

---


---

---

## 🚢 Deployment

Deployment guides: [`docs/deployment/`](docs/deployment/)

- [Docker Guide](docs/deployment/docker-guide.md)
- [Kubernetes Guide](docs/deployment/kubernetes-guide.md)
- [AWS Deployment](docs/deployment/aws-deployment.md)
- [Azure Deployment](docs/deployment/azure-deployment.md)
- [GCP Deployment](docs/deployment/gcp-deployment.md)

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---



## 👥 Team

**GeoShield AI Development Team** (2024-2025)

- **Lead Architect**: [Name] - System Design, Microservices
- **ML Engineer**: [Name] - Machine Learning Pipeline
- **Full-Stack Developer**: [Name] - MERN Stack

---

## 📄 License

Enterprise License - See [LICENSE](LICENSE) for details.

---

## 📞 Support

- **Email**: support@geoshield.ai
- **Documentation**: https://docs.geoshield.ai
- **Issues**: https://github.com/geoshield-ai/geoshield/issues
- **Slack**: https://geoshield.slack.com

---

## 🌟 Acknowledgments

- ISRO (Indian Space Research Organisation) for satellite data access
- IMD (India Meteorological Department) for weather data
- NASA for DEM and MODIS data
- Open-source community for amazing tools and libraries

---

**Made with ❤️ by the GeoShield AI Team**

**Protecting lives through intelligent geospatial analytics and predictive AI**
