import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const timeRanges = ['Live', '1m', '5m', '15m', '1h'];

const VoltageCurrentChart = ({ data }) => {
  const [activeRange, setActiveRange] = useState('Live');

  return (
    <div className="bg-cardBg rounded-2xl p-6 border border-borderSubtle shadow-lg mt-6 glass-card">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
          <h3 className="text-textMain font-semibold tracking-wider text-sm">VOLTAGE (VRMS) & CURRENT (IRMS)</h3>
          
          <div className="flex items-center ml-4 space-x-4 text-xs font-medium">
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

      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
              domain={[180, 240]}
              ticks={[180, 200, 220, 240]}
              tickFormatter={(value) => `${value} V`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="var(--text-main)" 
              fontSize={11} 
              tickMargin={10}
              tickLine={false}
              axisLine={false}
              domain={[0, 2]}
              ticks={[0, 1.0, 2.0]}
              tickFormatter={(value) => `${value.toFixed(1)} A`}
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
      </div>
    </div>
  );
};

export default VoltageCurrentChart;
