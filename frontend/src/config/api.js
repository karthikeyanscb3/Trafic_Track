// Centralized API configuration
// All API calls should use this configuration
// Automatically picks the correct URL based on environment
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Priority: 1. Env variable, 2. Production URL, 3. Local dev URL
export const API_ORIGIN = 
  process.env.REACT_APP_API_URL || 
  process.env.REACT_APP_API_BASE || 
  (isProduction ? 'https://trafictrack-backend.onrender.com' : 'http://localhost:8081');

export const API_BASE = `${API_ORIGIN}/api`;
