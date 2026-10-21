import { formatAge, num, plugLiveness } from '../lib/telemetry';

const PlugCard = ({ plug, onToggle, pending, error }) => {
  const isApplying = Boolean(pending);

  const {
    isOn,
    lastSeenMs,
    ageMs,
    hasNoTelemetry,
    isStale,
    isLive,
  } = plugLiveness(plug);

  // The relay told us the last command never landed. Until telemetry proves
  // otherwise, this card's state is a request, not a fact.
  const relayUnconfirmed = plug.relayReachable === false;

  // While a command is in flight, show where it is going — not that it arrived.
  const knobIsOn = isApplying ? pending === 'on' : isOn;

  const statusLabel = isApplying
    ? 'APPLYING…'
    : !isOn
    ? 'SWITCHED OFF'
    : hasNoTelemetry
    ? 'NO TELEMETRY'
    : isStale
    ? `STALE · ${formatAge(ageMs)} AGO`
    : 'LIVE';

  const statusTone = isApplying
    ? 'text-textMuted'
    : !isOn
    ? 'text-textMuted'
    : hasNoTelemetry
    ? 'text-red-400'
    : isStale
    ? 'text-yellow-500'
    : 'text-accent';

  const dotTone = isApplying
    ? 'bg-textMuted'
    : !isOn
    ? 'bg-textMuted'
    : hasNoTelemetry
    ? 'bg-red-500'
    : isStale
    ? 'bg-yellow-500'
    : 'bg-accent animate-pulse';

  // Stored readings are not measurements. Dim them so nobody reads a stale
  // number as the current one.
  const metricsAreLive = isLive;

  const lastSeenTitle = lastSeenMs === null
    ? 'No telemetry has ever been received from this node'
    : `Last telemetry received ${new Date(lastSeenMs).toLocaleString()}`;

  return (
    <div className={`relative p-6 rounded-2xl transition-all duration-300 ${isLive ? 'glass-card glow-box' : 'bg-cardBg border border-borderSubtle'}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className={`text-xl font-bold font-mono tracking-tight ${isOn ? 'text-textMain' : 'text-textMuted'}`}>
            {plug.name}
          </h2>
          <div className="flex items-center mt-2 space-x-2 flex-wrap gap-y-1">
            <div className={`w-2 h-2 rounded-full ${dotTone}`}></div>
            <span className={`text-sm font-medium ${statusTone}`} title={lastSeenTitle}>
              {statusLabel}
            </span>
            {isLive && plug.idleDetection && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 ml-2">
                IDLE DETECTED
              </span>
            )}
          </div>

          {isOn && (
            <div className="mt-3 flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-textMuted">Classified Load:</span>
              {isLive ? (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wider border uppercase flex items-center ${
                  plug.connectedDevice === 'Phone'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : plug.connectedDevice === 'Fan'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    : plug.connectedDevice === 'Laptop'
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }`}>
                  {plug.connectedDevice === 'Phone' && (
                    <span className="flex items-center space-x-1.5">
                      <span aria-hidden="true">📱</span>
                      <span>Phone</span>
                    </span>
                  )}
                  {plug.connectedDevice === 'Fan' && (
                    <span className="flex items-center space-x-1.5">
                      <span className="inline-block origin-center animate-[spin_4s_linear_infinite]" aria-hidden="true">🌀</span>
                      <span>Fan</span>
                    </span>
                  )}
                  {plug.connectedDevice === 'Laptop' && (
                    <span className="flex items-center space-x-1.5">
                      <span aria-hidden="true">💻</span>
                      <span>Laptop</span>
                    </span>
                  )}
                  {plug.connectedDevice !== 'Phone' && plug.connectedDevice !== 'Fan' && plug.connectedDevice !== 'Laptop' && (
                    <span className="flex items-center space-x-1.5">
                      <span aria-hidden="true">💤</span>
                      <span>{plug.connectedDevice && plug.connectedDevice !== 'Idle' ? 'Unknown Load' : 'Idle / No Load'}</span>
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-bold tracking-wider border uppercase bg-slate-500/10 text-slate-400 border-slate-500/20">
                  Awaiting telemetry
                </span>
              )}
            </div>
          )}

          {relayUnconfirmed && !isApplying && (
            <p role="alert" className="mt-3 text-xs font-mono text-red-400 flex items-start space-x-1.5">
              <span aria-hidden="true">⚠</span>
              <span>Relay did not acknowledge — state not confirmed</span>
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs font-mono text-red-400 flex items-start space-x-1.5">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Custom Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label={`${plug.name} power`}
          aria-busy={isApplying}
          onClick={() => onToggle(plug.id, isOn ? 'off' : 'on')}
          disabled={isApplying}
          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-60 cursor-pointer ${knobIsOn ? 'bg-accent' : 'bg-textMuted/40'} ${isApplying ? 'animate-pulse' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${knobIsOn ? 'translate-x-8' : 'translate-x-1'}`}
          />
        </button>
      </div>

      <div className={`grid grid-cols-3 gap-4 transition-opacity duration-300 ${metricsAreLive ? '' : 'opacity-50'}`}>
        {/* Vrms */}
        <div className="bg-cardBg p-4 rounded-xl border border-borderSubtle flex flex-col justify-center">
          <span className="text-textMuted text-xs uppercase tracking-wider mb-1 font-semibold">Voltage (Vrms)</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-mono font-bold ${metricsAreLive ? 'text-textMain' : 'text-textMuted'}`}>{num(plug.vrms, 1)}</span>
            <span className="text-textMuted text-sm">V</span>
          </div>
        </div>

        {/* Irms */}
        <div className="bg-cardBg p-4 rounded-xl border border-borderSubtle flex flex-col justify-center">
          <span className="text-textMuted text-xs uppercase tracking-wider mb-1 font-semibold">Current (Irms)</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-mono font-bold ${metricsAreLive ? 'text-textMain' : 'text-textMuted'}`}>{num(plug.irms, 2)}</span>
            <span className="text-textMuted text-sm">A</span>
          </div>
        </div>

        {/* Real Power */}
        <div className="bg-cardBg p-4 rounded-xl border border-borderSubtle flex flex-col justify-center">
          <span className="text-textMuted text-xs uppercase tracking-wider mb-1 font-semibold">Real Power</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-mono font-bold ${metricsAreLive ? 'text-accent glow-text' : 'text-textMuted'}`}>{num(plug.realPower, 1)}</span>
            <span className="text-textMuted text-sm">W</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlugCard;
