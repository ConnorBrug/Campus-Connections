import { DollarSign } from 'lucide-react';

export function CostEstimator() {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <DollarSign className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">Estimated cost: $20 – $100+ per person</p>
        <p className="text-xs text-muted-foreground mt-1">
          Varies by route, timing, and luggage. Coordinate with your match for the exact split.
        </p>
      </div>
    </div>
  );
}
