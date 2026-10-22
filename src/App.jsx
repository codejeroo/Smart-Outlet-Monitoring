import { useState, useEffect } from 'react';
import PlugCard from './components/PlugCard';
import { getPlugs, controlPlug, getTelemetryLogs, clearTelemetryLogs } from './services/api';
import logo from './assets/logo.png';
import PowerChart from './components/PowerChart';
import VoltageCurrentChart from './components/VoltageCurrentChart';
import { plugLiveness, num, parseUtc, LIVE_WINDOW_MS } from './lib/telemetry';
import {
  List,
  Moon,
  Sun,
  Warning,
  Clock,
  Trash,
  X,
  Plugs,
} from '@phosphor-icons/react';

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

  // Relay commands are requests until the hardware confirms them, so a command
  // in flight and a command that failed both have to be visible.
  const [pendingControl, setPendingControl] = useState({});
  const [controlErrors, setControlErrors] = useState({});
  const [now, setNow] = useState(() => Date.now());

  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [clearing, setClearing] = useState(false);
  const [logsError, setLogsError] = useState(null);
  const [clearError, setClearError] = useState(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // A ticking clock keeps staleness honest even when polling stops. Without it,
  // a dead server would freeze every "last seen" age at whatever it was.
  useEffect(() => {
    const clockId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clockId);
  }, []);

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
        const totalPower = response.plugs.reduce((sum, p) => sum + (Number.isFinite(p.realPower) ? p.realPower : 0), 0);
        // Average only over nodes that are actually reporting a voltage. An
        // unpowered node reads 0 V, and including it drags the mean into a sag
        // that no appliance is experiencing.
        const reportingNodes = response.plugs.filter(p => Number.isFinite(p.vrms) && p.vrms > 0);
        const avgVrms = reportingNodes.length
          ? reportingNodes.reduce((sum, p) => sum + p.vrms, 0) / reportingNodes.length
          : 0;
        const totalIrms = response.plugs.reduce((sum, p) => sum + (Number.isFinite(p.irms) ? p.irms : 0), 0);
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
      setError(`Cannot reach the local server: ${err?.message || 'no response'}.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await getTelemetryLogs(50);
      setLogs(response.logs || []);
      setLogsError(null);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      // "No logs in database" and "could not read the log" are different facts.
      setLogsError("Could not read the telemetry log — the server did not answer.");
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

  // The drawer is a modal surface: Escape has to close it, not only the X button.
  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen]);

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all database telemetry logs and reset all energy consumption metrics to 0.0?")) {
      return;
    }
    setClearing(true);
    setClearError(null);
    try {
      await clearTelemetryLogs();
      setLogs([]);
      // Immediately refresh plugs and stats
      await fetchPlugs();
    } catch (err) {
      console.error("Failed to clear logs:", err);
      setClearError("Reset failed — the server did not confirm it. Nothing was cleared.");
    } finally {
      setClearing(false);
    }
  };

  const handleToggle = async (id, status) => {
    setPendingControl(prev => ({ ...prev, [id]: status }));
    setControlErrors(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const result = await controlPlug(id, status);

      // The server records the command either way. Only the relay's own
      // acknowledgement tells us the appliance actually changed state.
      if (result && result.relayReachable === false) {
        setControlErrors(prev => ({
          ...prev,
          [id]: result.message || 'The relay did not acknowledge this command.',
        }));
      }
    } catch (err) {
      console.error(`Failed to turn ${status} plug ${id}`, err);
      setControlErrors(prev => ({
        ...prev,
        [id]: 'The server rejected the command. Nothing was switched.',
      }));
    } finally {
      setPendingControl(prev => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      // Re-read the node's real state rather than assuming the command landed.
      fetchPlugs();
    }
  };

  if (loading && plugs.length === 0) {
    return (
      <div className="min-h-[100dvh] max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10">
        <div className="flex items-center gap-4">
          <div className="shimmer w-14 h-14 rounded-xl" />
          <div className="shimmer h-8 w-72 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 border-y border-borderSubtle">
          {[0, 1, 2].map(i => (
            <div key={i} className={`py-6 ${i > 0 ? 'md:border-l md:pl-6 border-t md:border-t-0 border-borderSubtle' : ''}`}>
              <div className="shimmer h-3 w-24 rounded mb-3" />
              <div className="shimmer h-9 w-32 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="shimmer h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Derived stats
  const totalNodes = plugs.length;
  const liveNodes = plugs.filter(p => plugLiveness(p, now).isLive).length;
  const totalPower = plugs.reduce((sum, p) => sum + (Number.isFinite(p.realPower) ? p.realPower : 0), 0);
  const isConnected = !error;
  // Logs carry a numeric node id while the cards carry names; without this map
  // the two panels cannot be read against each other without memorising it.
  const plugNames = new Map(plugs.map(p => [p.id, p.name]));

  const statBlocks = [
    {
      label: 'Total Nodes',
      value: (
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold font-mono tracking-tight">{totalNodes}</span>
          <span
            className="text-xs text-textMuted font-medium"
            title={`Nodes that have sent telemetry in the last ${LIVE_WINDOW_MS / 1000} seconds`}
          >
            ({liveNodes} live)
          </span>
        </div>
      ),
    },
    {
      label: 'Real-Time Power',
      value: (
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-semibold font-mono tracking-tight ${isConnected && liveNodes > 0 ? 'text-accent' : 'text-textMuted'}`}>
            {isConnected ? num(totalPower, 1) : '—'}
          </span>
          <span className="text-xs text-textMuted font-medium">W</span>
        </div>
      ),
      note: !isConnected
        ? <span className="text-xs text-red-400 font-medium">Server unreachable — no current reading</span>
        : liveNodes === 0
        ? <span className="text-xs text-yellow-500 font-medium">No node reporting — stored reading</span>
        : null,
    },
    {
      label: 'Consumption',
      value: (
        <div className="divide-y divide-borderSubtle/60">
          {[
            ['Daily', dailyConsumption, 'text-2xl'],
            ['Weekly', weeklyConsumption, 'text-lg'],
            ['Monthly', monthlyConsumption, 'text-lg'],
          ].map(([label, value, size]) => (
            <div key={label} className="flex justify-between items-baseline py-1.5">
              <span className="text-[10px] text-textMuted font-semibold uppercase tracking-wider">{label}</span>
              <span className="text-textMuted text-[10px] font-medium">
                <span className={`${size} font-semibold font-mono text-textMain mr-1`}>
                  {isConnected ? value.toFixed(3) : '—'}
                </span>
                kWh
              </span>
            </div>
          ))}
          {!isConnected && (
            <p className="text-[10px] text-red-400 font-medium pt-1.5">Server unreachable — totals unavailable</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-[100dvh] transition-colors duration-300 relative overflow-x-hidden">
      <div className="max-w-5xl mx-auto px-6 py-8 md:py-12">
        <header className="reveal mb-10 flex justify-between items-start" style={{ '--index': 0 }}>
          <div>
            <div className="flex items-center gap-4 mb-2">
              <img src={logo} alt="Smart Outlet Logo" className="w-12 h-12 md:w-14 md:h-14 object-contain rounded-xl" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tighter leading-none">
                  Smart Outlet System
                </h1>
                <p className="text-textMuted text-sm mt-1">Multi-Outlet Monitoring and Control Console</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2.5 rounded-full border border-borderSubtle hover:bg-cardActive active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center text-textMain"
              aria-label="Open System Logs Drawer"
              title="View System Logs"
            >
              <List size={20} weight="bold" />
            </button>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-full border border-borderSubtle hover:bg-cardActive active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} weight="bold" className="text-yellow-400" /> : <Moon size={20} weight="bold" className="text-textMuted" />}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="reveal mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-sm flex flex-wrap items-center gap-x-3 gap-y-2" style={{ '--index': 1 }}>
            <Warning size={18} className="shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchPlugs}
              className="ml-auto px-3 py-1 rounded-md border border-red-500/30 hover:bg-red-500/15 text-red-300 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/50 active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        )}

        <main>
          {/* Stats strip: grouped by 1px rules, no card containers. */}
          <section className="reveal mb-10 border-y border-borderSubtle grid grid-cols-1 md:grid-cols-3" style={{ '--index': 2 }}>
            {statBlocks.map((block, i) => (
              <div key={block.label} className={`py-6 flex flex-col justify-center ${i > 0 ? 'md:border-l border-t md:border-t-0 border-borderSubtle md:pl-6' : ''}`}>
                <span className="text-textMuted text-xs font-semibold uppercase tracking-wider mb-2">{block.label}</span>
                {block.value}
                {block.note}
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {plugs.map((plug, i) => (
              <div key={plug.id} className="reveal" style={{ '--index': 3 + i }}>
                <PlugCard
                  plug={plug}
                  onToggle={handleToggle}
                  pending={pendingControl[plug.id]}
                  error={controlErrors[plug.id]}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <div className="reveal" style={{ '--index': 7 }}><PowerChart data={dataHistory} /></div>
            <div className="reveal" style={{ '--index': 8 }}><VoltageCurrentChart data={dataHistory} /></div>
          </div>
        </main>

        <footer className="reveal mt-16 border-t border-borderSubtle pt-6 text-textMuted text-sm font-mono flex flex-col md:flex-row justify-start items-start md:items-center md:gap-6 gap-2" style={{ '--index': 9 }}>
          <p>Running via Local Area Network (LAN)</p>
          <p className="flex items-center gap-2" role="status" aria-live="polite">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent animate-pulse' : 'bg-red-500'}`}></span>
            <span className={isConnected ? '' : 'text-red-400'}>
              Server: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Clock size={16} />
            <span>
              {isConnected ? 'Last Updated' : 'Last successful'}: {lastUpdated || 'never'}
            </span>
          </p>
        </footer>
      </div>

      {/* Sliding Logs Drawer Backdrop */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 transition-opacity duration-300 cursor-pointer"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Sliding Logs Drawer Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="System Log Console"
        aria-hidden={!isDrawerOpen}
        inert={!isDrawerOpen}
        className={`fixed right-0 top-0 h-full w-full sm:w-[500px] bg-cardBg border-l border-borderSubtle shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-borderSubtle flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Plugs size={22} weight="bold" className="text-accent" />
            <h2 className="text-xl font-semibold tracking-tight">System Log Console</h2>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1.5 rounded-md text-textMuted hover:text-textMain hover:bg-cardActive transition-colors cursor-pointer focus:outline-none"
            aria-label="Close Logs"
          >
            <X size={22} />
          </button>
        </div>

        {/* Consumption Overview & Clear Action */}
        <div className="p-6 border-b border-borderSubtle space-y-4">
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Accumulated Consumption</h3>
          <div className="divide-y divide-borderSubtle">
            {[
              ['Daily', dailyConsumption],
              ['Weekly', weeklyConsumption],
              ['Monthly', monthlyConsumption],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-baseline py-2">
                <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">{label}</span>
                <span className="text-base font-semibold font-mono">{value.toFixed(3)} <span className="text-[10px] text-textMuted">kWh</span></span>
              </div>
            ))}
          </div>

          <button
            onClick={handleClearLogs}
            disabled={clearing}
            className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold font-mono text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus:ring-1 focus:ring-red-500/50 active:scale-[0.98]"
          >
            {clearing ? (
              <span>Resetting Console...</span>
            ) : (
              <>
                <Trash size={16} />
                <span>Clear Logs &amp; Reset Stats</span>
              </>
            )}
          </button>

          {clearError && (
            <p role="alert" className="text-xs font-mono text-red-400">{clearError}</p>
          )}
        </div>

        {/* Logs Feed Container */}
        <div className="flex-1 overflow-y-auto px-6 bg-cardActive/40">
          <h3 className="text-[10px] font-bold text-textMuted uppercase tracking-widest pt-5 pb-3">Live Telemetry Log Feed</h3>
          {logsError ? (
            <div role="alert" className="text-center py-16 text-red-400 font-mono text-xs">
              {logsError}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-textMuted font-mono text-xs">
              NO TELEMETRY LOGS IN DATABASE
            </div>
          ) : (
            <ul className="divide-y divide-borderSubtle">
              {logs.map(log => {
                // The API sends UTC while the footer renders local time. Slicing the
                // raw string showed UTC beside a local clock and read as a skew.
                const seenMs = parseUtc(log.timestamp);
                const time = seenMs === null ? '--:--:--' : new Date(seenMs).toLocaleTimeString([], { hour12: false });
                const nodeName = plugNames.get(log.plug_id) || `Node ${log.plug_id}`;

                // Color mapping for device classes
                let badgeColor = "bg-textMuted/10 text-textMuted border-borderSubtle";
                if (log.connectedDevice === 'Phone') {
                  badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                } else if (log.connectedDevice === 'Laptop') {
                  badgeColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                } else if (log.connectedDevice === 'Fan') {
                  badgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
                }

                return (
                  <li key={log.id} className="py-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-[10px] text-textMuted font-mono">
                      <span className="font-semibold text-textMuted">[{time}] {nodeName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase font-sans border ${badgeColor}`}>
                        {log.connectedDevice || "Idle"}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-[11px] font-mono text-textMain">
                      <div>
                        <span className="text-textMuted text-[8px] font-bold block uppercase tracking-wider">Vrms</span>
                        <span className="font-medium">{log.vrms?.toFixed(1)}V</span>
                      </div>
                      <div>
                        <span className="text-textMuted text-[8px] font-bold block uppercase tracking-wider">Irms</span>
                        <span className="font-medium">{log.irms?.toFixed(2)}A</span>
                      </div>
                      <div>
                        <span className="text-textMuted text-[8px] font-bold block uppercase tracking-wider">Power</span>
                        <span className="text-accent font-semibold">{log.realPower?.toFixed(1)}W</span>
                      </div>
                      <div>
                        <span className="text-textMuted text-[8px] font-bold block uppercase tracking-wider">PF</span>
                        <span className="font-medium">{log.powerFactor?.toFixed(2)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
