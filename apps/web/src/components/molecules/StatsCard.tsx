/**
 * Stats Card Component
 * 
 * Displays a single metric with optional trend indicator.
 * Supports navigation when `to` prop is provided.
 */

import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  to?: string; // Navigation link
}

export function StatsCard({ title, value, icon: Icon, description, trend, className = '', to }: StatsCardProps) {
  const content = (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
        {trend && (
          <div className={`mt-2 flex items-center text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            <span>{trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%</span>
            <span className="ml-1 text-gray-500">vs last hour</span>
          </div>
        )}
      </div>
      <div className="p-3 bg-cf-orange/10 rounded-xl">
        <Icon className="h-6 w-6 text-cf-orange" />
      </div>
    </div>
  );

  const cardClassName = `card p-6 ${className} ${to ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`;

  if (to) {
    return (
      <Link to={to} className={cardClassName}>
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClassName}>
      {content}
    </div>
  );
}
