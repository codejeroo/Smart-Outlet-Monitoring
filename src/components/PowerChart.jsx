import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { IDLE_THRESHOLD_W, niceCeiling, cleanTick } from '../lib/chartScale';

const PowerChart = ({ data }) => {
  const peak = data.reduce(
    (max, point) => Math.max(max, Number.isFinite(point.totalPower) ? point.totalPower : 0),
    0
  );

  // Scale to the measured load. The floor keeps the idle threshold off the axis
  // when the house is quiet, instead of flattening the whole series.
  const maxY = niceCeiling(peak, IDLE_THRESHOLD_W * 8);
  const ticks = [0, maxY / 2, maxY];

  return (
    <div className="reveal bg-cardBg rounded-2xl border border-borderSubtle p-6">
      <div className="flex flex-wrap justify-between items-center gap-y-2 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse"></div>
          <h3 className="text-textMain font-semibold tracking-wider text-sm">REAL-TIME POWER (W)</h3>
        </div>

        <span className="text-xs font-mono text-textMuted tracking-wider hidden sm:inline">ROLLING 60S BUFFER</span>
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-textMuted font-mono text-xs tracking-wider">
            NO SAMPLES YET — WAITING FOR FIRST READING
          </div>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
              stroke="var(--text-muted)" 
              fontSize={11} 
              tickMargin={10}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={[0, maxY]}
              ticks={ticks}
              tickFormatter={cleanTick(0)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }}
              itemStyle={{ color: '#34d399' }}
              labelStyle={{ color: 'var(--text-muted)' }}
            />
            <ReferenceLine
              y={IDLE_THRESHOLD_W}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              label={{ value: `${IDLE_THRESHOLD_W} W idle threshold`, position: 'insideTopRight', fill: 'var(--text-muted)', fontSize: 10 }}
            />
            <Area 
              type="monotone" 
              dataKey="totalPower" 
              stroke="#34d399" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPower)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default PowerChart;
