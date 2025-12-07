import React, { useEffect, useState } from 'react';
import { fetchVehicles, createVehicle } from '../services/api';

export default function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [plate, setPlate] = useState('');
  const [speed, setSpeed] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const data = await fetchVehicles();
    setVehicles(data || []);
  }

  async function onAdd(e) {
    e.preventDefault();
    const v = { plate, speed: parseFloat(speed || 0) };
    await createVehicle(v);
    setPlate(''); setSpeed('');
    load();
  }

  return (
    <div>
      <form onSubmit={onAdd} style={{ marginBottom: 16 }}>
        <input placeholder="Plate" value={plate} onChange={e=>setPlate(e.target.value)} />
        <input placeholder="Speed" value={speed} onChange={e=>setSpeed(e.target.value)} style={{ marginLeft: 8 }} />
        <button type="submit" style={{ marginLeft: 8 }}>Add</button>
      </form>

      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>ID</th>
            <th>Plate</th>
            <th>Speed</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map(v => (
            <tr key={v.id}>
              <td>{v.id}</td>
              <td>{v.plate}</td>
              <td>{v.speed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
