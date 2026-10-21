import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Plus, Trash2, Copy, Check } from 'lucide-react';
import { danaApi, type DanaDevice } from '@/features/dana/api/dana.api';
import { formatDateTime } from '@/lib/format';

export function DanaDevicesPage() {
  const qc = useQueryClient();
  const [labelInput, setLabelInput] = useState('');
  const [newToken, setNewToken] = useState<{ label: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['dana-devices'],
    queryFn: danaApi.listDevices,
  });

  const register = useMutation({
    mutationFn: (label: string) => danaApi.registerDevice(label),
    onSuccess: (data) => {
      setNewToken({ label: data.label, token: data.token });
      setLabelInput('');
      qc.invalidateQueries({ queryKey: ['dana-devices'] });
    },
  });

  const revoke = useMutation({
    mutationFn: (deviceId: string) => danaApi.revokeDevice(deviceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dana-devices'] }),
  });

  function copyToken(token: string) {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">DANA Devices</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            HP Android yang terhubung untuk menangkap notifikasi DANA
          </p>
        </div>
      </div>

      {/* Register new device */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Daftarkan Device Baru
        </h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Label (contoh: HP Samsung saya)"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && labelInput.trim()) register.mutate(labelInput.trim());
            }}
          />
          <button
            disabled={!labelInput.trim() || register.isPending}
            onClick={() => register.mutate(labelInput.trim())}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Daftarkan
          </button>
        </div>

        {/* Token shown once after registration */}
        {newToken && (
          <div className="mt-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
              ⚠️ Simpan token ini sekarang — hanya ditampilkan sekali!
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-2">
              Device: <strong>{newToken.label}</strong>
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-yellow-100 dark:bg-yellow-900/40 rounded px-3 py-2 font-mono text-yellow-900 dark:text-yellow-200 break-all">
                {newToken.token}
              </code>
              <button
                onClick={() => copyToken(newToken.token)}
                className="shrink-0 p-2 rounded-lg bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />}
              </button>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 underline"
            >
              Saya sudah menyimpan token ini
            </button>
          </div>
        )}
      </div>

      {/* Device list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Device Terdaftar ({devices.length})
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Memuat...</div>
        ) : devices.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Belum ada device terdaftar</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Label</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Didaftarkan</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {devices.map((d: DanaDevice) => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{d.label}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                    {formatDateTime(d.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    {d.revokedAt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Dicabut
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!d.revokedAt && (
                      <button
                        onClick={() => {
                          if (confirm(`Cabut akses device "${d.label}"?`)) revoke.mutate(d.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Cabut akses"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
