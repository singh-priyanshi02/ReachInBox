import { useSession, signIn, signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">ReachInbox</h1>
      <button
        onClick={() => signIn('google')}
        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Sign in with Google
      </button>
    </div>
  );
}
