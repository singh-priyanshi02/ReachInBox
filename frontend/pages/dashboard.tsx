import { useState, useEffect } from 'react';
import Header from '../components/Header';
import ComposeModal from '../components/ComposeModal';
import EmailTable from '../components/EmailTable';
import SlackConnect from '../components/SlackConnect';
import axios from 'axios';

import { useSession, signIn } from 'next-auth/react';
export default function Dashboard() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!session) {
    signIn('google');
    return null;
  }

  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [showCompose, setShowCompose] = useState(false);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [schedRes, sentRes] = await Promise.all([
        axios.get('/api/scheduled'),
        axios.get('/api/sent'),
      ]);
      setScheduled(schedRes.data);
      setSent(sentRes.data);
    } catch (e) {
      console.error('Failed to fetch emails', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCompose(true)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Compose New Email
            </button>
            <SlackConnect />
          </div>
        </div>
        {/* Tabs */}
        <div className="border-b mb-4">
          <nav className="flex space-x-4">
            <button
              className={`pb-2 ${tab === 'scheduled' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setTab('scheduled')}
            >
              Scheduled Emails
            </button>
            <button
              className={`pb-2 ${tab === 'sent' ? 'border-b-2 border-blue-600' : ''}`}
              onClick={() => setTab('sent')}
            >
              Sent Emails
            </button>
          </nav>
        </div>
        {tab === 'scheduled' ? (
          <EmailTable data={scheduled} />
        ) : (
          <EmailTable data={sent} />
        )}
      </main>
      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onSuccess={fetchData} />}
    </div>
  );
}
