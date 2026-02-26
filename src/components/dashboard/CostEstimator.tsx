import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export function CostEstimator() {
  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <DollarSign className="h-5 w-5 text-primary" />
          Estimated Cost
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Estimated ride costs per person typically range from about $20 to $100+, depending on the route and timing.
          We also factor in luggage when matching riders, and we generally aim for a combined total of two carry-on items
          or fewer and three checked bags or fewer.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          This is an estimate. Actual cost may vary based on distance, ride-sharing service prices at the time of booking, and number of passengers. Coordinate with your match for exact details.
        </p>
      </CardContent>
    </Card>
  );
}
