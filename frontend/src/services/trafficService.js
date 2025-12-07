import { API_BASE } from '../config/api';

/**
 * Service for fetching live traffic data from backend
 */

/**
 * Fetch live traffic data for a specific location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Radius in kilometers (default 5km)
 * @returns {Promise<Object>} Traffic data including congestion, speed, incidents
 */
export async function fetchLiveTrafficData(lat, lng, radius = 5.0) {
  try {
    const response = await fetch(
      `${API_BASE}/traffic/live?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching live traffic data:', error);
    return null;
  }
}

/**
 * Fetch live traffic data for a grid of locations
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @param {number} radius - Overall radius in km
 * @param {number} gridSize - Number of points per side (e.g., 3 = 3x3 grid = 9 points)
 * @returns {Promise<Object>} Grid traffic data with array of points
 */
export async function fetchGridTrafficData(centerLat, centerLng, radius = 5.0, gridSize = 9) {
  try {
    const response = await fetch(
      `${API_BASE}/traffic/grid?centerLat=${centerLat}&centerLng=${centerLng}&radius=${radius}&gridSize=${gridSize}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching grid traffic data:', error);
    return null;
  }
}

/**
 * Fetch live traffic data with auto-retry on failure
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} radius - Radius in kilometers
 * @param {number} maxRetries - Maximum number of retry attempts (default 3)
 * @returns {Promise<Object>} Traffic data or null
 */
export async function fetchLiveTrafficDataWithRetry(lat, lng, radius = 5.0, maxRetries = 3) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const data = await fetchLiveTrafficData(lat, lng, radius);
      if (data) {
        return data;
      }
    } catch (error) {
      console.warn(`Attempt ${attempts + 1} failed:`, error);
    }
    
    attempts++;
    if (attempts < maxRetries) {
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
    }
  }
  
  console.error('All retry attempts failed');
  return null;
}

/**
 * Transform backend traffic data to map visualization format
 * @param {Object} trafficData - Traffic data from backend
 * @returns {Object} Transformed data for map visualization
 */
export function transformTrafficDataForMap(trafficData) {
  if (!trafficData) return null;

  return {
    location: {
      lat: trafficData.latitude,
      lng: trafficData.longitude,
    },
    congestion: trafficData.congestionLevel || 0,
    speed: trafficData.flowSpeed || 0,
    freeFlowSpeed: trafficData.freeFlowSpeed || 50,
    travelTime: trafficData.currentTravelTime || 0,
    source: trafficData.dataSource || 'unknown',
    timestamp: trafficData.fetchedAt,
    hasIncidents: trafficData.incidents && trafficData.incidents.length > 0,
    incidents: trafficData.incidents || [],
  };
}

/**
 * Transform grid traffic data to intersections format
 * @param {Object} gridData - Grid traffic data from backend
 * @param {Array} existingIntersections - Existing intersections to update
 * @returns {Array} Updated intersections with live congestion data
 */
export function transformGridDataToIntersections(gridData, existingIntersections) {
  if (!gridData || !gridData.points) {
    return existingIntersections;
  }

  const updatedIntersections = existingIntersections.map(intersection => {
    // Find matching grid point
    const matchingPoint = gridData.points.find(
      point => point.gridX === intersection.gridX && point.gridY === intersection.gridY
    );

    if (matchingPoint) {
      return {
        ...intersection,
        congestion: matchingPoint.congestion || intersection.congestion,
        flowSpeed: matchingPoint.flowSpeed,
        dataSource: matchingPoint.dataSource,
        isLiveData: matchingPoint.dataSource !== 'static',
      };
    }

    return intersection;
  });

  return updatedIntersections;
}

/**
 * Calculate color based on congestion level
 * @param {number} congestion - Congestion level (0.0 to 1.0)
 * @returns {string} Hex color code
 */
export function getCongestionColor(congestion) {
  if (congestion < 0.3) return '#4CAF50'; // Green - Low congestion
  if (congestion < 0.5) return '#8BC34A'; // Light green
  if (congestion < 0.6) return '#FFC107'; // Yellow - Medium congestion
  if (congestion < 0.7) return '#FF9800'; // Orange
  if (congestion < 0.8) return '#FF5722'; // Deep orange
  return '#F44336'; // Red - High congestion
}

/**
 * Calculate road color based on congestion
 * @param {number} congestion - Congestion level (0.0 to 1.0)
 * @returns {string} Hex color code
 */
export function getRoadColor(congestion) {
  if (congestion < 0.4) return '#4fc6e0'; // Blue - Free flow
  if (congestion < 0.6) return '#f9d64f'; // Yellow - Moderate
  return '#f97c4f'; // Orange/Red - Congested
}

/**
 * Check if traffic data is stale (older than 5 minutes)
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean} True if data is stale
 */
export function isDataStale(timestamp) {
  if (!timestamp) return true;
  
  const dataTime = new Date(timestamp);
  const now = new Date();
  const ageMinutes = (now - dataTime) / (1000 * 60);
  
  return ageMinutes > 5;
}

/**
 * Auto-refresh traffic data at specified interval
 * @param {Function} fetchFunction - Function to fetch traffic data
 * @param {number} intervalMs - Refresh interval in milliseconds (default 5 minutes)
 * @returns {Object} Object with stop function to cancel auto-refresh
 */
export function setupAutoRefresh(fetchFunction, intervalMs = 300000) {
  // Initial fetch
  fetchFunction();
  
  // Set up interval
  const intervalId = setInterval(fetchFunction, intervalMs);
  
  // Return control object
  return {
    stop: () => clearInterval(intervalId),
    restart: () => {
      clearInterval(intervalId);
      return setupAutoRefresh(fetchFunction, intervalMs);
    },
  };
}

export default {
  fetchLiveTrafficData,
  fetchGridTrafficData,
  fetchLiveTrafficDataWithRetry,
  transformTrafficDataForMap,
  transformGridDataToIntersections,
  getCongestionColor,
  getRoadColor,
  isDataStale,
  setupAutoRefresh,
};
