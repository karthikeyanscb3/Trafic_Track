# Live Traffic Data Implementation Guide

## Overview
This document explains how to implement live traffic data in the Traffic Track application. The system supports multiple traffic API providers and automatically falls back to static data if live data is unavailable.

## Architecture

### Backend Components

1. **TrafficData.java** - Entity model for storing traffic data
   - Stores congestion levels, flow speed, travel times
   - Tracks data source (Google/TomTom/HERE/Static)
   - Links to incidents via one-to-many relationship

2. **TrafficIncident.java** - Entity model for traffic incidents
   - Stores accident, roadwork, congestion, and closure data
   - Includes severity levels and delay estimates
   - Linked to parent TrafficData entity

3. **TrafficDataRepository.java** - Data access for traffic data
   - Find latest data by location
   - Query by time range
   - Auto-cleanup of old data

4. **TrafficIncidentRepository.java** - Data access for incidents
   - Find incidents by geographic bounds
   - Query active incidents
   - Auto-cleanup of old incidents

5. **TrafficApiService.java** - Core service for fetching live traffic
   - Fetches data from Google Maps, TomTom, or HERE APIs
   - Handles API authentication and error handling
   - Falls back to static data on failure
   - Caches results to reduce API calls

6. **TrafficController.java** - REST API endpoints
   - `GET /api/traffic/live` - Fetch traffic for single location
   - `GET /api/traffic/grid` - Fetch traffic for multiple grid points
   - `POST /api/traffic/cleanup` - Clean up old data

### Frontend Components

1. **trafficService.js** - Frontend service for API calls
   - `fetchLiveTrafficData()` - Fetch single location
   - `fetchGridTrafficData()` - Fetch grid of locations
   - `transformGridDataToIntersections()` - Transform API data to map format
   - `setupAutoRefresh()` - Auto-refresh mechanism
   - Helper functions for colors and data staleness

2. **SwarmMap.js** (Updated) - Main visualization component
   - Toggle between live and static data
   - Auto-refresh every 5 minutes
   - Display data source badges on map markers
   - Status indicator showing live data state

## Supported Traffic API Providers

### 1. Google Maps Traffic API

**Best For:** Global coverage, most comprehensive data

**Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Roads API" and "Directions API"
3. Create API key with restrictions
4. Cost: ~$0.005-0.010 per request

**Features:**
- Near real-time traffic data
- Road speed information
- Traffic conditions overlay
- Global coverage

**API Endpoints Used:**
- Roads API: `https://roads.googleapis.com/v1/nearestRoads`

### 2. TomTom Traffic API

**Best For:** Detailed incident data, good European coverage

**Setup:**
1. Sign up at [TomTom Developer Portal](https://developer.tomtom.com/)
2. Create free account (2,500 requests/day free tier)
3. Generate API key
4. Cost: Free tier available, paid tiers start at $0.001 per request

**Features:**
- Traffic flow data (current speed, free flow speed)
- Incident details (accidents, roadwork, closures)
- Travel time calculations
- Real-time updates

**API Endpoints Used:**
- Traffic Flow: `https://api.tomtom.com/traffic/services/4/flowSegmentData`
- Incidents: `https://api.tomtom.com/traffic/services/5/incidentDetails`

### 3. HERE Traffic API

**Best For:** Enterprise applications, precise data

**⚠️ IMPORTANT:** HERE has deprecated their v7 API. The v8 API requires OAuth 2.0 authentication which is more complex. **We recommend using TomTom or Google Maps instead.**

**Setup (Advanced - Not Recommended for Quick Start):**
1. Register at [HERE Developer Portal](https://developer.here.com/)
2. Create project and get OAuth credentials
3. Implement OAuth 2.0 token flow
4. Cost: Freemium available, enterprise pricing varies

**Why We Don't Recommend HERE:**
- ❌ Requires OAuth 2.0 (complex setup)
- ❌ Simple API keys no longer work (401 errors)
- ❌ v7 API deprecated, v8 requires migration
- ✅ Better alternatives: TomTom (easy setup, free tier)

**Features (if implemented):**
- Traffic flow v8 API
- Real-time traffic speed
- Incident reporting
- Historical traffic patterns

**API Endpoints Used:**
- Traffic Flow: `https://data.traffic.hereapi.com/v7/flow` (Deprecated)
- New v8: Requires OAuth token

## Implementation Steps

### Step 1: Configure API Credentials

1. Save API credentials via the Traffic API Configuration UI
2. The backend encrypts and stores credentials securely
3. System automatically uses active credentials for live data fetching

### Step 2: Enable Live Data

In the frontend:
```javascript
// Toggle live data in SwarmMap component
setUseLiveData(true);
```

Or via UI:
- Navigate to "Map Controls" section
- Click "🟢 Live Data" button
- System automatically fetches live data and refreshes every 5 minutes

### Step 3: Test the Integration

1. **Save API Credentials:**
   - Go to "Traffic API Configuration"
   - Select provider (Google/TomTom/HERE)
   - Enter API key
   - Click "Save Credential"
   - Click "Test API" to verify

2. **Enable Live Data:**
   - Go to "Map Controls"
   - Click "🟢 Live Data"
   - Wait for data to load
   - Check status indicator shows "Active"

3. **Verify Data:**
   - Click on map markers
   - Look for "🟢 LIVE" badge in popup
   - Congestion colors should reflect real traffic
   - Auto-refresh occurs every 5 minutes

### Step 4: Monitor Data Quality

- **Status Indicator:** Shows "Active", "Fetching...", "Failed", or "Not Active"
- **Last Update Time:** Displays when data was last refreshed
- **Data Source Badge:** Each marker shows if using live or static data
- **Fallback Behavior:** Automatically uses static data if API fails

## API Request Flow

```
Frontend Request → trafficService.js → Backend /api/traffic/grid
                                           ↓
                              TrafficController.getGridTrafficData()
                                           ↓
                              TrafficApiService.fetchLiveTrafficData()
                                           ↓
                    ┌──────────────────────┴──────────────────────┐
                    ↓                      ↓                       ↓
         Google Roads API        TomTom Traffic API      HERE Traffic API
                    ↓                      ↓                       ↓
                    └──────────────────────┬──────────────────────┘
                                           ↓
                              Save to TrafficData entity
                                           ↓
                              Return JSON to frontend
                                           ↓
                        Transform to map visualization format
                                           ↓
                              Update map markers & roads
```

## Database Schema

### traffic_data Table
```sql
CREATE TABLE traffic_data (
    id BIGSERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius DOUBLE PRECISION NOT NULL,
    congestion_level DOUBLE PRECISION,
    flow_speed DOUBLE PRECISION,
    free_flow_speed DOUBLE PRECISION,
    current_travel_time INTEGER,
    free_flow_travel_time INTEGER,
    road_closure BOOLEAN DEFAULT FALSE,
    data_source VARCHAR(50),
    fetched_at TIMESTAMP NOT NULL
);
```

### traffic_incidents Table
```sql
CREATE TABLE traffic_incidents (
    id BIGSERIAL PRIMARY KEY,
    traffic_data_id BIGINT REFERENCES traffic_data(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    incident_type VARCHAR(50),
    severity VARCHAR(20),
    description VARCHAR(1000),
    reported_at TIMESTAMP NOT NULL,
    delay_minutes INTEGER
);
```

## Configuration Properties

Add to `application.properties`:

```properties
# Traffic API Configuration
traffic.api.timeout=10
traffic.api.cache.duration=300000

# Encryption key for API credentials (already configured)
app.encryption.key=${APP_ENC_KEY:/O57NYDzbL6ML5Hinm/PrHEFjPjOSl9yxaQQ87rZ42k=}
```

## Performance Optimization

1. **Caching:** Backend caches traffic data for 10 minutes to reduce API calls
2. **Batch Requests:** Frontend fetches grid data (9 points) in single request
3. **Auto-refresh:** Configurable refresh interval (default 5 minutes)
4. **Fallback:** Automatic fallback to static data prevents UI failures
5. **Lazy Loading:** Data only fetched when live mode is enabled

## Cost Estimation

### Free Tier Usage (Typical Small Application)
- **Requests per day:** ~288 (5-minute refresh, 1 user, 12 hours)
- **TomTom:** ✅ Within free tier (2,500/day)
- **HERE:** ✅ Within free tier (250,000/month)
- **Google:** ⚠️ May exceed free tier ($200 credit)

### Paid Tier (Production Application)
- **100 users, 12 hours/day:**
  - ~28,800 requests/day
  - TomTom: ~$28.80/day
  - HERE: ~$14.40/day (better pricing)
  - Google: ~$144/day (most expensive)

**Recommendation:** Start with TomTom or HERE for free tier, optimize refresh rate, consider WebSocket for scale.

## Troubleshooting

### "Failed - Using Static Data"
- **Check:** API key is valid and not expired
- **Check:** API provider service is online
- **Check:** Backend logs for detailed error messages
- **Solution:** Test API via "Test API" button, regenerate key if needed

### "No active API credential found"
- **Check:** API credential is saved in database
- **Solution:** Save API credential via Traffic API Configuration

### Data Not Updating
- **Check:** Live Data toggle is enabled
- **Check:** Status shows "Active" not "Not Active"
- **Check:** Last update time is recent
- **Solution:** Disable and re-enable live data, refresh page

### High API Costs
- **Solution 1:** Increase auto-refresh interval (default 5 min → 10 min)
- **Solution 2:** Reduce grid size (9x9 → 5x5)
- **Solution 3:** Implement WebSocket for push-based updates
- **Solution 4:** Cache data longer (10 min → 30 min)

## Future Enhancements

### Phase 1: WebSocket Integration (Optional)
- Replace polling with push-based updates
- Reduce API calls by 80%
- Real-time incident notifications

### Phase 2: Historical Data Analysis
- Store traffic patterns over time
- Predict congestion based on historical data
- Machine learning for traffic forecasting

### Phase 3: Multiple Data Source Aggregation
- Combine data from multiple providers
- Cross-validate for accuracy
- Use cheapest provider for each region

### Phase 4: Incident Visualization
- Display incident markers on map
- Show severity with color coding
- Popup with incident details

## Testing Checklist

- [ ] Backend builds successfully with `mvn clean install`
- [ ] Database tables created automatically on startup
- [ ] API credentials can be saved and retrieved
- [ ] Test API button verifies credentials
- [ ] Live data toggle switches between static and live
- [ ] Grid traffic data fetches for 9 points
- [ ] Map markers show live data badge
- [ ] Auto-refresh triggers every 5 minutes
- [ ] Fallback to static data works on API failure
- [ ] Status indicator updates correctly
- [ ] Last update time displays

## Security Considerations

1. **API Key Encryption:** All keys encrypted with AES-256-GCM
2. **Environment Variables:** Use `APP_ENC_KEY` for encryption key
3. **API Key Masking:** Frontend only shows masked keys
4. **HTTPS Required:** All API calls use HTTPS
5. **Rate Limiting:** Consider adding rate limits to prevent abuse

## Conclusion

This implementation provides a robust, scalable solution for integrating live traffic data with automatic fallback to static data. The system supports multiple providers, handles errors gracefully, and optimizes costs through caching and configurable refresh rates.

For production deployment:
1. Choose appropriate API provider based on coverage and cost
2. Configure auto-refresh interval based on usage patterns
3. Monitor API usage and costs
4. Consider WebSocket implementation for high-traffic scenarios
5. Implement logging and monitoring for live data quality
