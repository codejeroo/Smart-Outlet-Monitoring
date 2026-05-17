import React, { useState } from 'react';

const PlugCard = ({ plug, onToggle }) => {
  const [isToggling, setIsToggling] = useState(false);
  const isOn = plug.status === 'on';

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggle(plug.id, isOn ? 'off' : 'on');
    setIsToggling(false);
  };

  return (
    <div className={`relative p-6 rounded-2xl transition-all duration-300 ${isOn ? 'glass-card glow-box' : 'bg-cardBg border border-borderSubtle'}`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className={`text-xl font-bold font-mono tracking-tight ${isOn ? 'text-textMain glow-text' : 'text-textMuted'}`}>
            {plug.name}
          </h2>
          <div className="flex items-center mt-2 space-x-2">
            <div className={`w-2 h-2 rounded-full ${isOn ? 'bg-accent animate-pulse' : 'bg-textMuted'}`}></div>
            <span className={`text-sm font-medium ${isOn ? 'text-accent' : 'text-textMuted'}`}>
              {isOn ? 'ONLINE & ACTIVE' : 'OFFLINE'}
            </span>
            {isOn && plug.idleDetection && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 ml-2">
                IDLE DETECTED
              </span>
            )}
          </div>
        </div>

        {/* Custom Toggle Switch */}
        <button
          onClick={handleToggle}
          disabled={isToggling}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 cursor-pointer ${isOn ? 'bg-accent' : 'bg-textMuted/40'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${isOn ? 'translate-x-8' : 'translate-x-1'}`}
          />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Vrms */}
        <div className="bg-cardBg p-4 rounded-xl border border-borderSubtle flex flex-col justify-center">
          <span className="text-textMuted text-xs uppercase tracking-wider mb-1 font-semibold">Voltage (Vrms)</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-mono font-bold ${isOn ? 'text-textMain' : 'text-textMuted'}`}>{plug.vrms.toFixed(1)}</span>
            <span className="text-textMuted text-sm">V</span>
          </div>
        </div>

        {/* Irms */}
        <div className="bg-cardBg p-4 rounded-xl border border-borderSubtle flex flex-col justify-center">
          <span className="text-textMuted text-xs uppercase tracking-wider mb-1 font-semibold">Current (Irms)</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-mono font-bold ${isOn ? 'text-textMain' : 'text-textMuted'}`}>{plug.irms.toFixed(2)}</span>
            <span className="text-textMuted text-sm">A</span>
          </div>
        </div>

        {/* Real Power */}
        <div className="bg-cardBg p-4 rounded-xl border border-borderSubtle flex flex-col justify-center">
          <span className="text-textMuted text-xs uppercase tracking-wider mb-1 font-semibold">Real Power</span>
          <div className="flex items-baseline space-x-1">
            <span className={`text-2xl font-mono font-bold ${isOn ? 'text-accent glow-text' : 'text-textMuted'}`}>{plug.realPower.toFixed(1)}</span>
            <span className="text-textMuted text-sm">W</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlugCard;
