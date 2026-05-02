import React from 'react';
import './_group.css';
import { 
  Settings, 
  Monitor, 
  Users, 
  UserCircle, 
  Pill, 
  CheckCircle2, 
  Stethoscope,
  Volume2,
  Check,
  Send,
  MoreHorizontal,
  Maximize2,
  Clock,
  AlertCircle
} from 'lucide-react';

export function MedicalClean() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-teal-100">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm shadow-slate-200/20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20 text-white font-bold text-lg">
            K
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 leading-tight">
              Klinik Utama 24 Jam Tropicana
            </h1>
            <p className="text-sm text-slate-500 font-medium">Patient Queue Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-slate-200">
            <button className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 rounded-xl transition-colors font-medium text-sm">
              <Monitor className="w-4 h-4" />
              Fullscreen TV
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900">Aman</p>
              <p className="text-xs text-slate-500">Admin</p>
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-600 font-medium">
                A
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-8 space-y-8">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard title="Waiting" value="12" subtitle="+2 since last hour" icon={Users} color="orange" />
            <KpiCard title="Called" value="3" subtitle="Currently active" icon={UserCircle} color="sky" />
            <KpiCard title="Dispensary" value="5" subtitle="Awaiting pickup" icon={Pill} color="purple" />
            <KpiCard title="Completed" value="47" subtitle="Patients today" icon={CheckCircle2} color="emerald" />
            <KpiCard title="Active Rooms" value="4/6" subtitle="Doctors on duty" icon={Stethoscope} color="indigo" />
          </div>

          {/* Current Call Panel */}
          <section className="bg-white rounded-[24px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
              <h2 className="text-sm font-semibold text-teal-600 uppercase tracking-wider">Current Call</h2>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-end gap-4 mb-2">
                  <span className="text-5xl font-bold tracking-tight text-slate-900">A-024</span>
                  <span className="text-xl font-medium text-slate-400 mb-1">Bilik 2 — Dr. Siti</span>
                </div>
                <h3 className="text-2xl font-semibold text-slate-700">Ahmad Bin Abdullah</h3>
                <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Called at 10:42 AM (1 minute ago)
                </p>
              </div>

              <div className="flex flex-col gap-3 w-full md:w-auto">
                <button className="flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-xl font-semibold transition-colors w-full">
                  <Volume2 className="w-5 h-5" />
                  Recall
                </button>
                <div className="flex gap-3">
                  <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl font-semibold transition-all shadow-sm shadow-emerald-500/20">
                    <Check className="w-5 h-5" />
                    Complete
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-semibold transition-colors">
                    <Send className="w-5 h-5" />
                    Dispensary
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Active Rooms */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4 px-1">Active Rooms</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <RoomCard name="Bilik 1" doctor="Dr. Ahmad" status="A-021" active />
              <RoomCard name="Bilik 2" doctor="Dr. Siti" status="A-024" active highlight />
              <RoomCard name="Bilik 3" doctor="Dr. Lee" status="Idle" />
              <RoomCard name="Bilik 4" doctor="Dr. Faridah" status="A-019" active />
              <RoomCard name="Bilik 5" doctor="Dr. Raj" status="A-022" active />
              <RoomCard name="Bilik 6" doctor="Dr. Wong" status="Idle" />
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-8">
          {/* Now Serving Queue */}
          <section className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Waiting Queue</h2>
              <span className="text-xs font-semibold bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full">
                12 Waiting
              </span>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <QueueItem number="A-025" name="Siti Aminah" time="15m" priority />
              <QueueItem number="A-026" name="Muhammad Hafiz" time="18m" />
              <QueueItem number="A-027" name="Nurul Aisyah" time="22m" />
              <QueueItem number="A-028" name="Lim Wei Chen" time="25m" />
              <QueueItem number="A-029" name="Tan Mei Ling" time="31m" />
            </div>

            <button className="mt-4 w-full py-3 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors">
              View all 12 patients
            </button>
          </section>

          {/* TV Preview */}
          <section className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900">TV Display</h2>
              <button className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden relative shadow-inner">
              {/* Fake TV Content */}
              <div className="absolute inset-0 flex flex-col">
                <div className="bg-teal-600 text-white p-3 flex justify-between items-center">
                  <span className="font-semibold text-sm">Klinik Utama</span>
                  <span className="text-xs opacity-80">10:42 AM</span>
                </div>
                <div className="flex-1 flex items-center justify-center gap-6 p-4">
                  <div className="text-center">
                    <p className="text-teal-400 text-xs font-semibold uppercase">Now Calling</p>
                    <p className="text-white text-4xl font-bold mt-1">A-024</p>
                    <p className="text-slate-300 text-sm mt-1">Bilik 2</p>
                  </div>
                  <div className="w-px h-16 bg-slate-700"></div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-slate-400 w-24">
                      <span>A-021</span><span>Bilik 1</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 w-24">
                      <span>A-019</span><span>Bilik 4</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, color }: any) {
  const colors = {
    orange: 'bg-orange-50 text-orange-600',
    sky: 'bg-sky-50 text-sky-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-xs font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
        <p className="text-slate-400 text-[10px] mt-1 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

function RoomCard({ name, doctor, status, active, highlight }: any) {
  return (
    <div className={`p-4 rounded-[18px] border transition-colors ${
      highlight ? 'bg-teal-50 border-teal-100 ring-1 ring-teal-500/10' : 
      active ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50/50 border-slate-100 text-slate-400'
    }`}>
      <div className="flex justify-between items-center mb-3">
        <h4 className={`font-semibold ${highlight ? 'text-teal-800' : active ? 'text-slate-800' : 'text-slate-500'}`}>
          {name}
        </h4>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${
            active ? 'bg-emerald-400' : 'bg-slate-300'
          }`}></div>
        </div>
      </div>
      <p className={`text-sm mb-1 ${highlight ? 'text-teal-600' : active ? 'text-slate-600' : 'text-slate-400'}`}>
        {doctor}
      </p>
      <div className={`text-xs font-semibold inline-block px-2 py-1 rounded-md ${
        highlight ? 'bg-teal-100 text-teal-700' : 
        active ? 'bg-slate-100 text-slate-600' : 'bg-transparent text-slate-400 px-0'
      }`}>
        {status}
      </div>
    </div>
  );
}

function QueueItem({ number, name, time, priority }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group cursor-default">
      <div className="flex items-center gap-4">
        <div className="w-12 text-left">
          <span className="font-bold text-slate-700">{number}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            {name}
            {priority && (
              <AlertCircle className="w-3 h-3 text-red-500" />
            )}
          </p>
          <p className="text-xs text-slate-400">Wait: {time}</p>
        </div>
      </div>
      <button className="text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
        <MoreHorizontal className="w-5 h-5" />
      </button>
    </div>
  );
}
