import { API_BASE } from '../config/api';

export async function fetchVehicles() {
  try {
    const res = await fetch(`${API_BASE}/vehicles`);
    if (!res.ok) throw new Error('Fetch error');
    return res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function createVehicle(v) {
  try {
    const res = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(v)
    });
    return res.json();
  } catch (e) {
    console.error(e);
  }
}
