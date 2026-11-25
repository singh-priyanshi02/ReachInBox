import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';

export default function Header() {
  const { data: session } = useSession();
  if (!session) return null;
  const { user } = session;
  return (
    <header className="flex items-center justify-between bg-white shadow p-4">
      <div className="flex items-center space-x-3">
        {user?.image && (
          <Image src={user.image} alt={user.name || 'Avatar'} width={40} height={40} className="rounded-full" />
        )}
        <div>
          <p className="font-medium">{user?.name}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
      >
        Logout
      </button>
    </header>
  );
}
