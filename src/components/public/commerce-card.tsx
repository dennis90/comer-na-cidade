import Link from 'next/link';
import Image from 'next/image';
import type { Commerce, City, Category } from '@/db/schema';

interface Props {
  commerce: Commerce & {
    city: City | null;
    categories: Category[];
    modalities: string[];
  };
}

const MODALITY_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  dine_in: 'Local',
  takeout: 'Retirada',
};

export function CommerceCard({ commerce }: Props) {
  return (
    <Link
      href={`/comercio/${commerce.slug}`}
      className="flex items-start gap-4 rounded-xl border bg-white p-4 hover:border-gray-400 transition-colors"
    >
      {commerce.logoUrl ? (
        <Image
          src={commerce.logoUrl}
          alt={`Logo de ${commerce.name}`}
          width={56}
          height={56}
          className="rounded-lg object-cover border flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400 text-xl">
          🍽
        </div>
      )}
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{commerce.name}</h3>
        {commerce.city && (
          <p className="text-xs text-gray-500 mt-0.5">
            {commerce.city.name}, {commerce.city.state}
          </p>
        )}
        {commerce.description && (
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{commerce.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {commerce.categories.map((cat) => (
            <span key={cat.id} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
              {cat.name}
            </span>
          ))}
          {commerce.modalities.map((mod) => (
            <span key={mod} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {MODALITY_LABELS[mod] ?? mod}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
