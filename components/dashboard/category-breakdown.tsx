'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/calculations';

const COLORS = [
  '#059669', '#14b8a6', '#0284c7', '#7c3aed',
  '#ec4899', '#f97316', '#eab308', '#6b7280',
];

interface CategoryData {
  name: string;
  amount: number;
}

interface CategoryBreakdownProps {
  data: CategoryData[];
  totalMinor: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Groceries',
  dining: 'Dining',
  transport: 'Transport',
  travel: 'Travel',
  household: 'Household',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  bills: 'Bills',
  other: 'Other',
};

export function CategoryBreakdown({ data, totalMinor }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="font-semibold text-stone-900 mb-3">Category Breakdown</h2>
        <p className="text-sm text-stone-400 text-center py-4">No spending this month</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: CATEGORY_LABELS[d.name] ?? d.name,
    value: d.amount,
  }));

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-stone-900 mb-4">Category Breakdown</h2>
      <div className="h-32 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={55}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => [formatCurrency(Number(value) || 0), 'Spent']}
              contentStyle={{
                background: '#fff',
                border: '1px solid #e7e5e4',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {chartData.slice(0, 5).map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-xs text-stone-600 flex-1 truncate">{d.name}</span>
            <span className="text-xs font-medium text-stone-700">
              {formatCurrency(d.value)}
            </span>
            <span className="text-xs text-stone-400">
              {totalMinor > 0 ? `${Math.round((d.value / totalMinor) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
