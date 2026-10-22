import { formatAge, num, plugLiveness } from '../lib/telemetry';
import { Warning, DeviceMobile, Fan, Laptop, MoonStars } from '@phosphor-icons/react';

const deviceIcon = {
  Phone: DeviceMobile,
  Fan: Fan,
  Laptop: Laptop,
};

const deviceTone = {
  Phone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Fan: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Laptop: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

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

  const DeviceIcon = deviceIcon[plug.connectedDevice] || MoonStars;
  const isKnownDevice = Boolean(deviceIcon[plug.connectedDevice]);

  return (
    <div className={`p-6 rounded-2xl border transition-all duration-300 ${
      isLive
        ? 'bg-cardActive border-borderSubtle shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]'
        : 'bg-cardBg border-borderSubtle'
    }`}>
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className={`text-xl font-semibold tracking-tight ${isOn ? 'text-textMain' : 'text-textMuted'}`}>
            {plug.name}
          </h2>
          <div className="flex items-center mt-2 gap-2 flex-wrap gap-y-1">
            <div className={`w-2 h-2 rounded-full ${dotTone}`}></div>
            <span className={`text-sm font-mono font-medium ${statusTone}`} title={lastSeenTitle}>
              {statusLabel}
            </span>
            {isLive && plug.idleDetection && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 border border-yellow-500/25 ml-1">
                IDLE DETECTED
              </span>
            )}
          </div>

          {isOn && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-textMuted">Classified Load:</span>
              {isLive ? (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold tracking-wider border uppercase flex items-center gap-1.5 ${
                  isKnownDevice
                    ? deviceTone[plug.connectedDevice]
                    : 'bg-textMuted/10 text-textMuted border-borderSubtle'
                }`}>
                  <DeviceIcon size={12} weight="bold" aria-hidden="true" />
                  <span>
                    {isKnownDevice
                      ? plug.connectedDevice
                      : plug.connectedDevice && plug.connectedDevice !== 'Idle' ? 'Unknown Load' : 'Idle / No Load'}
                  </span>
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold tracking-wider border uppercase bg-textMuted/10 text-textMuted border-borderSubtle">
                  Awaiting telemetry
                </span>
              )}
            </div>
          )}

          {relayUnconfirmed && !isApplying && (
            <p role="alert" className="mt-3 text-xs font-mono text-red-400 flex items-start gap-1.5">
              <Warning size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>Relay did not acknowledge — state not confirmed</span>
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-xs font-mono text-red-400 flex items-start gap-1.5">
              <Warning size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
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
          className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-60 cursor-pointer active:scale-[0.98] ${knobIsOn ? 'bg-accent' : 'bg-textMuted/40'} ${isApplying ? 'animate-pulse' : ''}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${knobIsOn ? 'translate-x-8' : 'translate-x-1'}`}
          />
        </button>
      </div>

      {/* Metrics: one rule-separated row, no nested boxes. */}
      <div className={`grid grid-cols-3 divide-x divide-borderSubtle border-t border-borderSubtle pt-4 transition-opacity duration-300 ${metricsAreLive ? '' : 'opacity-50'}`}>
        {[
          ['Voltage (Vrms)', num(plug.vrms, 1), 'V', metricsAreLive ? 'text-textMain' : 'text-textMuted'],
          ['Current (Irms)', num(plug.irms, 2), 'A', metricsAreLive ? 'text-textMain' : 'text-textMuted'],
          ['Real Power', num(plug.realPower, 1), 'W', metricsAreLive ? 'text-accent' : 'text-textMuted'],
        ].map(([label, value, unit, tone], i) => (
          <div key={label} className={`flex flex-col ${i > 0 ? 'pl-4' : ''}`}>
            <span className="text-textMuted text-[10px] uppercase tracking-wider mb-1 font-semibold">{label}</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-mono font-semibold tracking-tight ${tone}`}>{value}</span>
              <span className="text-textMuted text-sm">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlugCard;
