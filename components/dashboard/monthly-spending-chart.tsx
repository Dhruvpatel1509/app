'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fromMinorUnits } from '@/lib/calculations';

interface MonthlyData {
  month: string;
  amount: number;
}

interface MonthlySpendingChartProps {
  data: MonthlyData[];
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

function formatMonth(monthKey: string): string {
  const parts = monthKey.split('-');
  return MONTH_LABELS[parts[1]] ?? monthKey;
}

export function MonthlySpendingChart({ data }: MonthlySpendingChartProps) {
  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    amount: parseFloat(fromMinorUnits(d.amount)),
    raw: d.amount,
  }));

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-stone-900 mb-4">Monthly Spending</h2>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#78716c' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#78716c' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              formatter={(value: any) => [`$${(Number(value) || 0).toFixed(2)}`, 'Spending']}
              contentStyle={{
                background: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#059669"
              strokeWidth={2}
              fill="url(#spendingGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#059669' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
