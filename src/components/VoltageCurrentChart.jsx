import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { niceCeiling, roundDownTo, roundUpTo } from '../lib/chartScale';

const VoltageCurrentChart = ({ data }) => {
  const voltages = data.map((point) => point.avgVrms).filter((value) => Number.isFinite(value) && value > 0);
  const currents = data.map((point) => point.totalIrms).filter((value) => Number.isFinite(value) && value > 0);

  // Mains voltage moves inside a narrow band. Show that band so the movement is
  // readable, and fall back to a 0-240 window when nothing is energised rather
  // than clipping a zero reading off the bottom of a fixed axis.
  const voltagePeak = voltages.length ? Math.max(...voltages) : 240;
  const voltageMin = voltages.length ? roundDownTo(Math.min(...voltages), 20) : 0;
  const voltageMax = Math.max(roundUpTo(voltagePeak, 20), 240);
  const voltageTicks = [voltageMin, (voltageMin + voltageMax) / 2, voltageMax];

  // Current is dominated by whatever is smallest in the house; scale to it with
  // a floor so a phone charger is still a visible trace.
  const currentMax = niceCeiling(currents.length ? Math.max(...currents) : 0, 0.5);
  const currentTicks = [0, currentMax / 2, currentMax];

  return (
    <div className="bg-cardBg rounded-2xl p-6 shadow-lg glass-card">
      <div className="flex flex-wrap justify-between items-center gap-y-2 mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
            <h3 className="text-textMain font-semibold tracking-wider text-sm">VOLTAGE (VRMS) &amp; CURRENT (IRMS)</h3>
          </div>

          <div className="flex items-center gap-x-4 text-xs font-medium">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-0.5 bg-blue-400"></div>
              <span className="text-textMuted">Voltage (Vrms)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-0.5 bg-textMain"></div>
              <span className="text-textMuted">Current (Irms)</span>
            </div>
          </div>
        </div>

        <span className="text-xs font-mono text-textMuted tracking-wider hidden sm:inline">ROLLING 60S BUFFER</span>
      </div>

      <div className="h-48 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-textMuted font-mono text-xs tracking-wider">
            NO SAMPLES YET — WAITING FOR FIRST READING
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={true} horizontal={false} opacity={0.3} />
            <XAxis 
              dataKey="time" 
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickMargin={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
            />
            <YAxis 
              yAxisId="left"
              stroke="#60a5fa" 
              fontSize={11} 
              tickMargin={10}
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[voltageMin, voltageMax]}
              ticks={voltageTicks}
              tickFormatter={(value) => `${Number(value.toFixed(0))} V`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="var(--text-main)" 
              fontSize={11} 
              tickMargin={10}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, currentMax]}
              ticks={currentTicks}
              tickFormatter={(value) => value.toFixed(1)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }}
              labelStyle={{ color: 'var(--text-muted)' }}
            />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="avgVrms" 
              stroke="#60a5fa" 
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="totalIrms" 
              stroke="var(--text-main)" 
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default VoltageCurrentChart;
