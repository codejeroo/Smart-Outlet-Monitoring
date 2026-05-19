import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

const timeRanges = ['Live', '1m', '5m', '15m', '1h'];

const PowerChart = ({ data }) => {
  const [activeRange, setActiveRange] = useState('Live');

  return (
    <div className="bg-cardBg rounded-2xl p-6 border border-borderSubtle shadow-lg glass-card">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
          <h3 className="text-textMain font-semibold tracking-wider text-sm">REAL-TIME POWER (W)</h3>
        </div>
        
        <div className="flex space-x-1 bg-background rounded-lg p-1 border border-borderSubtle">
          {timeRanges.map(range => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeRange === range 
                  ? 'bg-primary text-textMain' 
                  : 'text-textMuted hover:text-textMain hover:bg-primary/50'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
              stroke="#ef4444" 
              fontSize={11} 
              tickMargin={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 1500]}
              ticks={[0, 500, 1000, 1500]}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-main)' }}
              itemStyle={{ color: '#ef4444' }}
              labelStyle={{ color: 'var(--text-muted)' }}
            />
            <Area 
              type="monotone" 
              dataKey="totalPower" 
              stroke="#ef4444" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#colorPower)" 
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PowerChart;
