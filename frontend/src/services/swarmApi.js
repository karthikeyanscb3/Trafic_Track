import { API_ORIGIN, API_BASE } from '../config/api';

export { API_ORIGIN };
const BASE = API_BASE;

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
