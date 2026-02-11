type HighlightSection = 
  | 'header' 
  | 'clinicName' 
  | 'clinicLogo'
  | 'call' 
  | 'callName'
  | 'callWindow'
  | 'modal'
  | 'prayer' 
  | 'weather'
  | 'queue' 
  | 'queueItem'
  | 'queueHistory'
  | 'marquee'
  | 'media';

interface TvLayoutPreviewProps {
  highlight: HighlightSection;
}

export function TvLayoutPreview({ highlight }: TvLayoutPreviewProps) {
  const is = (s: HighlightSection | HighlightSection[]) => {
    if (Array.isArray(s)) return s.includes(highlight);
    return s === highlight;
  };

  const ring = "ring-2 ring-red-500 ring-offset-1";
  const pulse = "animate-pulse";

  return (
    <div className="w-full max-w-[300px] mx-auto" data-testid="tv-layout-preview">
      <div className="relative border-2 border-gray-400 dark:border-gray-500 rounded-md overflow-hidden bg-white dark:bg-gray-950" style={{ aspectRatio: '16/9' }}>
        <div className="w-full h-full" style={{ display: 'grid', gridTemplateRows: '65% 35%', gridTemplateColumns: '65% 35%' }}>

          <div className={`flex items-center justify-center ${
            is('media') ? `bg-purple-200 dark:bg-purple-900 ${pulse} ${ring}` : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            <div className="text-center">
              <div className="w-6 h-4 mx-auto mb-0.5 rounded-sm bg-gray-300 dark:bg-gray-600" />
              <span className={`text-[6px] ${is('media') ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-gray-400 dark:text-gray-500'}`}>Media / Iklan</span>
            </div>
          </div>

          <div className={`row-span-2 flex flex-col p-1 ${
            is('header') ? `${pulse} ${ring}` : ''
          }`} style={{ backgroundColor: is('header') ? '#3b82f6' : '#1d4ed8' }}>

            {is('clinicLogo') && (
              <div className={`mx-auto mb-0.5 w-6 h-3 bg-white rounded-sm ${pulse} ${ring}`} />
            )}
            <div className={`text-center text-[7px] font-bold truncate px-0.5 ${
              is('clinicName') ? `text-yellow-300 ${pulse}` : 'text-white'
            }`}>
              KLINIK
            </div>

            <div className={`mx-0.5 mt-0.5 rounded-sm text-center py-0.5 ${
              is('call') ? `${pulse} ${ring}` : ''
            }`} style={{ backgroundColor: is('call') ? '#3b82f6' : '#1e40af' }}>
              <div className={`text-[6px] font-bold ${
                is('callName') ? `text-yellow-300 ${pulse}` : 'text-white/80'
              }`}>CALLING</div>
            </div>

            <div className={`mx-0.5 mt-0.5 rounded-sm text-center py-1 ${
              is(['call', 'callName', 'callWindow']) ? `${pulse} ${ring}` : ''
            }`} style={{ backgroundColor: is('call') ? '#3b82f6' : '#2563eb' }}>
              <div className={`text-[8px] font-bold leading-tight ${
                is('callName') ? `text-yellow-300 ${pulse}` : 'text-yellow-400'
              }`}>
                AHMAD
              </div>
              <div className={`text-[6px] leading-tight ${
                is('callWindow') ? `text-yellow-300 ${pulse}` : 'text-yellow-400/80'
              }`}>
                BILIK 1
              </div>
            </div>

            <div className={`mx-0.5 mt-1 flex-1 overflow-hidden rounded-sm p-0.5 ${
              is('queue') ? `${pulse} ${ring} bg-red-500/30` : ''
            }`}>
              <div className="grid grid-cols-2 gap-px mb-0.5">
                <div className={`text-center text-[5px] font-bold ${
                  is(['queueHistory', 'queue']) ? `text-yellow-300 ${pulse}` : 'text-white/70'
                }`}>NAME</div>
                <div className={`text-center text-[5px] font-bold ${
                  is(['queueHistory', 'queue']) ? `text-yellow-300 ${pulse}` : 'text-white/70'
                }`}>ROOM</div>
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className={`grid grid-cols-2 gap-px rounded-sm mb-px py-px ${
                  is(['queueItem', 'queue']) ? `${pulse} ${ring}` : ''
                }`} style={{ backgroundColor: is(['queueItem', 'queue']) ? '#3b82f6' : '#2563eb' }}>
                  <div className={`text-center text-[5px] ${
                    is(['queueHistory', 'queue']) ? `text-yellow-300 font-bold ${pulse}` : 'text-white/90'
                  }`}>Patient {i}</div>
                  <div className={`text-center text-[5px] ${
                    is(['queueHistory', 'queue']) ? `text-yellow-300 ${pulse}` : 'text-white/70'
                  }`}>Bilik {i}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`flex flex-col items-center justify-center p-1 ${
            is('prayer') ? `${pulse} ${ring}` : ''
          }`} style={{ backgroundColor: is('prayer') ? '#7c3aed' : is('weather') ? '#ea580c' : '#1e40af' }}>
            <div className="bg-white rounded-sm px-1 py-0.5 mb-0.5 flex items-center gap-1">
              <span className="text-[6px] font-bold text-gray-800">12</span>
              <span className="text-[5px] text-gray-500">Jan</span>
              <span className="text-[6px] font-bold text-gray-800">10:30</span>
            </div>

            {is('weather') ? (
              <div className={`text-center ${pulse}`}>
                <div className="text-[5px] text-white font-bold">WEATHER</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[8px]">30°C</span>
                </div>
              </div>
            ) : (
              <div className={`text-center ${is('prayer') ? pulse : ''}`}>
                <div className="text-[5px] text-white/90 font-bold">PRAYER TIME</div>
                <div className="flex gap-1 mt-0.5">
                  {['Sub', 'Zoh', 'Asr', 'Mag', 'Ish'].map(p => (
                    <div key={p} className="text-center">
                      <div className="text-[4px] text-white/70">{p}</div>
                      <div className={`text-[4px] font-bold ${is('prayer') ? 'text-yellow-300' : 'text-white'}`}>5:45</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {is('marquee') && (
          <div className={`absolute bottom-0 left-0 right-0 py-0.5 text-center ${pulse} ${ring}`} style={{ backgroundColor: '#1e40af' }}>
            <span className="text-[5px] text-white font-bold">Selamat Datang ke Klinik</span>
          </div>
        )}
        {!is('marquee') && (
          <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center" style={{ backgroundColor: '#1e40af' }}>
            <span className="text-[5px] text-white/70">Marquee</span>
          </div>
        )}

        {is('modal') && (
          <div className={`absolute inset-0 flex items-center justify-center z-10`} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className={`relative bg-gray-800 rounded-sm px-4 py-2 text-center ${pulse} ${ring}`} style={{ border: '2px solid #facc15' }}>
              <div className="absolute top-0 left-0 w-3 h-px bg-yellow-400" />
              <div className="absolute top-0 left-0 h-3 w-px bg-yellow-400" />
              <div className="absolute top-0 right-0 w-3 h-px bg-yellow-400" />
              <div className="absolute top-0 right-0 h-3 w-px bg-yellow-400" />
              <div className="absolute bottom-0 left-0 w-3 h-px bg-yellow-400" />
              <div className="absolute bottom-0 left-0 h-3 w-px bg-yellow-400" />
              <div className="absolute bottom-0 right-0 w-3 h-px bg-yellow-400" />
              <div className="absolute bottom-0 right-0 h-3 w-px bg-yellow-400" />
              <div className="text-[6px] text-white/80 mb-0.5">NAME</div>
              <div className="text-[9px] text-white font-bold border border-yellow-400 px-2 py-0.5 rounded-sm mb-1">AHMAD</div>
              <div className="text-[6px] text-white/80 mb-0.5">ROOM</div>
              <div className="text-[9px] text-yellow-400 font-bold">BILIK 1</div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center mt-1.5">
        <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
          {highlight === 'header' && 'Background Kanan (Header)'}
          {highlight === 'clinicName' && 'Teks Nama Klinik'}
          {highlight === 'clinicLogo' && 'Logo Klinik'}
          {highlight === 'call' && 'Background Panggilan'}
          {highlight === 'callName' && 'Nama Pesakit (Panggilan)'}
          {highlight === 'callWindow' && 'Nama Bilik/Kaunter'}
          {highlight === 'modal' && 'Popup Highlight (Panggilan)'}
          {highlight === 'prayer' && 'Bahagian Waktu Solat'}
          {highlight === 'weather' && 'Bahagian Cuaca'}
          {highlight === 'queue' && 'Background Senarai Giliran'}
          {highlight === 'queueItem' && 'Box Setiap Pesakit'}
          {highlight === 'queueHistory' && 'Nama Pesakit (Sejarah)'}
          {highlight === 'marquee' && 'Bahagian Marquee (bawah)'}
          {highlight === 'media' && 'Bahagian Media/Iklan (kiri atas)'}
        </span>
      </div>
    </div>
  );
}