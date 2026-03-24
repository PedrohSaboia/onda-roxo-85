import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ElementType;
  color?: 'custom' | 'blue' | 'green' | 'orange' | 'red' | 'teal' | 'indigo' | 'pink' | 'yellow';
}

const colorStyles = {
  custom: 'from-custom-500 to-custom-600',
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  orange: 'from-orange-500 to-orange-600',
  red: 'from-red-500 to-red-600',
  teal: 'from-teal-500 to-teal-600',
  indigo: 'from-indigo-500 to-indigo-600',
  pink: 'from-pink-500 to-pink-600',
  yellow: 'from-yellow-500 to-yellow-600',
};

const borderStyles: Record<string, string> = {
  custom: 'border-custom-600',
  blue: 'border-blue-600',
  green: 'border-green-600',
  orange: 'border-orange-600',
  red: 'border-red-600',
  teal: 'border-teal-600',
  indigo: 'border-indigo-600',
  pink: 'border-pink-600',
  yellow: 'border-yellow-600',
};

export function MetricCard({ 
  title, 
  value, 
  description, 
  trend, 
  trendValue, 
  icon: Icon,
  color = 'custom' 
}: MetricCardProps) {
  return (
    <Card className={cn("relative overflow-hidden border-2", borderStyles[color])}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-5", colorStyles[color])} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className={cn("p-2 rounded-lg bg-gradient-to-br", colorStyles[color])}>
            <Icon className="h-4 w-4 text-white" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
            {trend && trend !== 'neutral' && (
              <>
                {trend === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                {trendValue && (
                  <span className={cn(
                    "font-medium",
                    trend === 'up' ? "text-green-500" : "text-red-500"
                  )}>
                    {trendValue}
                  </span>
                )}
              </>
            )}
            <span>{description}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}