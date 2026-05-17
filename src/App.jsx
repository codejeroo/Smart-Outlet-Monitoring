import React, { useState, useEffect } from 'react';
import PlugCard from './components/PlugCard';
import { getPlugs, controlPlug } from './services/api';
import logo from './assets/logo.png';

function App() {
  const [plugs, setPlugs] = useState([]);
  const [dailyConsumption, setDailyConsumption] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

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
      setError(null);
    } catch (err) {
      console.error("Failed to fetch plugs:", err);
      setError("Failed to connect to the local server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPlugs();

    // Polling interval (e.g. every 2 seconds for live dashboard feel)
    const intervalId = setInterval(fetchPlugs, 2000);

    return () => clearInterval(intervalId);
  }, []);

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
    <div className="min-h-screen bg-background text-textMain font-sans p-6 md:p-12 transition-colors duration-300">
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
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full bg-cardBg border border-borderSubtle hover:bg-cardActive transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
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
          <section className="mb-8 p-6 rounded-2xl glass-card border border-borderSubtle grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col">
              <span className="text-textMuted text-sm font-semibold uppercase tracking-wider mb-2">Total Nodes</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold font-mono text-textMain">{totalNodes}</span>
                <span className="text-sm text-textMuted font-medium">({activeNodes} active)</span>
              </div>
            </div>
            <div className="flex flex-col border-t md:border-t-0 md:border-l border-borderSubtle md:pl-6 pt-4 md:pt-0">
              <span className="text-textMuted text-sm font-semibold uppercase tracking-wider mb-2">Total Real-Time Power</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold font-mono text-accent glow-text">{totalPower.toFixed(1)}</span>
                <span className="text-sm text-textMuted font-medium">W</span>
              </div>
            </div>
            <div className="flex flex-col border-t md:border-t-0 md:border-l border-borderSubtle md:pl-6 pt-4 md:pt-0">
              <span className="text-textMuted text-sm font-semibold uppercase tracking-wider mb-2">Daily Consumption</span>
              <div className="flex items-baseline space-x-2">
                <span className="text-4xl font-extrabold font-mono text-textMain">{dailyConsumption.toFixed(3)}</span>
                <span className="text-sm text-textMuted font-medium">kWh</span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {plugs.map(plug => (
              <PlugCard
                key={plug.id}
                plug={plug}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </main>

        <footer className="mt-16 text-center border-t border-borderSubtle pt-8 text-textMuted text-sm font-mono">
          <p>Running via Local Area Network (LAN)</p>
          <p className="mt-1 flex items-center justify-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span>Server: Connected</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
