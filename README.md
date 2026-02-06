# GeoShield AI

AI-based landslide risk prediction platform using weather data, terrain analysis, and machine learning.

---

## Overview

GeoShield AI predicts landslide risk using an ensemble model that combines:

* Live weather and terrain data
* Machine learning predictions
* Historical incident data

Users can view risk levels on a map, receive alerts, and monitor locations in real time.

---

## Tech Stack

Frontend:

* React
* Redux Toolkit
* Tailwind CSS
* Leaflet

Backend:

* Node.js
* Express
* MongoDB

Machine Learning:

* Python
* scikit-learn

---

## Project Structure

```
client/        React frontend
server/        Node.js API
ml-service/    ML models and datasets
```

---

## Installation

Clone repo:

```
git clone https://github.com/Sourabh-Rawat123/GeoSheild.git
cd landslide_prevention
```

Install dependencies:

```
cd server && npm install
cd ../client && npm install
pip install -r ml-service/requirements.txt
```

Create `.env` files in `server` and `client` with API keys and MongoDB URI.

---

## Run Development

Start backend:

```
cd server
npm run dev
```

Start frontend:

```
cd client
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

## Main Features

* Landslide risk prediction
* Interactive risk map
* Real-time alerts
* User dashboard

---

## API

Main endpoints:

```
POST /api/auth/login
POST /api/predictions
GET  /api/alerts
GET  /api/users/profile
```

---

## License

MIT License
