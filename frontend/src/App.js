import React, { useRef, useState, useEffect } from 'react';
import SwarmMap from './components/SwarmMap';
import { AppBar, Toolbar, Typography, Box, TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export default function App() {
  const swarmRef = useRef(null);
  const [step, setStep] = useState(0);
  const [swarmAgents, setSwarmAgents] = useState(20);
  const [status, setStatus] = useState('Simulation Running');
  const [search, setSearch] = useState('');
  const searchInputRef = useRef(null);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (swarmRef.current && swarmRef.current.search) {
      swarmRef.current.search(search);
    }
  }

  // keyboard shortcut: press '/' to focus search field
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="primary" sx={{ boxShadow: 3 }}>
        <Toolbar sx={{ alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Typography variant="h6" component="div" sx={{ mr: 2 }}>
              Traffic Grid Dashboard
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: 10, height: 10, bgcolor: 'green', borderRadius: '50%', mr: 1 }} />
              <Typography variant="body2">{status}</Typography>
            </Box>
          </Box>

          <Box component="form" onSubmit={handleSearchSubmit} role="search" aria-label="Site search" sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <TextField
              inputRef={searchInputRef}
              size="small"
              placeholder="Search city or grid (e.g., 3,4). Press / to focus"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search city or grid"
              sx={{ width: 420, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: 4 }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon color="inherit" /></InputAdornment>) }}
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, ml: 2 }}>
            <Typography variant="body1">Step: {step}</Typography>
            <Typography variant="body1">Swarm Agents: {swarmAgents}</Typography>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <SwarmMap ref={swarmRef} onStepChange={setStep} onSwarmCountChange={setSwarmAgents} onStatusChange={setStatus} />
      </Box>
    </Box>
  );
}
