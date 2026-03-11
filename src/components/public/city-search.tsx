'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface CityResult {
  id: string;
  slug: string;
  name: string;
  state: string;
}

export function CitySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.cities ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [query]);

  function select(city: CityResult) {
    setOpen(false);
    setQuery('');
    router.push(`/restaurantes/${city.state.toLowerCase()}/${city.slug}`);
  }

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!inputRef.current?.closest('[data-city-search]')?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div data-city-search className="relative w-full max-w-md">
      <Input
        ref={inputRef}
        type="text"
        placeholder="Digite o nome da cidade..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="h-12 text-base"
        autoComplete="off"
      />

      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
          {results.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                onClick={() => select(city)}
              >
                <span className="font-medium">{city.name}</span>
                <span className="text-sm text-gray-400">{city.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          ...
        </div>
      )}
    </div>
  );
}
