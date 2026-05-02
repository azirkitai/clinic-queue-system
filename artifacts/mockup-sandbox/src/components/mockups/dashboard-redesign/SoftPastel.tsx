import './_group.css';
import { Settings as SettingsIcon, Monitor, Users, Clock } from 'lucide-react';

export default function SoftPastel() {
  return (
    <div
      className="min-h-screen p-6 antialiased"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        background: '#fdfaf6',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(120, 113, 108, 0.18) 1px, transparent 0)',
        backgroundSize: '22px 22px',
      }}
    >
      <div className="space-y-6 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
            <p className="text-stone-500 text-sm">Main dashboard for clinic calling system</p>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50">
              <SettingsIcon className="h-4 w-4" /> Settings
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #f59e7d 0%, #f472b6 100%)' }}>
              <Monitor className="h-4 w-4" /> Fullscreen TV Display
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Waiting',      value: 12,    sub: 'patients in queue',     bg: '#fef3e8', txt: '#c2410c', accent: '#fed7aa' },
            { label: 'Called',       value: 3,     sub: 'patients being called', bg: '#e8f1fb', txt: '#1d4ed8', accent: '#bfdbfe' },
            { label: 'Dispensary',   value: 5,     sub: 'awaiting medicine',     bg: '#fff4e6', txt: '#b45309', accent: '#fde68a' },
            { label: 'Completed',    value: 47,    sub: 'patients today',        bg: '#e8f5ec', txt: '#15803d', accent: '#bbf7d0' },
            { label: 'Active Rooms', value: '4/6', sub: 'out of 6 rooms',        bg: '#f0ebfc', txt: '#6d28d9', accent: '#ddd6fe' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-5 shadow-sm border"
              style={{ background: s.bg, borderColor: s.accent }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-stone-600">{s.label}</span>
                <Users className="h-4 w-4" style={{ color: s.txt }} />
              </div>
              <div className="text-3xl font-bold tabular-nums" style={{ color: s.txt }}>{s.value}</div>
              <p className="text-xs text-stone-500 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* TV Preview */}
        <div className="rounded-xl bg-white border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">TV Display Preview</h2>
          <div className="rounded-lg overflow-hidden mx-auto" style={{ aspectRatio: '16/9', maxWidth: '640px', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
            <div className="h-full w-full flex flex-col items-center justify-center text-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-2">● Now Calling</p>
              <p className="text-7xl font-black tabular-nums">A-024</p>
              <p className="text-xl text-stone-200 mt-3">Bilik 2 — Dr. Siti</p>
              <div className="flex gap-6 mt-6 text-xs text-stone-300">
                <span>Next: A-025</span><span>·</span><span>Klinik Utama</span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Monitor className="h-4 w-4" /> View Full Display
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
