import React from 'react';
import { HistoryRecord } from '../types';

interface LineChartProps {
    history: HistoryRecord[];
    sensorHistoryLength: number;
}

const LineChart: React.FC<LineChartProps> = ({ history, sensorHistoryLength }) => {
    const data = history.slice(0, sensorHistoryLength).reverse();

    if (data.length < 2) {
        return <div className="flex items-center justify-center h-48 text-gray-500">Waiting for data...</div>;
    }

    const width = 500;
    const height = 150;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const normalize = (val: number, min: number, max: number) => {
        return (val - min) / (max - min);
    };
    
    const getPath = (key: 'ph' | 'moisture' | 'temperature') => {
        const ranges = {
            ph: { min: 4, max: 9 },
            moisture: { min: 0, max: 100 },
            temperature: { min: 0, max: 50 }
        };
        const range = ranges[key];
        
        return data.map((d, i) => {
            const x = (i / (data.length - 1)) * chartWidth;
            const y = chartHeight - normalize(d.data[key], range.min, range.max) * chartHeight;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(' ');
    };
    
    const phPath = getPath('ph');
    const moisturePath = getPath('moisture');
    const tempPath = getPath('temperature');

    return (
        <div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    <path d={moisturePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                    <path d={phPath} fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
                    <path d={tempPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                </g>
            </svg>
            <div className="flex justify-center space-x-4 text-xs mt-2">
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-500 mr-1.5"></span>Moisture</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-green-500 mr-1.5"></span>pH</div>
                <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-500 mr-1.5"></span>Temperature</div>
            </div>
        </div>
    );
};

export default LineChart;
