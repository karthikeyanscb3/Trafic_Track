export const API_ORIGIN = process.env.REACT_APP_API_BASE || 'http://localhost:8080';
const BASE = `${API_ORIGIN}/api`;

export async function fetchSwarmData() {
  try {
    const res = await fetch(`${BASE}/swarm`);
    if (!res.ok) throw new Error('Network error');
    return res.json();
  } catch (e) {
    // No live data available or error - caller should fallback to local simulation
    return null;
  }
}

export default { fetchSwarmData };
