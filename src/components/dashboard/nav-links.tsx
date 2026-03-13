'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/dashboard', label: 'Dashboard', exact: true },
  { href: '/dashboard/perfil', label: 'Perfil' },
  { href: '/dashboard/cardapio', label: 'Cardápio' },
  { href: '/dashboard/horarios', label: 'Horários' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {links.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
