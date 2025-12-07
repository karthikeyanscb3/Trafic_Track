import React, { useRef, useState, useEffect } from 'react';
import SwarmMap from './components/SwarmMap';
import { AppBar, Toolbar, Typography, Box, TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrafficIcon from '@mui/icons-material/Traffic';

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
      <AppBar 
        position="static" 
        sx={{ 
          background: 'linear-gradient(120deg, #4a6fa5, #166088)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderBottom: '2px solid rgba(255,255,255,0.1)'
        }}
      >
        <Toolbar sx={{ 
          alignItems: 'center',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          gap: { xs: 1, md: 2 },
          py: { xs: 1.5, md: 1.5 },
          minHeight: { xs: 'auto', md: 70 }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mr: { xs: 0, md: 3 },
            width: { xs: '100%', md: 'auto' },
            justifyContent: { xs: 'space-between', md: 'flex-start' },
            gap: 1.5
          }}>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <TrafficIcon sx={{ fontSize: { xs: 28, md: 32 }, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" component="div" sx={{ 
                fontSize: { xs: '1.1rem', sm: '1.2rem', md: '1.35rem' },
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.5px'
              }}>
                Traffic Grid Dashboard
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.3 }}>
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  bgcolor: status === 'Simulation Running' ? '#4ade80' : '#94a3b8', 
                  borderRadius: '50%', 
                  mr: 0.8,
                  boxShadow: status === 'Simulation Running' ? '0 0 8px rgba(74, 222, 128, 0.6)' : 'none',
                  animation: status === 'Simulation Running' ? 'pulse 2s infinite' : 'none'
                }} />
                <Typography variant="caption" sx={{ 
                  fontSize: { xs: '0.75rem', md: '0.8rem' },
                  opacity: 0.95,
                  fontWeight: 500
                }}>
                  {status}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box 
            component="form" 
            onSubmit={handleSearchSubmit} 
            role="search" 
            aria-label="Site search" 
            sx={{ 
              flex: 1, 
              display: 'flex', 
              justifyContent: { xs: 'stretch', md: 'center' },
              width: { xs: '100%', md: 'auto' },
              order: { xs: 3, md: 2 }
            }}
          >
            <TextField
              inputRef={searchInputRef}
              size="small"
              placeholder="Search city or grid (e.g., 3,4). Press / to focus"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search city or grid"
              sx={{ 
                width: { xs: '100%', md: 450 },
                bgcolor: 'rgba(255,255,255,0.15)', 
                borderRadius: 3,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                    borderWidth: '2px'
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.5)'
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgba(255,255,255,0.7)'
                  }
                }
              }}
              InputProps={{ 
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 22 }} />
                  </InputAdornment>
                ),
                sx: { 
                  fontSize: { xs: '0.875rem', md: '0.95rem' },
                  color: 'white',
                  '& input::placeholder': {
                    color: 'rgba(255,255,255,0.7)',
                    opacity: 1
                  }
                }
              }}
            />
          </Box>

          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 1.5, md: 2 },
            ml: { xs: 0, md: 2 },
            order: { xs: 2, md: 3 },
            width: { xs: 'auto', md: 'auto' }
          }}>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.12)',
              borderRadius: 2,
              px: 2,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Typography variant="caption" sx={{ 
                fontSize: { xs: '0.65rem', md: '0.7rem' },
                opacity: 0.8,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Step
              </Typography>
              <Typography variant="h6" sx={{ 
                fontSize: { xs: '1rem', md: '1.1rem' },
                fontWeight: 700,
                lineHeight: 1
              }}>
                {step}
              </Typography>
            </Box>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.12)',
              borderRadius: 2,
              px: 2,
              py: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Typography variant="caption" sx={{ 
                fontSize: { xs: '0.65rem', md: '0.7rem' },
                opacity: 0.8,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Agents
              </Typography>
              <Typography variant="h6" sx={{ 
                fontSize: { xs: '1rem', md: '1.1rem' },
                fontWeight: 700,
                lineHeight: 1
              }}>
                {swarmAgents}
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <SwarmMap ref={swarmRef} onStepChange={setStep} onSwarmCountChange={setSwarmAgents} onStatusChange={setStatus} />
      </Box>
    </Box>
  );
}
