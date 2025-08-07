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
          Estimated costs per person for a ride can range from $20 to over $100 in some scenarios. We will try our best to factor in the number of bags you are bringing. As such, we try our best to have matches have a combined total of 2 or less personal items and 3 or less checked bags.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          This is an estimate. Actual cost may vary based on distance, ride-sharing service prices at the time of booking, and number of passengers. Coordinate with your match for exact details.
        </p>
      </CardContent>
    </Card>
  );
}
