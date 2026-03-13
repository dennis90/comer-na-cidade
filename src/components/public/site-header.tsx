import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          🍽 Comer na Cidade
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            Área do comércio
          </Link>
        </nav>
      </div>
    </header>
  );
}
