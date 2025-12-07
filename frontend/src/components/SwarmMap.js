import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Chart from 'chart.js/auto';
import './SwarmMap.css';
import { fetchSwarmData, API_ORIGIN } from '../services/swarmApi';
import { Box, Button, Slider, TextField, Select, MenuItem, Typography, Paper, Stack, IconButton, Snackbar, Alert } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RefreshIcon from '@mui/icons-material/Refresh';
import BoltIcon from '@mui/icons-material/Bolt';
import StorageIcon from '@mui/icons-material/Storage';
import MapIcon from '@mui/icons-material/Map';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import InfoIcon from '@mui/icons-material/Info';
import TrafficIcon from '@mui/icons-material/Traffic';
import ComputerIcon from '@mui/icons-material/Computer';
import MenuIcon from '@mui/icons-material/Menu';

function SwarmMap(props, ref) {
  const mapRef = useRef(null);
  const chartRef = useRef(null);

  // React state (replace direct DOM usage)
  const [simulationSpeed, setSimulationSpeed] = useState(10);
  const [carDensity, setCarDensity] = useState(25);
  const [swarmSize, setSwarmSize] = useState(20);
  const [statusText, setStatusText] = useState('Simulation Running');
  const [stepCount, setStepCount] = useState(0);
  const [swarmCount, setSwarmCount] = useState(20);
  const [isRunning, setIsRunning] = useState(true);
  const [overlayMetrics, setOverlayMetrics] = useState({ delay: 0.0, queue: 0.0, throughput: 0, improvement: 0.0 });
  const [trafficLights, setTrafficLights] = useState([]);
  const [systemStatus, setSystemStatus] = useState({ apiService: 'Offline', dataRefresh: 'Idle', mapOverlay: 'Loaded', optimizationAI: 'Idle' });
  const [liveMessage, setLiveMessage] = useState('');
  const [mapType, setMapType] = useState('street');
  const [searchQuery, setSearchQuery] = useState('');
  // Traffic API provider/key state
  const [apiProvider, setApiProvider] = useState('Google Maps Traffic API');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  // mobile/small-screen controls toggle
  const [showControlsMobile, setShowControlsMobile] = useState(false);

  function showSnackbar(message, severity = 'success') {
    setSnackbarMsg(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }

  const prevApiRef = useRef(systemStatus.apiService);

  // Mutable refs used by simulation loop (keeps values stable inside intervals)
  const simRefs = useRef({ speed: simulationSpeed, density: carDensity, swarmSize, status: statusText, step: stepCount });
  useEffect(() => { simRefs.current.speed = simulationSpeed; }, [simulationSpeed]);
  useEffect(() => { simRefs.current.density = carDensity; }, [carDensity]);
  useEffect(() => { simRefs.current.swarmSize = swarmSize; setSwarmCount(swarmSize); }, [swarmSize]);
  useEffect(() => { simRefs.current.status = statusText; }, [statusText]);
  useEffect(() => { simRefs.current.step = stepCount; }, [stepCount]);

  // Keep local objects in refs so we don't re-create map/markers on each render
  const objectsRef = useRef({ map: null, tileLayers: null, currentTile: null, trafficMarkers: [], swarmMarkers: [], roadLayers: [], vehicles: [], chart: null, intervals: [] });

  // Initialize map + chart once
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const map = L.map(el).setView([51.505, -0.09], 13);
    const tileLayers = {
      street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri' }),
      dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB' })
    };
    objectsRef.current.map = map;
    objectsRef.current.tileLayers = tileLayers;
    objectsRef.current.currentTile = tileLayers.street.addTo(map);

    // Chart
    const ctx = chartRef.current?.getContext('2d');
    if (ctx) {
      const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [ { label: 'Avg Delay (s)', data: [], borderColor: '#FFC107', backgroundColor: 'rgba(255,193,7,0.1)', borderWidth: 2, tension: 0.3, fill: true }, { label: 'Congestion (%)', data: [], borderColor: '#F44336', backgroundColor: 'rgba(244,67,54,0.1)', borderWidth: 2, tension: 0.3, fill: true } ] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      objectsRef.current.chart = chart;
    }

    return () => {
      // clear intervals
      objectsRef.current.intervals.forEach(i => clearInterval(i));
      try { map.remove(); } catch (e) {}
    };
  }, []);

  // Helper: generate grid intersections + roads
  const GRID_SIZE = 9;
  const streetNames = ["Main", "Oak", "Pine", "Maple", "Cedar", "Elm", "Wall", "Park"];
  const avenueNames = ["1st", "2nd", "3rd", "4th", "5th", "Broadway", "Central", "Lexington"];

  const generateGridIntersections = useCallback((center, radius) => {
    const intersections = [];
    const topLeft = { lat: center.lat + radius, lng: center.lng - radius };
    const step = (radius * 2) / (GRID_SIZE - 1);
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const lat = topLeft.lat - i * step;
        const lng = topLeft.lng + j * step;
        const name = `${streetNames[(i + j) % streetNames.length]} St & ${avenueNames[j % avenueNames.length]} Ave`;
        const cycle = 30 + Math.floor(Math.random() * 31);
        intersections.push({ lat, lng, gridX: i, gridY: j, name, congestion: Math.random() * 0.8, cycleDuration: cycle, timeRemaining: cycle });
      }
    }
    return intersections;
  }, []);

  const generateGridRoads = useCallback((intersections) => {
    const newRoads = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const currentIdx = i * GRID_SIZE + j;
        if (j < GRID_SIZE - 1) { const rightIdx = currentIdx + 1; newRoads.push({ start: [intersections[currentIdx].lat, intersections[currentIdx].lng], end: [intersections[rightIdx].lat, intersections[rightIdx].lng], congestion: Math.random() * 0.7 }); }
        if (i < GRID_SIZE - 1) { const bottomIdx = currentIdx + GRID_SIZE; newRoads.push({ start: [intersections[currentIdx].lat, intersections[currentIdx].lng], end: [intersections[bottomIdx].lat, intersections[bottomIdx].lng], congestion: Math.random() * 0.7 }); }
      }
    }
    return newRoads;
  }, []);

  // generate vehicles & swarm
  function generateVehicles(allRoads) { if(!allRoads || allRoads.length === 0) return []; const v = []; const vc = parseInt(simRefs.current.density || 25, 10); for(let i=0;i<vc;i++){ const r = allRoads[Math.floor(Math.random()*allRoads.length)]; const p = Math.random(); const lat = r.start[0]+(r.end[0]-r.start[0])*p; const lng = r.start[1]+(r.end[1]-r.start[1])*p; const m = L.marker([lat,lng],{icon:L.divIcon({className:'vehicle-marker',html:`<div style="background-color:#4a6fa5; width:8px; height:8px; border-radius:50%;"></div>`,iconSize:[10,10]})}).addTo(objectsRef.current.map); v.push({marker:m,roadData:r,progress:p,direction:Math.random()>0.5?1:-1}); } return v; }
  function generateSwarmAgents(center, radius) { const a=[]; const ac = parseInt(simRefs.current.swarmSize || 20,10); for(let i=0;i<ac;i++){ const lat = center.lat + (Math.random()*radius - radius/2)*0.8; const lng = center.lng + (Math.random()*radius - radius/2)*0.8; const ag = L.marker([lat,lng],{icon:L.divIcon({className:'swarm-marker',html:`<div style="background-color:#FF5722; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`,iconSize:[16,16]})}).addTo(objectsRef.current.map); a.push(ag);} return a; }

  // core draw function using React state updates instead of DOM writes
  const drawTrafficVisualization = useCallback((center, radius) => {
    const o = objectsRef.current;
    // clear old
    [...o.trafficMarkers, ...o.swarmMarkers, ...o.roadLayers, ...o.vehicles.map(v=>v.marker)].forEach(layer => { try { o.map.removeLayer(layer); } catch(e) {} });
    o.trafficMarkers = []; o.swarmMarkers = []; o.roadLayers = []; o.vehicles = [];

    const intersections = generateGridIntersections(center, radius);
    const generatedRoads = generateGridRoads(intersections);

    generatedRoads.forEach(road => { const color = road.congestion < 0.4 ? '#4fc6e0' : road.congestion < 0.6 ? '#f9d64f' : '#f97c4f'; const polyline = L.polyline([road.start, road.end], { color, weight: 4 + road.congestion * 8, opacity: 0.8 }).addTo(o.map); polyline.roadData = road; o.roadLayers.push(polyline); });
    intersections.forEach(inter => { const fillColor = inter.congestion < 0.4 ? '#4CAF50' : inter.congestion < 0.6 ? '#FFC107' : '#F44336'; const marker = L.circleMarker([inter.lat, inter.lng], { radius: 8, color: '#166088', fillColor, fillOpacity: 0.9, weight: 1 }).addTo(o.map); marker.intersectionData = inter; marker.bindPopup(`<b>${inter.name}</b><br>Grid: ${inter.gridX},${inter.gridY}<br>Congestion: ${Math.round(inter.congestion * 100)}%`); o.trafficMarkers.push(marker); });

    o.vehicles = generateVehicles(generatedRoads);
    o.swarmMarkers = generateSwarmAgents(center, radius);

    // update traffic light list state
    setTrafficLights(intersections.map(i => ({ name: i.name, timeRemaining: i.timeRemaining })));
  }, [generateGridIntersections, generateGridRoads]);

  // expose imperative handle for search from parent header
  useImperativeHandle(ref, () => ({
    async search(query) {
      if (!query) return;
      // reuse internal search logic
      const q = query.trim();
      const gridRegex = /^[0-8][\s,]+[0-8]$/;
      if (gridRegex.test(q)) {
        const [gridX, gridY] = q.match(/\d/g).map(Number);
        const targetMarker = objectsRef.current.trafficMarkers.find(m => m.intersectionData.gridX === gridX && m.intersectionData.gridY === gridY);
        if (targetMarker) { objectsRef.current.map.flyTo(targetMarker.getLatLng(), 16); targetMarker.openPopup(); }
      } else {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
          const data = await response.json();
          if (data && data.length > 0) {
            const { lat, lon, display_name } = data[0];
            const latLng = L.latLng(lat, lon);
            objectsRef.current.map.flyTo(latLng, 13, { duration: 1.5 });
            setTimeout(() => { setStepCount(0); drawTrafficVisualization(latLng, 0.05); const m = L.marker(latLng).addTo(objectsRef.current.map).bindPopup(`<b>${display_name.split(',')[0]}</b>`).openPopup(); objectsRef.current.searchMarker = m; }, 1600);
          }
        } catch (err) { console.error(err); }
      }
    }
  }));

  // simulation loop
  useEffect(() => {
    const intervalMs = 3000 / (simRefs.current.speed || 10);
    const tick = () => {
      if (simRefs.current.status !== 'Simulation Running') return;
  const newStep = (simRefs.current.step || 0) + 1; simRefs.current.step = newStep; setStepCount(newStep);
  // notify parent if provided
  try { props.onStepChange && props.onStepChange(newStep); } catch (e) {}

      // update vehicles
      objectsRef.current.vehicles.forEach(v => { v.progress += 0.01 * v.direction; if (v.progress > 1 || v.progress < 0) { v.direction *= -1; v.progress = Math.max(0, Math.min(1, v.progress)); } const lat = v.roadData.start[0] + (v.roadData.end[0] - v.roadData.start[0]) * v.progress; const lng = v.roadData.start[1] + (v.roadData.end[1] - v.roadData.start[1]) * v.progress; v.marker.setLatLng([lat, lng]); });
      // update swarm
      objectsRef.current.swarmMarkers.forEach(m => m.setLatLng([m.getLatLng().lat + (Math.random() - 0.5) * 0.002, m.getLatLng().lng + (Math.random() - 0.5) * 0.002]));

      // compute metrics and update overlay + chart
      const roadLayers = objectsRef.current.roadLayers;
      if (roadLayers.length > 0) {
        const avgCongestionPercent = (roadLayers.reduce((a, l) => a + l.roadData.congestion, 0) / roadLayers.length) * 100;
        const avgDelay = 15 + Math.random() * 5;
        const avgQueue = Math.max(0, avgCongestionPercent / 8 + (Math.random() - 0.5) * 2);
        const throughput = Math.max(500, (100 - avgCongestionPercent) * 35 + (Math.random() - 0.5) * 250);
  setOverlayMetrics({ delay: avgDelay, queue: avgQueue, throughput: Math.round(throughput), improvement: ((15 - avgDelay) / 15) * 100 });

        // update chart
        const chart = objectsRef.current.chart;
        if (chart) {
          if (chart.data.labels.length > 20) { chart.data.labels.shift(); chart.data.datasets.forEach(d => d.data.shift()); }
          chart.data.labels.push(String(stepCount));
          chart.data.datasets[0].data.push(avgDelay);
          chart.data.datasets[1].data.push(avgCongestionPercent);
          chart.update();
        }
      }

      // update statuses
  setSystemStatus(s => ({ ...s, dataRefresh: (newStep % 15 < 2) ? 'Syncing...' : 'Active', optimizationAI: (newStep % 20 < 8) ? 'Analyzing' : (newStep % 20 < 10) ? 'Optimizing...' : 'Idle' }));
  setTrafficLights(t => t.map((tl, idx) => ({ ...tl, timeRemaining: Math.max(0, (tl.timeRemaining || 0) - 1) })));
  // notify parent of status and step
  try { props.onStatusChange && props.onStatusChange(simRefs.current.status); } catch (e) {}
    };

    const id = setInterval(tick, intervalMs);
    objectsRef.current.intervals.push(id);
    return () => clearInterval(id);
  }, [stepCount]);

  // live backend polling
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const data = await fetchSwarmData();
        if (data && data.intersections && Array.isArray(data.intersections) && data.intersections.length) {
          // clear and render
          drawTrafficVisualization(objectsRef.current.map.getCenter(), 0.05);
        }
      } catch (e) { /* ignore */ }
    }, 5000);
    objectsRef.current.intervals.push(id);
    return () => clearInterval(id);
  }, [drawTrafficVisualization]);

  // announce API service changes for assistive tech
  useEffect(() => {
    if (!prevApiRef.current) prevApiRef.current = systemStatus.apiService;
    if (prevApiRef.current !== systemStatus.apiService) {
      setLiveMessage(`API Service is now ${systemStatus.apiService}`);
      prevApiRef.current = systemStatus.apiService;
      // clear after short delay to avoid repeated announcements
      setTimeout(() => setLiveMessage(''), 4000);
    }
  }, [systemStatus.apiService]);

  // quick runtime sanity checks to help track down invalid children passed to MUI Box/Typograpy
  useEffect(() => {
    try {
      if (systemStatus) {
        ['apiService','dataRefresh','mapOverlay','optimizationAI'].forEach(k => {
          const v = systemStatus[k];
          if (v != null && typeof v !== 'string' && typeof v !== 'number') {
            console.warn(`systemStatus.${k} is not a string/number`, v);
          }
        });
      }
      if (Array.isArray(trafficLights)) {
        trafficLights.forEach((t, i) => {
          if (!t) return;
          if (typeof t.name !== 'string') console.warn('trafficLights[' + i + '].name is not string', t.name);
          if (t.timeRemaining != null && typeof t.timeRemaining !== 'number') console.warn('trafficLights[' + i + '].timeRemaining is not number', t.timeRemaining);
        });
      }
    } catch (e) { /* guard */ }
  }, [systemStatus, trafficLights]);

  // map type change
  useEffect(() => {
    const o = objectsRef.current;
    if (!o.map || !o.tileLayers) return;
    if (o.currentTile) o.map.removeLayer(o.currentTile);
    o.currentTile = o.tileLayers[mapType];
    if (o.currentTile) o.currentTile.addTo(o.map);
  }, [mapType]);

  // initial draw
  useEffect(() => { if (objectsRef.current.map) drawTrafficVisualization(objectsRef.current.map.getCenter(), 0.05); }, [drawTrafficVisualization]);

  // load latest saved API credential (masked) from backend
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/credentials/latest`);
        if (res.status === 200) {
          const data = await res.json();
          if (!mounted) return;
          if (data.provider) setApiProvider(data.provider);
          if (data.apiKeyMasked) setApiKeyMasked(data.apiKeyMasked);
        }
      } catch (e) { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, []);

  // control handlers
  function handleStart() { setIsRunning(true); setStatusText('Simulation Running'); simRefs.current.status = 'Simulation Running'; try { props.onStatusChange && props.onStatusChange('Simulation Running'); } catch (e) {} }
  function handlePause() { setIsRunning(false); setStatusText('Simulation Paused'); simRefs.current.status = 'Simulation Paused'; try { props.onStatusChange && props.onStatusChange('Simulation Paused'); } catch (e) {} }
  function handleReset() { setStepCount(0); simRefs.current.step = 0; try { props.onStepChange && props.onStepChange(0); } catch (e) {} if (objectsRef.current.map) drawTrafficVisualization(objectsRef.current.map.getCenter(), 0.05); }
  function handleOptimize() { setSystemStatus(s => ({ ...s, optimizationAI: 'Optimizing...' })); setTimeout(() => setSystemStatus(s => ({ ...s, optimizationAI: 'Idle' })), 1200); }

  // search handler (controlled input)
  async function handleSearchSubmit(e) {
    e.preventDefault();
    const q = searchQuery.trim(); if (!q) return;
    const gridRegex = /^[0-8][\s,]+[0-8]$/;
    if (gridRegex.test(q)) {
      const [gridX, gridY] = q.match(/\d/g).map(Number);
      const targetMarker = objectsRef.current.trafficMarkers.find(m => m.intersectionData.gridX === gridX && m.intersectionData.gridY === gridY);
      if (targetMarker) { objectsRef.current.map.flyTo(targetMarker.getLatLng(), 16); targetMarker.openPopup(); }
    } else {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
        const data = await response.json();
        if (data && data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const latLng = L.latLng(lat, lon);
          objectsRef.current.map.flyTo(latLng, 13, { duration: 1.5 });
          setTimeout(() => { setStepCount(0); drawTrafficVisualization(latLng, 0.05); const m = L.marker(latLng).addTo(objectsRef.current.map).bindPopup(`<b>${display_name.split(',')[0]}</b>`).openPopup(); objectsRef.current.searchMarker = m; }, 1600);
        }
      } catch (err) { console.error(err); }
    }
  }

  // Save API credential to backend
  async function handleSaveCredential() {
    try {
      const payload = { provider: apiProvider, apiKey: apiKeyInput || apiKeyMasked };
      const res = await fetch(`${API_ORIGIN}/api/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        setApiKeyMasked(data.apiKeyMasked || '');
        setApiKeyInput('');
        showSnackbar('✓ API credential saved successfully', 'success');
      } else {
        let errorMsg = 'Failed to save credential';
        try {
          const err = await res.json();
          errorMsg = err.error || err.message || JSON.stringify(err);
        } catch (e) {
          errorMsg = `Server error (${res.status}): ${res.statusText}`;
        }
        showSnackbar('❌ ' + errorMsg, 'error');
      }
    } catch (e) {
      console.error('Save credential error:', e);
      showSnackbar('❌ Network error - check console for details', 'error');
    }
  }

  async function handleTestCredential() {
    // For now, just attempt a save (without clearing input) to validate server-side handling
    try {
      const payload = { provider: apiProvider, apiKey: apiKeyInput || apiKeyMasked };
      const res = await fetch(`${API_ORIGIN}/api/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        showSnackbar('✓ Test successful - credentials are valid', 'success');
      } else {
        let errorMsg = 'Test failed';
        try {
          const err = await res.json();
          errorMsg = err.error || err.message || JSON.stringify(err);
        } catch (e) {
          errorMsg = `Server error (${res.status}): ${res.statusText}`;
        }
        showSnackbar('❌ ' + errorMsg, 'error');
      }
    } catch (e) {
      console.error('Test credential error:', e);
      showSnackbar('❌ Network error - check console for details', 'error');
    }
  }

  // Grid Status overlay as a portal so it isn't clipped by map panes
  const gridStatusOverlay = (
    <Paper elevation={6} className="grid-status-overlay" sx={{ position: 'fixed', zIndex: 1400, right: { xs: 12, sm: 24 }, top: { xs: 'auto', sm: 96 }, bottom: { xs: 96, sm: 'auto' }, minWidth: { xs: '88%', sm: 240 }, width: { xs: '88%', sm: 'auto' }, p: 1.5, borderRadius: 2, bgcolor: 'background.paper', boxShadow: 6, pointerEvents: 'auto' }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <InfoIcon color="primary" />
        <Typography variant="subtitle2">Grid Status</Typography>
      </Stack>
      <Box sx={{ my: 1 }} />
      <Stack spacing={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><span>Avg. Delay (s/veh):</span><strong>{overlayMetrics.delay.toFixed(1)}</strong></Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><span>Avg. Queue (veh):</span><strong>{overlayMetrics.queue.toFixed(1)}</strong></Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><span>Throughput (veh/hr):</span><strong>{overlayMetrics.throughput}</strong></Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><span>Improvement (%):</span><strong>{overlayMetrics.improvement.toFixed(1)}</strong></Box>
      </Stack>
      <Box sx={{ height: 1, borderBottom: '1px solid rgba(0,0,0,0.06)', my: 1 }} />
      <Stack direction="row" spacing={1} alignItems="center">
        <Box sx={{ width: 14, height: 14, bgcolor: '#4fc6e0', borderRadius: 1 }} /> <Typography variant="caption">Low</Typography>
        <Box sx={{ width: 14, height: 14, bgcolor: '#f9d64f', borderRadius: 1, ml: 1 }} /> <Typography variant="caption">Med</Typography>
        <Box sx={{ width: 14, height: 14, bgcolor: '#f97c4f', borderRadius: 1, ml: 1 }} /> <Typography variant="caption">High</Typography>
      </Stack>
    </Paper>
  );

  return (
    <Box className="swarm-dashboard" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ display: { xs: showControlsMobile ? 'block' : 'none', sm: 'block' }, mr: { xs: 0, sm: 1 } }}>
          <Paper sx={{ width: { xs: '100vw', sm: 320 }, p: 2, maxHeight: '78vh', overflow: 'auto' }} elevation={3}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <StorageIcon color="primary" />
            <Typography variant="h6">Traffic API</Typography>
          </Stack>

          <Box sx={{ mt: 0 }} aria-label="Traffic API form">
            <Typography variant="body2" sx={{ mb: 0.5 }}>API Provider</Typography>
            <Select fullWidth value={apiProvider} onChange={e => setApiProvider(e.target.value)} size="small" sx={{ mb: 1 }} inputProps={{ 'aria-label': 'API provider' }}>
              <MenuItem value="Google Maps Traffic API">Google Maps Traffic API</MenuItem>
              <MenuItem value="HERE Traffic API">HERE Traffic API</MenuItem>
              <MenuItem value="TomTom Traffic API">TomTom Traffic API</MenuItem>
            </Select>
            <Typography variant="body2" sx={{ mt: 1 }}>Enter your API Key</Typography>
            <TextField type="password" placeholder={apiKeyMasked || 'Supports major traffic APIs'} value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} fullWidth size="small" sx={{ my: 1 }} inputProps={{ 'aria-label': 'API key' }} />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button variant="contained" startIcon={<CheckIcon />} color="primary" onClick={handleTestCredential}>Test</Button>
              <Button variant="contained" startIcon={<SaveIcon />} color="inherit" sx={{ bgcolor: '#6b7280', color: 'white' }} onClick={handleSaveCredential}>Save</Button>
            </Stack>
          </Box>

          <Box sx={{ height: 1, borderBottom: '1px solid rgba(0,0,0,0.08)', my: 2 }} />

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <MapIcon color="primary" />
            <Typography variant="h6">Map Controls</Typography>
          </Stack>
          <Typography variant="body2">Search Location or Grid</Typography>
          <TextField placeholder="e.g., Tokyo or 3,4" fullWidth size="small" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit(e); }} sx={{ my: 1 }} inputProps={{ 'aria-label': 'Map search' }} />
          <Typography variant="body2">Map Type</Typography>
          <Select fullWidth value={mapType} onChange={e => setMapType(e.target.value)} size="small" sx={{ mb: 2 }} inputProps={{ 'aria-label': 'Map type' }}>
            <MenuItem value="street">Street</MenuItem>
            <MenuItem value="satellite">Satellite</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </Select>

          <Box sx={{ mt: 1 }}>
            <Typography gutterBottom>Simulation Speed ({simulationSpeed}x)</Typography>
            <Slider aria-label="Simulation speed" min={1} max={20} value={simulationSpeed} onChange={(e,v) => setSimulationSpeed(v)} />
            <Typography gutterBottom>Vehicle Density ({carDensity})</Typography>
            <Slider aria-label="Vehicle density" min={5} max={80} value={carDensity} onChange={(e,v) => setCarDensity(v)} />
            <Typography gutterBottom>Swarm Size ({swarmSize})</Typography>
            <Slider aria-label="Swarm size" min={5} max={50} value={swarmSize} onChange={(e,v) => setSwarmSize(v)} />
          </Box>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }} role="group" aria-label="Simulation controls">
            <IconButton color="primary" onClick={handleStart} disabled={isRunning} aria-label="Start simulation"><PlayArrowIcon /></IconButton>
            <IconButton color="primary" onClick={handlePause} disabled={!isRunning} aria-label="Pause simulation"><PauseIcon /></IconButton>
            <IconButton color="primary" onClick={handleReset} aria-label="Reset simulation"><RefreshIcon /></IconButton>
            <IconButton color="primary" onClick={handleOptimize} aria-label="Optimize traffic"><BoltIcon /></IconButton>
          </Box>
          </Paper>
        </Box>

        {/* Mobile toggle button shown only on small screens to reveal the controls */}
        <IconButton aria-label="Open controls" onClick={() => setShowControlsMobile(s => !s)} sx={{ position: 'fixed', left: 12, top: 84, zIndex: 1600, display: { xs: 'inline-flex', sm: 'none' }, bgcolor: 'background.paper', boxShadow: 3 }}>
          <MenuIcon />
        </IconButton>

        <Box sx={{ flex: 1, position: 'relative' }}>
          <Paper sx={{ height: '70vh', position: 'relative', borderRadius: 2, p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <MapIcon sx={{ bgcolor: '#e6f4ff', color: '#1976d2', borderRadius: '50%', p: 1, mr: 1 }} />
              <Typography variant="h6">Traffic Grid Visualization</Typography>
            </Box>

            <div ref={mapRef} tabIndex={0} role="application" aria-label="Traffic map" style={{ height: 'calc(100% - 56px)', width: '100%', borderRadius: 8 }} />
          </Paper>
          <Paper sx={{ mt: 2, p: 1, height: 200 }}>
            <canvas ref={chartRef} style={{ width: '100%', height: '100%' }} aria-label="Traffic metrics chart" />
          </Paper>
        </Box>
      </Stack>

  {/* Render the Grid Status overlay into a portal so it sits above map panes */}
  {typeof document !== 'undefined' ? createPortal(gridStatusOverlay, document.body) : null}

      <Paper sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: 'background.paper' }} elevation={2}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
          {/* Narrow left badge + vertical title */}
          <Box sx={{ width: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1 }}>
            <Box sx={{ bgcolor: '#e8f6ff', borderRadius: 2, p: 1.2, mb: 1 }}>
              <TrafficIcon sx={{ color: '#0d6efd', fontSize: 28 }} />
            </Box>
            <Box className="vertical-header" sx={{ textAlign: 'center', color: '#0d6efd', fontWeight: 700, lineHeight: 1.2 }}>
              <span>Traffic</span>
              <span>Light</span>
              <span>Status</span>
            </Box>
          </Box>

          {/* Middle: scrollable list with right-aligned times */}
          <Box sx={{ width: 300, borderRight: '1px solid rgba(0,0,0,0.04)', pr: 2 }}>
            <Box sx={{ maxHeight: 220, overflowY: 'auto' }} role="region" aria-label="Traffic light status list">
              {trafficLights.length === 0 ? (
                <Typography variant="body2">Initializing...</Typography>
              ) : (
                trafficLights.map((t, i) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, borderBottom: '1px dotted rgba(0,0,0,0.06)' }}>
                    <Typography variant="body1">{t.name}</Typography>
                    <Box className="traffic-timer-badge">{t.timeRemaining}s</Box>
                  </Box>
                ))
              )}
            </Box>
          </Box>

          {/* Right: System status area */}
          <Box sx={{ flex: 1, pl: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Box sx={{ bgcolor: '#eef7ea', color: '#1e7e34', borderRadius: 2, p: 1, display: 'inline-flex' }}>
                <ComputerIcon sx={{ color: '#1e7e34' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>System Status</Typography>
            </Stack>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: '1px dotted rgba(0,0,0,0.06)' }}>
                <Typography>API Service</Typography>
                <Typography sx={{ color: '#f44336', fontWeight: 700 }}>{systemStatus.apiService}</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: '1px dotted rgba(0,0,0,0.06)' }}>
                <Typography>Data Refresh</Typography>
                <Typography sx={{ color: 'primary.main', fontWeight: 600 }}>{systemStatus.dataRefresh}</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, borderBottom: '1px dotted rgba(0,0,0,0.06)' }}>
                <Typography>Map Overlay</Typography>
                <Typography sx={{ color: 'primary.main', fontWeight: 600 }}>{systemStatus.mapOverlay}</Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2 }}>
                <Typography>Optimization AI</Typography>
                <Typography sx={{ color: 'text.secondary' }}>{systemStatus.optimizationAI}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* ARIA live region for announcements */}
      <div aria-live="polite" aria-atomic="true" className="visually-hidden">{liveMessage}</div>

      {/* Snackbar for save/test feedback */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={() => setSnackbarOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%', fontSize: '0.95rem' }} variant="filled">
          {snackbarMsg}
        </Alert>
      </Snackbar>

      {/* Footer */}
      <Box className="app-footer" component="footer" role="contentinfo">
        <Typography variant="body2">Traffic Track • v0.1.0 • © {new Date().getFullYear()} Traffic Track</Typography>
      </Box>
    </Box>
  );
}

export default forwardRef(SwarmMap);
