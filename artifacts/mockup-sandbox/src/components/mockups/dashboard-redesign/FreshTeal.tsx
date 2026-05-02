import './_group.css';
import { Settings as SettingsIcon, Monitor, Users, Clock } from 'lucide-react';

export default function FreshTeal() {
  return (
    <div
      className="min-h-screen p-6 antialiased bg-slate-50"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundImage:
          'linear-gradient(135deg, rgba(20,184,166,0.04) 0%, rgba(99,102,241,0.04) 100%), repeating-linear-gradient(45deg, transparent 0 20px, rgba(15,118,110,0.025) 20px 21px)',
      }}
    >
      <div className="space-y-6 max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm">Main dashboard for clinic calling system</p>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <SettingsIcon className="h-4 w-4" /> Settings
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-600 px-4 text-sm font-medium text-white shadow-md hover:bg-teal-700">
              <Monitor className="h-4 w-4" /> Fullscreen TV Display
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Waiting',      value: 12,    sub: 'patients in queue',     accent: '#f59e0b' },
            { label: 'Called',       value: 3,     sub: 'patients being called', accent: '#0ea5e9' },
            { label: 'Dispensary',   value: 5,     sub: 'awaiting medicine',     accent: '#f97316' },
            { label: 'Completed',    value: 47,    sub: 'patients today',        accent: '#10b981' },
            { label: 'Active Rooms', value: '4/6', sub: 'out of 6 rooms',        accent: '#0d9488' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg bg-white shadow-sm border border-slate-200 overflow-hidden"
            >
              <div className="h-1" style={{ background: s.accent }} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">{s.label}</span>
                  <Users className="h-4 w-4" style={{ color: s.accent }} />
                </div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: s.accent }}>{s.value}</div>
                <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* TV Preview */}
        <div className="rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-500" />
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">TV Display Preview</h2>
            <div className="rounded-lg overflow-hidden mx-auto bg-slate-900" style={{ aspectRatio: '16/9', maxWidth: '640px' }}>
              <div className="h-full w-full flex flex-col items-center justify-center text-white p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-teal-300 mb-2">● Now Calling</p>
                <p className="text-7xl font-black tabular-nums">A-024</p>
                <p className="text-xl text-slate-200 mt-3">Bilik 2 — Dr. Siti</p>
                <div className="flex gap-6 mt-6 text-xs text-slate-400">
                  <span>Next: A-025</span><span>·</span><span>Klinik Utama</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Monitor className="h-4 w-4" /> View Full Display
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
