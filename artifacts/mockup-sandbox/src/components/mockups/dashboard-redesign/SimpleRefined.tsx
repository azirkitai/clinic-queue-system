import './_group.css';
import {
  Settings as SettingsIcon,
  Monitor,
  Users,
  Clock,
  Pill,
  CheckCircle2,
  Stethoscope,
  PhoneOutgoing,
  Building2,
  RotateCcw,
  Check,
  Send,
} from 'lucide-react';

const STAT = [
  { label: 'Waiting',     value: 12,    sub: 'patients in queue',    icon: Users,         tone: 'text-amber-600' },
  { label: 'Called',      value: 3,     sub: 'patients being called', icon: PhoneOutgoing, tone: 'text-sky-600' },
  { label: 'Dispensary',  value: 5,     sub: 'awaiting medication',   icon: Pill,          tone: 'text-violet-600' },
  { label: 'Completed',   value: 47,    sub: 'patients today',        icon: CheckCircle2,  tone: 'text-emerald-600' },
  { label: 'Active Rooms',value: '4/6', sub: 'doctors on duty',       icon: Stethoscope,   tone: 'text-blue-600' },
];

const QUEUE = [
  { num: 'A-025', name: 'Siti Aminah',     wait: '12m', priority: true },
  { num: 'A-026', name: 'Muhammad Hafiz',  wait: '15m' },
  { num: 'A-027', name: 'Nurul Aisyah',    wait: '18m' },
  { num: 'A-028', name: 'Lim Wei Chen',    wait: '22m' },
  { num: 'A-029', name: 'Tan Mei Ling',    wait: '25m' },
];

const ROOMS = [
  { name: 'Bilik 1', doctor: 'Dr. Ahmad',   patient: 'A-021', status: 'active' },
  { name: 'Bilik 2', doctor: 'Dr. Siti',    patient: 'A-024', status: 'calling' },
  { name: 'Bilik 3', doctor: 'Dr. Lee',     patient: null,    status: 'idle' },
  { name: 'Bilik 4', doctor: 'Dr. Faridah', patient: 'A-019', status: 'active' },
  { name: 'Bilik 5', doctor: 'Dr. Raj',     patient: 'A-022', status: 'active' },
  { name: 'Bilik 6', doctor: 'Dr. Wong',    patient: null,    status: 'idle' },
];

export default function SimpleRefined() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[1240px] px-6 py-6 space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-base shadow-sm">
              KU
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Klinik Utama 24 Jam Tropicana</h1>
              <p className="text-sm text-slate-500">Dashboard — Patient Calling System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
              <SettingsIcon className="h-4 w-4" /> Settings
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
              <Monitor className="h-4 w-4" /> Fullscreen TV
            </button>
          </div>
        </header>

        {/* Stat Cards */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {STAT.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">{s.label}</span>
                  <Icon className={`h-4 w-4 ${s.tone}`} />
                </div>
                <div className={`text-3xl font-semibold tabular-nums ${s.tone}`}>{s.value}</div>
                <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
              </div>
            );
          })}
        </section>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* Left: Current Call + Active Rooms */}
          <div className="space-y-6 lg:col-span-2">

            {/* Current Call */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Current Call</h2>
                </div>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 10:42 AM · 1 min ago</span>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
                <div>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="text-5xl font-bold tracking-tight text-slate-900 tabular-nums">A-024</span>
                    <span className="text-lg font-medium text-slate-700">Ahmad Bin Abdullah</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2 inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-blue-600" /> Bilik 2 — Dr. Siti
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <RotateCcw className="h-4 w-4" /> Recall
                  </button>
                  <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors">
                    <Check className="h-4 w-4" /> Complete
                  </button>
                  <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-violet-700 transition-colors">
                    <Send className="h-4 w-4" /> Dispensary
                  </button>
                </div>
              </div>
            </div>

            {/* Active Rooms */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 inline-flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-blue-600" /> Active Rooms
                </h2>
                <span className="text-xs text-slate-500">4 of 6 in use</span>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ROOMS.map((r) => {
                  const isCalling = r.status === 'calling';
                  const isActive = r.status === 'active';
                  const isIdle = r.status === 'idle';
                  return (
                    <div
                      key={r.name}
                      className={`rounded-md border p-3 transition-colors ${
                        isCalling
                          ? 'border-blue-300 bg-blue-50/60 ring-1 ring-blue-200'
                          : isActive
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isCalling ? 'bg-blue-500 animate-pulse' : isActive ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{r.doctor}</p>
                      {r.patient ? (
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-mono font-medium ${
                            isCalling
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.patient}
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-wide text-slate-400">Idle</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Up Next + TV Preview */}
          <div className="space-y-6">

            {/* Up Next */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" /> Up Next
                </h2>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{QUEUE.length} waiting</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {QUEUE.map((q) => (
                  <li key={q.num} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-mono font-semibold text-slate-700 tabular-nums">
                      {q.num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{q.name}</p>
                        {q.priority && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                            Priority
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 inline-flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> waiting {q.wait}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-5 py-2.5">
                <button className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                  View all queue
                </button>
              </div>
            </div>

            {/* TV Preview */}
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 inline-flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-600" /> TV Display Preview
                </h2>
                <button className="text-xs font-medium text-blue-600 hover:text-blue-700">Open fullscreen</button>
              </div>
              <div className="p-5">
                <div className="rounded-md bg-slate-900 aspect-video flex flex-col items-center justify-center text-white">
                  <p className="text-xs uppercase tracking-wider text-emerald-400 mb-1">Now Calling</p>
                  <p className="text-4xl font-bold tabular-nums">A-024</p>
                  <p className="text-sm text-slate-300 mt-1">Bilik 2 — Dr. Siti</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        <footer className="text-center text-xs text-slate-400 pt-2">
          © 2026 Clinic Queue System · QueTAMA
        </footer>
      </div>
    </div>
  );
}
