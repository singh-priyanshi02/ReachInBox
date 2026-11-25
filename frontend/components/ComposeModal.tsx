import { useState } from 'react';
import axios from 'axios';

export default function ComposeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [toList, setToList] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [delayBetween, setDelayBetween] = useState('2000'); // ms
  const [hourlyLimit, setHourlyLimit] = useState('200');
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        // simple CSV split by newlines, commas ignored for now
        const emails = text
          .split(/[\r\n]+/)
          .map((l) => l.trim())
          .filter((l) => l);
        setToList(emails.join(','));
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/schedule', {
        sender: 'no-reply@reachinbox.com', // placeholder, can be replaced by UI later
        subject,
        body,
        to: toList,
        scheduleTime,
        // additional fields for delay & limit are sent via env config, not per‑job
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to schedule email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold mb-4">Compose New Email</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full border rounded p-2"
          />
          <textarea
            placeholder="Body (HTML allowed)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            className="w-full border rounded p-2 h-32"
          />
          <div className="flex items-center space-x-2">
            <label className="cursor-pointer bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
              Upload CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            </label>
            <span>{file ? file.name : 'No file selected'}</span>
          </div>
          <div className="text-sm text-gray-600">Detected recipients: {toList ? toList.split(',').length : 0}</div>
          <input
            type="datetime-local"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            required
            className="w-full border rounded p-2"
          />
          {/* Advanced options – not used by backend directly but kept for UI completeness */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Delay between emails (ms)"
              value={delayBetween}
              onChange={(e) => setDelayBetween(e.target.value)}
              className="border rounded p-2"
            />
            <input
              type="number"
              placeholder="Hourly limit"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="border rounded p-2"
            />
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              {loading ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
