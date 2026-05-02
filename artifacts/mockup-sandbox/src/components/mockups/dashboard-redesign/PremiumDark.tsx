import React, { useState } from 'react';
import './_group.css';
import {
  LayoutDashboard,
  Users,
  Pill,
  CheckCircle2,
  DoorOpen,
  Settings,
  MonitorPlay,
  Bell,
  Search,
  Activity,
  Clock,
  ChevronRight,
  Stethoscope,
  Volume2,
  RefreshCcw,
  Check,
  ArrowRight,
  Maximize2
} from 'lucide-react';

export function PremiumDark() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-300 font-sans selection:bg-cyan-900/50">
      {/* Top Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0F1423] border-b border-slate-800/60 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Klinik Utama 24 Jam <span className="text-cyan-400 font-normal">Tropicana</span></h1>
            </div>
            <p className="text-xs text-slate-500 font-mono tracking-wider uppercase ml-10 mt-1">Patient Queue Dashboard</p>
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-[#151C2C] p-1 rounded-lg border border-slate-800/50">
            {['Dashboard', 'Queue', 'Dispensary', 'Management'].map((item) => (
              <button
                key={item}
                onClick={() => setActiveTab(item.toLowerCase())}
                className={`px-4 py-1.5 text-sm rounded-md transition-all duration-200 ${
                  activeTab === item.toLowerCase()
                    ? 'bg-slate-800 text-white shadow-sm ring-1 ring-slate-700/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search patient..." 
              className="bg-[#151C2C] border border-slate-800 rounded-md py-1.5 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 w-64 placeholder:text-slate-600 transition-all"
            />
          </div>
          
          <button className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-950/30 rounded-md transition-colors relative group">
            <MonitorPlay className="w-5 h-5" />
            <span className="absolute -top-10 right-0 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700">TV Display</span>
          </button>
          
          <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-md transition-colors">
            <Settings className="w-5 h-5" />
          </button>

          <div className="h-6 w-px bg-slate-800 mx-2"></div>

          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200 leading-none">Aman</p>
              <p className="text-xs text-emerald-400 font-mono mt-1">Admin</p>
            </div>
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-medium">
                AM
              </div>
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0F1423] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 max-w-[1600px] mx-auto space-y-6">
        
        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-4">
          <KpiCard title="Waiting" value="12" trend="+2 from avg" icon={Users} color="text-cyan-400" bgColor="bg-cyan-500/10" borderColor="border-cyan-500/20" sparkline="M0,10 L5,8 L10,12 L15,5 L20,10 L25,4 L30,6" />
          <KpiCard title="Calling" value="3" trend="Currently active" icon={Volume2} color="text-emerald-400" bgColor="bg-emerald-500/10" borderColor="border-emerald-500/20" sparkline="M0,8 L5,8 L10,8 L15,4 L20,12 L25,8 L30,8" />
          <KpiCard title="Dispensary" value="5" trend="Awaiting meds" icon={Pill} color="text-amber-400" bgColor="bg-amber-500/10" borderColor="border-amber-500/20" sparkline="M0,5 L10,5 L15,10 L20,2 L25,8 L30,5" />
          <KpiCard title="Completed" value="47" trend="Patients today" icon={CheckCircle2} color="text-indigo-400" bgColor="bg-indigo-500/10" borderColor="border-indigo-500/20" sparkline="M0,15 L5,12 L10,14 L15,8 L20,10 L25,3 L30,0" />
          <KpiCard title="Active Rooms" value="4/6" trend="66% utilization" icon={DoorOpen} color="text-rose-400" bgColor="bg-rose-500/10" borderColor="border-rose-500/20" sparkline="M0,10 L10,10 L15,4 L20,10 L30,10" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (Main Focus) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Current Call Panel */}
            <div className="bg-[#111726] border border-slate-800 rounded-xl overflow-hidden relative group shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h2 className="text-sm font-mono text-emerald-400 uppercase tracking-widest">Active Call</h2>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">Called at 10:42 AM <span className="text-slate-600 px-1">•</span> 1m ago</p>
                  </div>
                  <div className="bg-[#1A233A] border border-slate-700/50 rounded-lg px-4 py-2 text-right">
                    <p className="text-xs text-slate-500 mb-1">Queue No.</p>
                    <p className="text-4xl font-mono font-bold text-white tracking-tighter shadow-sm">A-024</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                  <div>
                    <h3 className="text-3xl font-semibold text-slate-100 mb-2">Ahmad Bin Abdullah</h3>
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="flex items-center gap-1.5 bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-700/50">
                        <DoorOpen className="w-4 h-4 text-cyan-400" />
                        <span className="text-sm font-medium text-slate-200">Bilik 2</span>
                      </div>
                      <span className="text-slate-600">—</span>
                      <div className="flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4" />
                        <span className="text-sm">Dr. Siti</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition-all">
                      <RefreshCcw className="w-4 h-4 text-amber-400" />
                      Recall
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-sm font-medium rounded-lg border border-emerald-500/30 transition-all">
                      <Check className="w-4 h-4" />
                      Complete
                    </button>
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg shadow-[0_0_15px_rgba(8,145,178,0.4)] transition-all">
                      <Pill className="w-4 h-4" />
                      To Dispensary
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Rooms */}
            <div className="bg-[#111726] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800/60 flex justify-between items-center bg-[#151C2C]/50">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500" />
                  Clinic Rooms
                </h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-800">STATUS: LIVE</span>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <RoomCard room="Bilik 1" doctor="Dr. Ahmad" status="active" queue="A-021" />
                  <RoomCard room="Bilik 2" doctor="Dr. Siti" status="calling" queue="A-024" />
                  <RoomCard room="Bilik 3" doctor="Dr. Lee" status="idle" />
                  <RoomCard room="Bilik 4" doctor="Dr. Faridah" status="active" queue="A-019" />
                  <RoomCard room="Bilik 5" doctor="Dr. Raj" status="active" queue="A-022" />
                  <RoomCard room="Bilik 6" doctor="Dr. Wong" status="idle" />
                </div>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* TV Preview */}
            <div className="bg-[#111726] border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800/60 flex justify-between items-center bg-[#151C2C]/50">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <MonitorPlay className="w-4 h-4 text-indigo-400" />
                  TV Preview
                </h3>
                <button className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors group">
                  Fullscreen <Maximize2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
                </button>
              </div>
              <div className="p-4">
                <div className="aspect-video bg-[#0A0E17] rounded-lg border border-slate-800 relative overflow-hidden flex flex-col justify-center items-center group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-transparent opacity-50"></div>
                  <p className="text-slate-500 text-xs uppercase tracking-widest mb-2 z-10">Now Calling</p>
                  <p className="text-4xl font-mono font-bold text-white z-10 shadow-sm drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">A-024</p>
                  <p className="text-indigo-400 text-sm font-medium mt-2 z-10">Bilik 2</p>
                  
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                    <div className="bg-white/10 p-3 rounded-full border border-white/20">
                      <Maximize2 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Now Serving / Queue */}
            <div className="bg-[#111726] border border-slate-800 rounded-xl overflow-hidden flex-1">
              <div className="px-5 py-4 border-b border-slate-800/60 flex justify-between items-center bg-[#151C2C]/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-200">Up Next</h3>
                  <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700">12 Waiting</span>
                </div>
              </div>
              <div className="p-0">
                <div className="divide-y divide-slate-800/60">
                  <QueueItem name="Siti Aminah" no="A-025" time="15m" isPriority={true} />
                  <QueueItem name="Muhammad Hafiz" no="A-026" time="22m" />
                  <QueueItem name="Nurul Aisyah" no="B-012" time="25m" />
                  <QueueItem name="Lim Wei Chen" no="A-027" time="31m" />
                  <QueueItem name="Tan Mei Ling" no="C-005" time="34m" />
                </div>
                <div className="p-3 bg-[#151C2C]/30 text-center">
                  <button className="text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:underline transition-all">
                    View full queue (7 more) →
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents

function KpiCard({ title, value, trend, icon: Icon, color, bgColor, borderColor, sparkline }: any) {
  return (
    <div className="bg-[#111726] border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h4 className="text-sm font-medium text-slate-400">{title}</h4>
        <div className={`p-2 rounded-lg ${bgColor} border ${borderColor}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div className="relative z-10">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-mono font-bold text-slate-100">{value}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          {trend}
        </p>
      </div>
      {/* Decorative Sparkline */}
      <div className="absolute bottom-0 right-0 left-0 h-16 opacity-20 pointer-events-none">
        <svg viewBox="0 0 30 20" preserveAspectRatio="none" className="w-full h-full stroke-current fill-none" style={{ color: 'var(--tw-colors-slate-600)' }} strokeWidth="1">
          <path d={sparkline} vectorEffect="non-scaling-stroke" className={color} strokeWidth="2" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

function RoomCard({ room, doctor, status, queue }: any) {
  const isCalling = status === 'calling';
  const isActive = status === 'active';
  const isIdle = status === 'idle';

  return (
    <div className={`p-4 rounded-lg border ${
      isCalling ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' : 
      isActive ? 'bg-[#151C2C] border-slate-700/50' : 
      'bg-[#0A0E17] border-slate-800/50 opacity-70'
    } transition-all`}>
      <div className="flex justify-between items-start mb-3">
        <h5 className="text-sm font-medium text-slate-300">{room}</h5>
        <div className={`w-2 h-2 rounded-full ${
          isCalling ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 
          isActive ? 'bg-cyan-500' : 'bg-slate-600'
        }`}></div>
      </div>
      <p className="text-xs text-slate-400 mb-2">{doctor}</p>
      <div className="mt-auto h-8 flex items-end">
        {isIdle ? (
          <span className="text-xs font-mono text-slate-600 uppercase">Idle</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-mono border border-slate-700 px-1.5 py-0.5 rounded bg-slate-900/50">{queue}</span>
            {isCalling && <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold ml-1 animate-pulse">Calling</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueItem({ name, no, time, isPriority }: any) {
  return (
    <div className="p-4 flex items-center justify-between hover:bg-[#151C2C]/50 transition-colors group">
      <div className="flex items-center gap-4">
        <div className={`w-12 text-center py-1.5 rounded border font-mono text-sm font-bold ${
          isPriority ? 'bg-rose-950/30 text-rose-400 border-rose-500/30' : 'bg-slate-900 text-slate-300 border-slate-800'
        }`}>
          {no}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-200">{name}</p>
            {isPriority && <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase tracking-wider font-bold">Priority</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Wait: {time}
          </p>
        </div>
      </div>
      <button className="text-slate-500 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all p-2">
        <Volume2 className="w-4 h-4" />
      </button>
    </div>
  );
}
