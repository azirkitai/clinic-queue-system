import './_group.css';
import { Settings as SettingsIcon, Monitor, Users, Clock } from 'lucide-react';

export default function WarmCoral() {
  return (
    <div
      className="min-h-screen p-6 antialiased"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        background:
          'linear-gradient(180deg, #fff7f3 0%, #ffeee5 100%)',
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
            <button className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow-md" style={{ background: 'linear-gradient(135deg, #fb7185 0%, #f43f5e 100%)' }}>
              <Monitor className="h-4 w-4" /> Fullscreen TV Display
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Waiting',      value: 12,    sub: 'patients in queue',     icon: '#ea580c', glow: 'from-orange-400/30 to-orange-200/0' },
            { label: 'Called',       value: 3,     sub: 'patients being called', icon: '#2563eb', glow: 'from-blue-400/30 to-blue-200/0' },
            { label: 'Dispensary',   value: 5,     sub: 'awaiting medicine',     icon: '#d97706', glow: 'from-amber-400/30 to-amber-200/0' },
            { label: 'Completed',    value: 47,    sub: 'patients today',        icon: '#16a34a', glow: 'from-green-400/30 to-green-200/0' },
            { label: 'Active Rooms', value: '4/6', sub: 'out of 6 rooms',        icon: '#e11d48', glow: 'from-rose-400/30 to-rose-200/0' },
          ].map((s) => (
            <div
              key={s.label}
              className="relative rounded-xl bg-white shadow-md border border-stone-100 overflow-hidden"
            >
              <div className={`absolute -top-12 -right-12 h-28 w-28 rounded-full bg-gradient-to-br ${s.glow} blur-xl`} />
              <div className="relative p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-stone-600">{s.label}</span>
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${s.icon}15` }}
                  >
                    <Users className="h-4 w-4" style={{ color: s.icon }} />
                  </div>
                </div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: s.icon }}>{s.value}</div>
                <p className="text-xs text-stone-500 mt-1">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* TV Preview */}
        <div className="rounded-xl bg-white border border-stone-200 shadow-md p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">TV Display Preview</h2>
          <div className="rounded-lg overflow-hidden mx-auto" style={{ aspectRatio: '16/9', maxWidth: '640px', background: 'linear-gradient(135deg, #1c1917 0%, #292524 100%)' }}>
            <div className="h-full w-full flex flex-col items-center justify-center text-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-rose-300 mb-2">● Now Calling</p>
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
