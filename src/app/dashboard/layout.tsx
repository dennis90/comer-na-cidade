import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut } from '@/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-sm">
              Dashboard
            </Link>
            <Link href="/dashboard/perfil" className="text-sm text-gray-600 hover:text-gray-900">
              Perfil
            </Link>
            <Link href="/dashboard/cardapio" className="text-sm text-gray-600 hover:text-gray-900">
              Cardápio
            </Link>
            <Link href="/dashboard/horarios" className="text-sm text-gray-600 hover:text-gray-900">
              Horários
            </Link>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button variant="ghost" size="sm" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
