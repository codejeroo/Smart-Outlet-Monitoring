import React, { useState, useEffect } from 'react';
import PlugCard from './components/PlugCard';
import { getPlugs, controlPlug, getTelemetryLogs, clearTelemetryLogs } from './services/api';
import logo from './assets/logo.png';
import PowerChart from './components/PowerChart';
import VoltageCurrentChart from './components/VoltageCurrentChart';

function App() {
  const [plugs, setPlugs] = useState([]);
  const [dailyConsumption, setDailyConsumption] = useState(0);
  const [weeklyConsumption, setWeeklyConsumption] = useState(0);
  const [monthlyConsumption, setMonthlyConsumption] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [dataHistory, setDataHistory] = useState([]);
  const [lastUpdated, setLastUpdated] = useState('');
  
  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchPlugs = async () => {
    try {
      const response = await getPlugs();
      setPlugs(response.plugs);
      setDailyConsumption(response.totalDailyConsumption || 0);
      setWeeklyConsumption(response.totalWeeklyConsumption || 0);
      setMonthlyConsumption(response.totalMonthlyConsumption || 0);
      setError(null);
      
      const now = new Date();
      setLastUpdated(now.toLocaleTimeString([], { hour12: false }));
      
      setDataHistory(prev => {
        const totalPower = response.plugs.reduce((sum, p) => sum + p.realPower, 0);
        const avgVrms = response.plugs.reduce((sum, p) => sum + p.vrms, 0) / (response.plugs.length || 1);
        const totalIrms = response.plugs.reduce((sum, p) => sum + p.irms, 0);
        const newDataPoint = {
          time: now.toLocaleTimeString([], { hour12: false }),
          totalPower,
          avgVrms,
          totalIrms
        };
        const newHistory = [...prev, newDataPoint];
        if (newHistory.length > 30) newHistory.shift();
        return newHistory;
      });
    } catch (err) {
      console.error("Failed to fetch plugs:", err);
      setError("Failed to connect to the local server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await getTelemetryLogs(50);
      setLogs(response.logs || []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPlugs();

    // Polling interval (every 2 seconds for live dashboard feel)
    const intervalId = setInterval(fetchPlugs, 2000);

    return () => clearInterval(intervalId);
  }, []);

  // Poll logs only when the drawer is open to save server resources
  useEffect(() => {
    if (isDrawerOpen) {
      fetchLogs();
      const logsInterval = setInterval(fetchLogs, 3000);
      return () => clearInterval(logsInterval);
    }
  }, [isDrawerOpen]);

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all database telemetry logs and reset all energy consumption metrics to 0.0?")) {
      return;
    }
    setClearing(true);
    try {
      await clearTelemetryLogs();
      setLogs([]);
      // Immediately refresh plugs and stats
      await fetchPlugs();
    } catch (err) {
      console.error("Failed to clear logs:", err);
    } finally {
      setClearing(false);
    }
  };

  const handleToggle = async (id, status) => {
    try {
      // Optimistic update
      setPlugs(currentPlugs =>
        currentPlugs.map(plug =>
          plug.id === id ? { ...plug, status, realPower: status === 'on' ? plug.realPower : 0 } : plug
        )
      );

      await controlPlug(id, status);

      // Refresh to ensure sync
      fetchPlugs();
    } catch (err) {
      console.error(`Failed to turn ${status} plug ${id}`, err);
      // Revert optimism by fetching true state
      fetchPlugs();
    }
  };

  if (loading && plugs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-textMain transition-colors duration-300">
        <div className="text-xl font-mono animate-pulse glow-text">CONNECTING TO SMART HOUSE SERVER...</div>
      </div>
    );
  }

  // Derived stats
  const totalNodes = plugs.length;
  const activeNodes = plugs.filter(p => p.status === 'on').length;
  const totalPower = plugs.reduce((sum, p) => sum + p.realPower, 0);

  return (
    <div className="min-h-screen bg-background text-textMain font-sans p-6 md:p-12 transition-colors duration-300 relative overflow-x-hidden">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 flex justify-between items-start">
          <div>
            <div className="flex items-center mb-2">
              <img src={logo} alt="Smart Outlet Logo" className="w-14 h-14 md:w-20 md:h-20 mr-4 object-contain rounded-xl" />
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono">
                Smart Outlet System
              </h1>
            </div>
            <p className="text-textMuted text-lg">Multi-Outlet Monitoring and Control Console</p>
          </div>
          <div className="flex items-center space-x-3 mt-2">
            {/* Hamburger Button for System Logs */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 rounded-full bg-cardBg border border-borderSubtle hover:bg-cardActive hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center text-textMain shadow-md"
              aria-label="Open System Logs Drawer"
              title="View System Logs"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            {/* Dark Mode toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full bg-cardBg border border-borderSubtle hover:bg-cardActive hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center shadow-md"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 font-mono text-sm inline-flex items-center">
            <span className="mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            {error}
          </div>
        )}

        <main>
          {/* Main Summary Card */}
          <section className="mb-8 p-6 rounded-2xl glass-card border border-borderSubtle grid grid-cols-1 md:grid-cols-3 gap-6 shadow-lg">
            <div className="flex flex-col justify-center">
              <span className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-2">Total Nodes</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold font-mono text-textMain">{totalNodes}</span>
                <span className="text-xs text-textMuted font-medium">({activeNodes} active)</span>
              </div>
            </div>
            <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-borderSubtle md:pl-6 pt-4 md:pt-0">
              <span className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-2">Total Real-Time Power</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold font-mono text-accent glow-text">{totalPower.toFixed(1)}</span>
                <span className="text-xs text-textMuted font-medium">W</span>
              </div>
            </div>
            <div className="flex flex-col border-t md:border-t-0 md:border-l border-borderSubtle md:pl-6 pt-4 md:pt-0 justify-center">
              <span className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-2">Consumption Summary</span>
              <div className="space-y-2 mt-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Daily:</span>
                  <div>
                    <span className="text-2xl font-bold font-mono text-textMain mr-1">{dailyConsumption.toFixed(3)}</span>
                    <span className="text-[10px] text-textMuted font-medium">kWh</span>
                  </div>
                </div>
                <div className="flex justify-between items-baseline border-t border-borderSubtle/30 pt-1">
                  <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Weekly:</span>
                  <div>
                    <span className="text-lg font-bold font-mono text-textMain mr-1">{weeklyConsumption.toFixed(3)}</span>
                    <span className="text-[10px] text-textMuted font-medium">kWh</span>
                  </div>
                </div>
                <div className="flex justify-between items-baseline border-t border-borderSubtle/30 pt-1">
                  <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Monthly:</span>
                  <div>
                    <span className="text-lg font-bold font-mono text-textMain mr-1">{monthlyConsumption.toFixed(3)}</span>
                    <span className="text-[10px] text-textMuted font-medium">kWh</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {plugs.map(plug => (
              <PlugCard
                key={plug.id}
                plug={plug}
                onToggle={handleToggle}
              />
            ))}
          </div>

          <div className="space-y-6">
            <PowerChart data={dataHistory} />
            <VoltageCurrentChart data={dataHistory} />
          </div>
        </main>

        <footer className="mt-16 text-center border-t border-borderSubtle pt-8 text-textMuted text-sm font-mono flex flex-col md:flex-row justify-center items-center md:space-x-8 space-y-2 md:space-y-0">
          <p>Running via Local Area Network (LAN)</p>
          <div className="hidden md:block w-px h-4 bg-borderSubtle"></div>
          <p className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span>Server: Connected</span>
          </p>
          <div className="hidden md:block w-px h-4 bg-borderSubtle"></div>
          <p className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Last Updated: {lastUpdated}</span>
          </p>
        </footer>
      </div>

      {/* Sliding Logs Drawer Backdrop */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity duration-300 cursor-pointer"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Sliding Logs Drawer Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-full sm:w-[500px] bg-slate-900 border-l border-white/10 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out transform ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-950">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></span>
            <h2 className="text-xl font-bold font-mono text-white">System Log Console</h2>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer focus:outline-none"
            aria-label="Close Logs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Consumption Overview & Clear Action */}
        <div className="p-6 border-b border-white/5 bg-slate-900/50 space-y-4">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accumulated Consumption</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex flex-col justify-center shadow-inner">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Daily</span>
              <span className="text-base font-bold font-mono text-white truncate mt-0.5">{dailyConsumption.toFixed(3)}</span>
              <span className="text-[8px] text-slate-500 font-semibold uppercase">kWh</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex flex-col justify-center shadow-inner">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Weekly</span>
              <span className="text-base font-bold font-mono text-white truncate mt-0.5">{weeklyConsumption.toFixed(3)}</span>
              <span className="text-[8px] text-slate-500 font-semibold uppercase">kWh</span>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex flex-col justify-center shadow-inner">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Monthly</span>
              <span className="text-base font-bold font-mono text-white truncate mt-0.5">{monthlyConsumption.toFixed(3)}</span>
              <span className="text-[8px] text-slate-500 font-semibold uppercase">kWh</span>
            </div>
          </div>
          
          <button
            onClick={handleClearLogs}
            disabled={clearing}
            className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30 text-red-400 font-bold font-mono text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 focus:outline-none focus:ring-1 focus:ring-red-500/50"
          >
            {clearing ? (
              <span>Resetting Console...</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Clear Logs & Reset Stats</span>
              </>
            )}
          </button>
        </div>

        {/* Logs Feed Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-950/20">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Live Telemetry Log Feed</h3>
          {logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-mono text-xs animate-pulse">
              NO TELEMETRY LOGS IN DATABASE
            </div>
          ) : (
            logs.map(log => {
              const time = log.timestamp ? log.timestamp.substring(11, 19) : '00:00:00';
              
              // Color mapping for device classes
              let badgeColor = "bg-slate-500/15 text-slate-400 border border-slate-500/20";
              if (log.connectedDevice === 'Phone') {
                badgeColor = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
              } else if (log.connectedDevice === 'Laptop') {
                badgeColor = "bg-sky-500/15 text-sky-400 border border-sky-500/20";
              } else if (log.connectedDevice === 'Fan') {
                badgeColor = "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20";
              }
              
              return (
                <div key={log.id} className="p-3.5 bg-slate-900/80 border border-white/5 rounded-xl hover:border-white/10 hover:bg-slate-900 transition-all flex flex-col space-y-2.5 shadow-sm">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                    <span className="font-semibold text-slate-500">[{time}] Node {log.plug_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-sans ${badgeColor}`}>
                      {log.connectedDevice || "Idle"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500 text-[8px] font-bold block uppercase tracking-wider">Vrms</span>
                      <span className="font-semibold">{log.vrms?.toFixed(1)}V</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[8px] font-bold block uppercase tracking-wider">Irms</span>
                      <span className="font-semibold">{log.irms?.toFixed(2)}A</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[8px] font-bold block uppercase tracking-wider">Power</span>
                      <span className="text-accent font-bold">{log.realPower?.toFixed(1)}W</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[8px] font-bold block uppercase tracking-wider">PF</span>
                      <span className="font-semibold">{log.powerFactor?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
