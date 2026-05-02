import './_group.css';
import React from 'react';
import { 
  Settings, 
  Monitor, 
  Users, 
  PhoneOutgoing, 
  Pill, 
  CheckCircle2, 
  Stethoscope, 
  Clock,
  RotateCcw,
  Check,
  Send,
  ChevronRight,
  Play,
  Volume2,
  Maximize2,
  Building2
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const GLASS_CARD = "bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden";
const TEXT_GRADIENT = "bg-gradient-to-br from-teal-300 via-cyan-400 to-indigo-400 bg-clip-text text-transparent";

export function ModernGlass() {
  return (
    <div className="min-h-screen w-full bg-[#08080c] text-slate-200 overflow-y-auto relative font-sans">
      {/* Aurora Background Effects */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-teal-500/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[70%] bg-indigo-600/20 rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed top-[20%] right-[10%] w-[40%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Subtle grid pattern overlay */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay"></div>

      <div className="relative z-10 flex flex-col p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto gap-8">
        
        {/* Header */}
        <header className={`${GLASS_CARD} p-4 px-6 flex items-center justify-between`}>
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <h1 className={`text-xl font-bold tracking-tight ${TEXT_GRADIENT}`}>Klinik Utama 24 Jam Tropicana</h1>
              <span className="text-xs text-slate-400 font-medium tracking-wide uppercase">Patient Queue Dashboard</span>
            </div>
            
            <nav className="hidden lg:flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
              {['Dashboard', 'Queue', 'Dispensary', 'Management', 'Settings'].map((item, i) => (
                <button 
                  key={item} 
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
                    i === 0 
                      ? 'bg-white/10 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <button className="h-10 px-4 flex items-center gap-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 transition-all duration-300 font-medium shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Monitor className="w-4 h-4" />
              <span>TV Display</span>
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            
            <div className="w-px h-8 bg-white/10 mx-2" />
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-200">Aman</p>
                <p className="text-xs text-slate-400">Admin</p>
              </div>
              <div className="relative">
                <Avatar className="border-2 border-indigo-500/30">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-cyan-500 text-white">AM</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#08080c] rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="Waiting" value="12" icon={Users} color="cyan" trend="+2 since last hour" />
          <StatCard title="Called" value="3" icon={PhoneOutgoing} color="indigo" trend="Active now" />
          <StatCard title="Dispensary" value="5" icon={Pill} color="teal" trend="Awaiting meds" />
          <StatCard title="Completed" value="47" icon={CheckCircle2} color="emerald" trend="Patients today" />
          <StatCard title="Active Rooms" value="4/6" icon={Stethoscope} color="sky" trend="Operating" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column (Current Call + Rooms) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Current Call Panel */}
            <div className={`${GLASS_CARD} relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="relative p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-bold tracking-wider uppercase flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                      Now Calling
                    </span>
                    <span className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> 10:42 AM (1 min ago)
                    </span>
                  </div>
                  
                  <h2 className="text-5xl font-black text-white tracking-tight mb-2 flex items-baseline gap-4">
                    A-024 
                    <span className="text-2xl font-medium text-slate-400 tracking-normal">Ahmad Bin Abdullah</span>
                  </h2>
                  <p className="text-xl font-medium text-indigo-300 flex items-center gap-2">
                    <Building2 className="w-5 h-5" /> Bilik 2 — Dr. Siti
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[200px]">
                  <button className="py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.4)] transition-all transform hover:scale-[1.02] active:scale-95">
                    <RotateCcw className="w-4 h-4" /> Recall (Announce)
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-400 font-medium flex items-center justify-center gap-2 transition-all">
                      <Check className="w-4 h-4" /> Complete
                    </button>
                    <button className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-teal-500/20 border border-white/10 hover:border-teal-500/30 text-slate-300 hover:text-teal-400 font-medium flex items-center justify-center gap-2 transition-all">
                      <Pill className="w-4 h-4" /> Rx
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Rooms */}
            <div className={`${GLASS_CARD} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-indigo-400" />
                  Active Rooms
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { room: "Bilik 1", doctor: "Dr. Ahmad", status: "busy", queue: "A-021" },
                  { room: "Bilik 2", doctor: "Dr. Siti", status: "active", queue: "A-024" },
                  { room: "Bilik 3", doctor: "Dr. Lee", status: "idle", queue: null },
                  { room: "Bilik 4", doctor: "Dr. Faridah", status: "busy", queue: "A-019" },
                  { room: "Bilik 5", doctor: "Dr. Raj", status: "busy", queue: "A-022" },
                  { room: "Bilik 6", doctor: "Dr. Wong", status: "idle", queue: null },
                ].map((r, i) => (
                  <div key={i} className="relative p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{r.room}</span>
                      {r.status === 'active' && <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />}
                      {r.status === 'busy' && <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                      {r.status === 'idle' && <span className="w-2 h-2 rounded-full bg-slate-600" />}
                    </div>
                    <div className="text-sm text-slate-400">{r.doctor}</div>
                    <div className="mt-2 flex items-center h-8">
                      {r.queue ? (
                        <Badge variant="outline" className={`bg-black/20 border-white/10 font-mono text-sm ${r.status === 'active' ? 'text-cyan-300 border-cyan-500/30' : 'text-emerald-300'}`}>
                          {r.queue}
                        </Badge>
                      ) : (
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Idle</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (Queue List + TV Preview) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Queue List */}
            <div className={`${GLASS_CARD} p-6 flex-1 flex flex-col`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  Up Next
                </h3>
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">5 Waiting</Badge>
              </div>

              <div className="flex flex-col gap-3 flex-1">
                {[
                  { num: "A-025", name: "Siti Aminah", wait: "12m", prio: true },
                  { num: "A-026", name: "Muhammad Hafiz", wait: "15m", prio: false },
                  { num: "A-027", name: "Nurul Aisyah", wait: "18m", prio: false },
                  { num: "A-028", name: "Lim Wei Chen", wait: "22m", prio: false },
                  { num: "A-029", name: "Tan Mei Ling", wait: "25m", prio: false },
                ].map((q, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group cursor-pointer">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold font-mono text-sm ${q.prio ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-black/20 text-slate-300 border border-white/5'}`}>
                      {q.num}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-200 truncate flex items-center gap-2">
                        {q.name}
                        {q.prio && <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">Priority</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Waiting {q.wait}
                      </div>
                    </div>
                    <button className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-cyan-500/20 hover:text-cyan-300">
                      <PhoneOutgoing className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <button className="mt-4 w-full py-3 rounded-xl border border-white/5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                View All Queue <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* TV Preview */}
            <div className={`${GLASS_CARD} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
                  <Monitor className="w-4 h-4 text-slate-400" /> TV Preview
                </h3>
              </div>
              
              <div className="aspect-video rounded-xl bg-[#0a0a0f] border border-white/10 overflow-hidden relative group">
                <div className="absolute inset-0 flex flex-col">
                  {/* Fake TV UI */}
                  <div className="h-1/4 bg-slate-900 border-b border-white/5 flex items-center px-4 justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Calling</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">10:42 AM</span>
                  </div>
                  <div className="flex-1 bg-gradient-to-br from-indigo-900/50 to-cyan-900/50 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-white font-mono tracking-tight shadow-sm">A-024</span>
                    <span className="text-xs font-semibold text-cyan-300 uppercase mt-1 tracking-widest">Bilik 2</span>
                  </div>
                </div>
                
                {/* Overlay Action */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="flex flex-col items-center gap-2 text-white">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/30">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium">Fullscreen</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, trend }: any) {
  const colorMap = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    teal: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    sky: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  };

  const bgClasses = colorMap[color as keyof typeof colorMap];

  return (
    <div className={`${GLASS_CARD} p-5 relative overflow-hidden group`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity bg-${color}-500 pointer-events-none`}></div>
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">{title}</span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${bgClasses}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-black text-white font-mono tracking-tight">{value}</div>
          <div className="text-xs font-medium mt-1 text-slate-500">{trend}</div>
        </div>
      </div>
    </div>
  );
}
