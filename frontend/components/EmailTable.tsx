import React from 'react';

interface Email {
  id: string;
  sender: string;
  subject: string;
  to: string;
  scheduledAt: string;
  sentAt?: string;
  status: string;
}

export default function EmailTable({ data }: { data: Email[] }) {
  if (!data || data.length === 0) {
    return <div className="text-gray-500">No records found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-auto border">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Subject</th>
            <th className="px-4 py-2 text-left">Scheduled Time</th>
            <th className="px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((email) => (
            <tr key={email.id} className="border-t">
              <td className="px-4 py-2">{email.to}</td>
              <td className="px-4 py-2">{email.subject}</td>
              <td className="px-4 py-2">
                {new Date(email.scheduledAt).toLocaleString()}
              </td>
              <td className="px-4 py-2 capitalize">{email.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
