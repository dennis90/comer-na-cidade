'use client';

import { CompletenessItem } from '@/lib/completeness';
import { Progress } from '@/components/ui/progress';

interface Props {
  items: CompletenessItem[];
  score: number;
}

export function CompletenessIndicator({ items, score }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Completude do perfil</span>
        <span className="text-gray-500">{score}%</span>
      </div>
      <Progress value={score} className="h-2" />
      <ul className="space-y-1.5 mt-3">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            <span className={item.done ? 'text-green-600' : 'text-gray-400'}>
              {item.done ? '✓' : '○'}
            </span>
            <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
