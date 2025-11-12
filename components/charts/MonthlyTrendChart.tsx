

import React from 'react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line,
} from 'recharts';
import { formatJPY } from '../../utils.ts';
import { Loader } from '../Icons.tsx';

interface MonthlyTrendChartProps {
  data: any[];
}

const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({ data }) => {
    // FIX: Add hasMounted state to prevent recharts useContext error on initial render
    const [hasMounted, setHasMounted] = React.useState(false);
    React.useEffect(() => {
        setHasMounted(true);
    }, []);

    if (!hasMounted) {
        return <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm h-[350px] flex items-center justify-center"><Loader className="w-8 h-8 animate-spin"/></div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">月次業績推移</h3>
            <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis tickFormatter={(value) => `¥${value / 1000}k`} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                        formatter={(value: number) => [formatJPY(value), '']}
                        labelStyle={{ color: '#333' }}
                        itemStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="PQ" name="売上高" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="MQ" name="限界利益" stroke="#8b5cf6" strokeWidth={2} />
                    <Line type="monotone" dataKey="F" name="固定費" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="G" name="利益" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MonthlyTrendChart;