import { useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';

export default function SlackConnect() {
  const { data: session } = useSession();
  const [webhook, setWebhook] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (!session?.user?.email) return null;

  const handleSave = async () => {
    if (!webhook) return;
    setStatus('saving');
    try {
      await axios.post('/api/slack/connect', {
        userId: session.user.email,
        webhookUrl: webhook,
      });
      setStatus('saved');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="url"
        placeholder="Slack webhook URL"
        value={webhook}
        onChange={(e) => setWebhook(e.target.value)}
        className="border rounded px-2 py-1"
      />
      <button
        onClick={handleSave}
        disabled={status === 'saving'}
        className="px-3 py-1 bg-gray-800 text-white rounded hover:bg-gray-900"
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Connect Slack'}
      </button>
      {status === 'error' && <span className="text-red-600">Error</span>}
    </div>
  );
}
