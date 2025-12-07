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
    <Paper 
      elevation={0} 
      className="grid-status-overlay" 
      sx={{ 
        position: 'fixed', 
        zIndex: 1400, 
        right: { xs: 8, sm: 24 }, 
        left: { xs: 8, sm: 'auto' },
        top: { xs: 'auto', sm: 96 }, 
        bottom: { xs: 96, sm: 'auto' }, 
        width: { xs: 'calc(100% - 16px)', sm: 260 }, 
        maxWidth: { xs: '100%', sm: 260 },
        borderRadius: { xs: 2, sm: 3 },
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        pointerEvents: 'auto',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)'
      }}
    >
      {/* Header Section */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #4a6fa5 0%, #166088 100%)',
        p: { xs: 1, sm: 1.5 },
        color: 'white'
      }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ 
            bgcolor: 'rgba(255,255,255,0.2)',
            borderRadius: 1.5,
            p: { xs: 0.6, sm: 0.8 },
            display: 'flex'
          }}>
            <InfoIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
            Grid Status
          </Typography>
        </Stack>
      </Box>

      {/* Metrics Section */}
      <Box sx={{ p: { xs: 0.8, sm: 1 }, bgcolor: '#fafbfc' }}>
        <Stack spacing={{ xs: 0.6, sm: 0.8 }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            p: { xs: 0.6, sm: 0.8 },
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.15)',
              transform: 'translateY(-1px)'
            }
          }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.8rem' }, flex: 1 }}>
              ⏱️ Avg. Delay
            </Typography>
            <Box sx={{ 
              bgcolor: '#e8f4ff',
              color: '#4a6fa5',
              px: { xs: 1, sm: 1.5 },
              py: { xs: 0.3, sm: 0.5 },
              borderRadius: 1,
              fontWeight: 700,
              fontSize: { xs: '0.75rem', sm: '0.9rem' },
              whiteSpace: 'nowrap'
            }}>
              {overlayMetrics.delay.toFixed(1)} s/veh
            </Box>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            p: { xs: 0.6, sm: 0.8 },
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.15)',
              transform: 'translateY(-1px)'
            }
          }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.8rem' }, flex: 1 }}>
              🚗 Avg. Queue
            </Typography>
            <Box sx={{ 
              bgcolor: '#fff7ed',
              color: '#ea580c',
              px: { xs: 1, sm: 1.5 },
              py: { xs: 0.3, sm: 0.5 },
              borderRadius: 1,
              fontWeight: 700,
              fontSize: { xs: '0.75rem', sm: '0.9rem' },
              whiteSpace: 'nowrap'
            }}>
              {overlayMetrics.queue.toFixed(1)} veh
            </Box>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            p: { xs: 0.6, sm: 0.8 },
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.15)',
              transform: 'translateY(-1px)'
            }
          }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.8rem' }, flex: 1 }}>
              📊 Throughput
            </Typography>
            <Box sx={{ 
              bgcolor: '#f0fdf4',
              color: '#16a34a',
              px: { xs: 1, sm: 1.5 },
              py: { xs: 0.3, sm: 0.5 },
              borderRadius: 1,
              fontWeight: 700,
              fontSize: { xs: '0.75rem', sm: '0.9rem' },
              whiteSpace: 'nowrap'
            }}>
              {overlayMetrics.throughput} veh/hr
            </Box>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            p: { xs: 0.6, sm: 0.8 },
            bgcolor: 'white',
            borderRadius: 1,
            border: '1px solid rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.15)',
              transform: 'translateY(-1px)'
            }
          }}>
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500, fontSize: { xs: '0.7rem', sm: '0.8rem' }, flex: 1 }}>
              📈 Improvement
            </Typography>
            <Box sx={{ 
              bgcolor: '#f0f9ff',
              color: '#0284c7',
              px: { xs: 1, sm: 1.5 },
              py: { xs: 0.3, sm: 0.5 },
              borderRadius: 1,
              fontWeight: 700,
              fontSize: { xs: '0.75rem', sm: '0.9rem' },
              whiteSpace: 'nowrap'
            }}>
              {overlayMetrics.improvement.toFixed(1)}%
            </Box>
          </Box>
        </Stack>
      </Box>

      {/* Legend Section - Hidden to reduce height */}
      <Box sx={{ 
        display: 'none'
      }}>
        <Typography variant="caption" sx={{ 
          color: '#64748b', 
          fontWeight: 600, 
          textTransform: 'uppercase',
          fontSize: { xs: '0.65rem', sm: '0.7rem' },
          letterSpacing: 0.5,
          mb: 1,
          display: 'block'
        }}>
          Traffic Density
        </Typography>
        <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="center" justifyContent="space-around">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.8 } }}>
            <Box sx={{ 
              width: { xs: 14, sm: 18 }, 
              height: { xs: 14, sm: 18 }, 
              bgcolor: '#4fc6e0', 
              borderRadius: 1,
              boxShadow: '0 2px 4px rgba(79, 198, 224, 0.3)'
            }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Low
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.8 } }}>
            <Box sx={{ 
              width: { xs: 14, sm: 18 }, 
              height: { xs: 14, sm: 18 }, 
              bgcolor: '#f9d64f', 
              borderRadius: 1,
              boxShadow: '0 2px 4px rgba(249, 214, 79, 0.3)'
            }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Med
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 0.8 } }}>
            <Box sx={{ 
              width: { xs: 14, sm: 18 }, 
              height: { xs: 14, sm: 18 }, 
              bgcolor: '#f97c4f', 
              borderRadius: 1,
              boxShadow: '0 2px 4px rgba(249, 124, 79, 0.3)'
            }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#475569', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              High
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );

  return (
    <Box className="swarm-dashboard" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Box sx={{ display: { xs: showControlsMobile ? 'block' : 'none', sm: 'block' }, mr: { xs: 0, sm: 1 } }}>
          <Paper sx={{ 
            width: { xs: '100vw', sm: 340 }, 
            height: 'calc(70vh + 232px)', 
            overflowY: 'auto', 
            overflowX: 'hidden',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { 
              background: 'rgba(0,0,0,0.15)', 
              borderRadius: '4px',
              '&:hover': { background: 'rgba(0,0,0,0.25)' }
            }
          }} elevation={0}>
          
          {/* Traffic API Section */}
          <Box sx={{ 
            background: 'linear-gradient(135deg, #4a6fa5 0%, #166088 100%)',
            p: 2,
            mb: 2,
            borderRadius: '12px 12px 0 0'
          }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 2,
                p: 1,
                display: 'flex'
              }}>
                <StorageIcon sx={{ color: 'white', fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
                  Traffic API
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem' }}>
                  Configure data source
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box sx={{ px: 2, pb: 2 }} aria-label="Traffic API form">
            <Box sx={{ 
              bgcolor: '#f8fafc',
              borderRadius: 2,
              p: 2,
              mb: 2,
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                API Provider
              </Typography>
              <Select 
                fullWidth 
                value={apiProvider} 
                onChange={e => setApiProvider(e.target.value)} 
                size="small" 
                sx={{ 
                  mb: 1.5,
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.1)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4a6fa5' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4a6fa5', borderWidth: '2px' }
                }} 
                inputProps={{ 'aria-label': 'API provider' }}
              >
                <MenuItem value="Google Maps Traffic API">🗺️ Google Maps Traffic API</MenuItem>
                <MenuItem value="HERE Traffic API">📍 HERE Traffic API</MenuItem>
                <MenuItem value="TomTom Traffic API">🚗 TomTom Traffic API</MenuItem>
              </Select>
              
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                API Key
              </Typography>
              <TextField 
                type="password" 
                placeholder={apiKeyMasked || 'Enter your API key'} 
                value={apiKeyInput} 
                onChange={e => setApiKeyInput(e.target.value)} 
                fullWidth 
                size="small" 
                sx={{ 
                  mb: 1.5,
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(0,0,0,0.1)' },
                    '&:hover fieldset': { borderColor: '#4a6fa5' },
                    '&.Mui-focused fieldset': { borderColor: '#4a6fa5', borderWidth: '2px' }
                  }
                }} 
                inputProps={{ 'aria-label': 'API key' }} 
              />
              
              <Stack direction="row" spacing={1}>
                <Button 
                  variant="contained" 
                  startIcon={<CheckIcon />} 
                  onClick={handleTestCredential}
                  sx={{ 
                    flex: 1,
                    bgcolor: '#4a6fa5',
                    '&:hover': { bgcolor: '#3a5a85' },
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(74, 111, 165, 0.3)'
                  }}
                >
                  Test
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<SaveIcon />} 
                  onClick={handleSaveCredential}
                  sx={{ 
                    flex: 1,
                    bgcolor: '#166088',
                    '&:hover': { bgcolor: '#0d4a6a' },
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(22, 96, 136, 0.3)'
                  }}
                >
                  Save
                </Button>
              </Stack>
            </Box>

            {/* Map Controls Section */}
            <Box sx={{ 
              bgcolor: '#f8fafc',
              borderRadius: 2,
              p: 2,
              mb: 2,
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ 
                  bgcolor: '#e8f4ff',
                  borderRadius: 1.5,
                  p: 0.8,
                  display: 'flex'
                }}>
                  <MapIcon sx={{ color: '#4a6fa5', fontSize: 22 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                  Map Controls
                </Typography>
              </Stack>
              
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                Search Location or Grid
              </Typography>
              <TextField 
                placeholder="e.g., Tokyo or 3,4" 
                fullWidth 
                size="small" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit(e); }} 
                sx={{ 
                  mb: 1.5,
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(0,0,0,0.1)' },
                    '&:hover fieldset': { borderColor: '#4a6fa5' },
                    '&.Mui-focused fieldset': { borderColor: '#4a6fa5', borderWidth: '2px' }
                  }
                }} 
                inputProps={{ 'aria-label': 'Map search' }} 
              />
              
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                Map Type
              </Typography>
              <Select 
                fullWidth 
                value={mapType} 
                onChange={e => setMapType(e.target.value)} 
                size="small" 
                sx={{ 
                  mb: 0.5,
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0,0,0,0.1)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4a6fa5' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4a6fa5', borderWidth: '2px' }
                }} 
                inputProps={{ 'aria-label': 'Map type' }}
              >
                <MenuItem value="street">🗺️ Street View</MenuItem>
                <MenuItem value="satellite">🛰️ Satellite</MenuItem>
                <MenuItem value="dark">🌙 Dark Mode</MenuItem>
              </Select>
            </Box>

            {/* Simulation Settings Section */}
            <Box sx={{ 
              bgcolor: '#f8fafc',
              borderRadius: 2,
              p: 2,
              mb: 2,
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>
                ⚙️ Simulation Settings
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                    Simulation Speed
                  </Typography>
                  <Box sx={{ 
                    bgcolor: '#4a6fa5',
                    color: 'white',
                    px: 1.5,
                    py: 0.3,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}>
                    {simulationSpeed}x
                  </Box>
                </Stack>
                <Slider 
                  aria-label="Simulation speed" 
                  min={1} 
                  max={20} 
                  value={simulationSpeed} 
                  onChange={(e,v) => setSimulationSpeed(v)} 
                  sx={{ 
                    color: '#4a6fa5',
                    '& .MuiSlider-thumb': {
                      boxShadow: '0 2px 8px rgba(74, 111, 165, 0.3)'
                    }
                  }} 
                />
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                    Vehicle Density
                  </Typography>
                  <Box sx={{ 
                    bgcolor: '#166088',
                    color: 'white',
                    px: 1.5,
                    py: 0.3,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}>
                    {carDensity}
                  </Box>
                </Stack>
                <Slider 
                  aria-label="Vehicle density" 
                  min={5} 
                  max={80} 
                  value={carDensity} 
                  onChange={(e,v) => setCarDensity(v)} 
                  sx={{ 
                    color: '#166088',
                    '& .MuiSlider-thumb': {
                      boxShadow: '0 2px 8px rgba(22, 96, 136, 0.3)'
                    }
                  }} 
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                    Swarm Size
                  </Typography>
                  <Box sx={{ 
                    bgcolor: '#4fc6e0',
                    color: 'white',
                    px: 1.5,
                    py: 0.3,
                    borderRadius: 1,
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}>
                    {swarmSize}
                  </Box>
                </Stack>
                <Slider 
                  aria-label="Swarm size" 
                  min={5} 
                  max={50} 
                  value={swarmSize} 
                  onChange={(e,v) => setSwarmSize(v)} 
                  sx={{ 
                    color: '#4fc6e0',
                    '& .MuiSlider-thumb': {
                      boxShadow: '0 2px 8px rgba(79, 198, 224, 0.3)'
                    }
                  }} 
                />
              </Box>
            </Box>

            {/* Control Buttons Section */}
            <Box sx={{ 
              bgcolor: '#f8fafc',
              borderRadius: 2,
              p: 2,
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>
                🎮 Simulation Controls
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }} role="group" aria-label="Simulation controls">
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleStart}
                  disabled={isRunning}
                  sx={{
                    bgcolor: '#22c55e',
                    '&:hover': { bgcolor: '#16a34a' },
                    '&:disabled': { bgcolor: '#cbd5e1' },
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)'
                  }}
                >
                  Start
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PauseIcon />}
                  onClick={handlePause}
                  disabled={!isRunning}
                  sx={{
                    bgcolor: '#f59e0b',
                    '&:hover': { bgcolor: '#d97706' },
                    '&:disabled': { bgcolor: '#cbd5e1' },
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                  }}
                >
                  Pause
                </Button>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={handleReset}
                  sx={{
                    bgcolor: '#ef4444',
                    '&:hover': { bgcolor: '#dc2626' },
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  Reset
                </Button>
                <Button
                  variant="contained"
                  startIcon={<BoltIcon />}
                  onClick={handleOptimize}
                  sx={{
                    bgcolor: '#8b5cf6',
                    '&:hover': { bgcolor: '#7c3aed' },
                    textTransform: 'none',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  Optimize
                </Button>
              </Box>
            </Box>
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

  {/* Render the Grid Status before Traffic and System Status on mobile, as portal on desktop */}
  <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2 }}>
    {gridStatusOverlay}
  </Box>
  {typeof document !== 'undefined' ? createPortal(
    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
      {gridStatusOverlay}
    </Box>, 
    document.body
  ) : null}

      {/* Traffic Light Status & System Status - Enhanced Design */}
      <Paper sx={{ 
        mt: 2, 
        p: { xs: 2, sm: 3 }, 
        borderRadius: 3, 
        bgcolor: 'background.paper',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.05)'
      }} elevation={0}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 3, sm: 3 }} divider={<Box sx={{ width: { xs: '100%', md: '1px' }, height: { xs: '1px', md: 'auto' }, bgcolor: 'rgba(0,0,0,0.08)' }} />}>
          
          {/* Traffic Light Status Section */}
          <Box sx={{ flex: 1 }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
              <Box sx={{ 
                bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                background: 'linear-gradient(135deg, #e8f6ff 0%, #c3e4ff 100%)',
                borderRadius: 2.5, 
                p: 1.2,
                boxShadow: '0 4px 12px rgba(13, 110, 253, 0.2)'
              }}>
                <TrafficIcon sx={{ color: '#0d6efd', fontSize: { xs: 26, sm: 32 } }} />
              </Box>
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#0d6efd', 
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                    lineHeight: 1.2,
                    mb: 0.3
                  }}
                >
                  Traffic Light Status
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Real-time intersection monitoring
                </Typography>
              </Box>
            </Stack>

            {/* Traffic Lights List */}
            <Box sx={{ 
              bgcolor: '#f8fafb',
              borderRadius: 2,
              p: 2,
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
              <Box sx={{ 
                maxHeight: { xs: 'auto', sm: 280 }, 
                overflowY: 'auto',
                overflowX: 'hidden',
                pr: 1,
                '&::-webkit-scrollbar': {
                  width: '6px'
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent'
                },
                '&::-webkit-scrollbar-thumb': {
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '3px'
                }
              }} role="region" aria-label="Traffic light status list">
                {trafficLights.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                    🚦 Initializing traffic lights...
                  </Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {trafficLights.map((t, i) => (
                      <Box 
                        key={i} 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          p: 1.5,
                          bgcolor: 'white',
                          borderRadius: 2,
                          border: '1px solid rgba(0,0,0,0.05)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#e8f6ff',
                            borderColor: '#0d6efd',
                            transform: 'translateX(4px)',
                            boxShadow: '0 2px 8px rgba(13, 110, 253, 0.15)'
                          }
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                          <Box sx={{ 
                            width: 36, 
                            height: 36, 
                            borderRadius: '50%', 
                            bgcolor: '#e8f6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #0d6efd'
                          }}>
                            <TrafficIcon sx={{ fontSize: 18, color: '#0d6efd' }} />
                          </Box>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontSize: { xs: '0.9rem', sm: '0.95rem' },
                              fontWeight: 500,
                              color: '#1a1a1a'
                            }}
                          >
                            {t.name}
                          </Typography>
                        </Stack>
                        <Box 
                          sx={{ 
                            bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
                            color: 'white',
                            px: 2,
                            py: 0.7,
                            borderRadius: 2,
                            fontWeight: 700,
                            fontSize: { xs: '0.85rem', sm: '0.9rem' },
                            minWidth: 55,
                            textAlign: 'center',
                            boxShadow: '0 2px 8px rgba(13, 110, 253, 0.3)',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {t.timeRemaining}s
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          </Box>

          {/* System Status Section */}
          <Box sx={{ flex: 1 }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
              <Box sx={{ 
                background: 'linear-gradient(135deg, #eef7ea 0%, #d4edda 100%)',
                borderRadius: 2.5, 
                p: 1.2,
                boxShadow: '0 4px 12px rgba(30, 126, 52, 0.2)'
              }}>
                <ComputerIcon sx={{ color: '#1e7e34', fontSize: { xs: 26, sm: 32 } }} />
              </Box>
              <Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#1e7e34', 
                    fontWeight: 700,
                    fontSize: { xs: '1.1rem', sm: '1.3rem' },
                    lineHeight: 1.2,
                    mb: 0.3
                  }}
                >
                  System Status
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                  Service health monitoring
                </Typography>
              </Box>
            </Stack>

            {/* Status Items */}
            <Box sx={{ 
              bgcolor: '#f8fafb',
              borderRadius: 2,
              p: 2,
              border: '1px solid rgba(0,0,0,0.05)'
            }}>
              <Stack spacing={1.5}>
                {/* API Service */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  p: 1.5,
                  bgcolor: 'white',
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#fff5f5',
                    borderColor: '#f44336',
                    transform: 'translateX(4px)',
                    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.15)'
                  }
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      bgcolor: '#f44336',
                      boxShadow: '0 0 8px rgba(244, 67, 54, 0.5)',
                      animation: 'pulse 2s infinite'
                    }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '0.95rem' },
                      fontWeight: 500,
                      color: '#1a1a1a'
                    }}>
                      API Service
                    </Typography>
                  </Stack>
                  <Box sx={{ 
                    bgcolor: '#f44336',
                    color: 'white',
                    px: 2,
                    py: 0.6,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.3)',
                    letterSpacing: '0.5px'
                  }}>
                    {systemStatus.apiService}
                  </Box>
                </Box>

                {/* Data Refresh */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center', 
                  p: 1.5,
                  bgcolor: 'white',
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#e3f2fd',
                    borderColor: '#2196f3',
                    transform: 'translateX(4px)',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)'
                  }
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      bgcolor: '#2196f3',
                      boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)',
                      animation: 'pulse 2s infinite'
                    }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '0.95rem' },
                      fontWeight: 500,
                      color: '#1a1a1a'
                    }}>
                      Data Refresh
                    </Typography>
                  </Stack>
                  <Box sx={{ 
                    bgcolor: '#2196f3',
                    color: 'white',
                    px: 2,
                    py: 0.6,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    letterSpacing: '0.5px'
                  }}>
                    {systemStatus.dataRefresh}
                  </Box>
                </Box>

                {/* Map Overlay */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center', 
                  p: 1.5,
                  bgcolor: 'white',
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#e3f2fd',
                    borderColor: '#2196f3',
                    transform: 'translateX(4px)',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.15)'
                  }
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      bgcolor: '#2196f3',
                      boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)'
                    }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '0.95rem' },
                      fontWeight: 500,
                      color: '#1a1a1a'
                    }}>
                      Map Overlay
                    </Typography>
                  </Stack>
                  <Box sx={{ 
                    bgcolor: '#2196f3',
                    color: 'white',
                    px: 2,
                    py: 0.6,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    letterSpacing: '0.5px'
                  }}>
                    {systemStatus.mapOverlay}
                  </Box>
                </Box>

                {/* Optimization AI */}
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center', 
                  p: 1.5,
                  bgcolor: 'white',
                  borderRadius: 2,
                  border: '1px solid rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#f5f5f5',
                    borderColor: '#9e9e9e',
                    transform: 'translateX(4px)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ 
                      width: 10, 
                      height: 10, 
                      borderRadius: '50%', 
                      bgcolor: '#9e9e9e'
                    }} />
                    <Typography sx={{ 
                      fontSize: { xs: '0.9rem', sm: '0.95rem' },
                      fontWeight: 500,
                      color: '#1a1a1a'
                    }}>
                      Optimization AI
                    </Typography>
                  </Stack>
                  <Box sx={{ 
                    bgcolor: '#9e9e9e',
                    color: 'white',
                    px: 2,
                    py: 0.6,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: { xs: '0.8rem', sm: '0.85rem' },
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    letterSpacing: '0.5px'
                  }}>
                    {systemStatus.optimizationAI}
                  </Box>
                </Box>
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Paper>

      {/* ARIA live region for announcements */}
      <div aria-live="polite" aria-atomic="true" className="visually-hidden">{liveMessage}</div>

      {/* Snackbar for save/test feedback */}
      <Snackbar 
        open={snackbarOpen} 
        autoHideDuration={6000} 
        onClose={() => setSnackbarOpen(false)} 
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 9999, mt: 8 }}
      >
        <Box
          sx={{
            bgcolor: snackbarSeverity === 'success' ? '#4caf50' : '#f44336',
            color: '#fff',
            minWidth: '300px',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#fff', flex: 1 }}>
            {snackbarMsg}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setSnackbarOpen(false)}
            sx={{ color: '#fff', padding: '4px' }}
          >
            <span style={{ fontSize: '20px' }}>✕</span>
          </IconButton>
        </Box>
      </Snackbar>

      {/* Footer */}
      <Box 
        component="footer" 
        role="contentinfo"
        sx={{ 
          mt: 3,
          background: 'linear-gradient(120deg, #4a6fa5, #166088)',
          borderRadius: 3,
          padding: '20px',
          boxShadow: '0 5px 15px rgba(0,0,0,0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'white',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: 2
        }}
      >
        {/* Left Section - Brand */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ 
            bgcolor: 'rgba(255,255,255,0.2)', 
            borderRadius: '50%', 
            p: 0.8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrafficIcon sx={{ fontSize: 24, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
              Traffic Grid Dashboard
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
              Intelligent Traffic Management • v1.0.0
            </Typography>
          </Box>
        </Stack>

        {/* Center Section - Links */}
        <Stack 
          direction="row" 
          spacing={3} 
          sx={{ 
            display: { xs: 'none', sm: 'flex' }
          }}
        >
          <Typography 
            variant="body2" 
            component="a" 
            href="#" 
            sx={{ 
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.9rem',
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.8, textDecoration: 'underline' }
            }}
          >
            Privacy
          </Typography>
          <Typography 
            variant="body2" 
            component="a" 
            href="#" 
            sx={{ 
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.9rem',
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.8, textDecoration: 'underline' }
            }}
          >
            Terms
          </Typography>
          <Typography 
            variant="body2" 
            component="a" 
            href="#" 
            sx={{ 
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.9rem',
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.8, textDecoration: 'underline' }
            }}
          >
            Contact
          </Typography>
        </Stack>

        {/* Right Section - Copyright */}
        <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
          <Typography variant="body2" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
            © {new Date().getFullYear()} Traffic Track
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.8rem', opacity: 0.9 }}>
            All Rights Reserved
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default forwardRef(SwarmMap);
