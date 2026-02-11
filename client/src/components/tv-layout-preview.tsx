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
  const isHighlighted = (section: HighlightSection | HighlightSection[]) => {
    if (Array.isArray(section)) return section.includes(highlight);
    return section === highlight;
  };

  const highlightClass = "ring-2 ring-red-500 ring-offset-1";
  const pulseClass = "animate-pulse";

  return (
    <div className="w-full max-w-[280px] mx-auto" data-testid="tv-layout-preview">
      <div className="relative border-2 border-gray-300 dark:border-gray-600 rounded-md overflow-hidden text-[8px] leading-tight bg-gray-50 dark:bg-gray-900">
        <div 
          className={`flex items-center justify-between px-2 py-1.5 ${
            isHighlighted('header') ? `bg-blue-500 ${pulseClass} ${highlightClass}` : 'bg-blue-700'
          }`}
        >
          <div className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${
              isHighlighted('clinicLogo') ? `bg-yellow-300 ${pulseClass} ${highlightClass}` : 'bg-white/30'
            }`} />
            <span className={`font-bold truncate ${
              isHighlighted('clinicName') ? `text-yellow-300 ${pulseClass}` : 'text-white'
            }`}>
              CLINIC NAME
            </span>
          </div>
          <span className="text-white/70 text-[7px]">10:30</span>
        </div>

        <div className="flex">
          <div className={`w-[45%] flex-shrink-0 flex items-center justify-center py-4 ${
            isHighlighted('media') ? `bg-purple-200 dark:bg-purple-900 ${pulseClass} ${highlightClass}` : 'bg-gray-200 dark:bg-gray-800'
          }`}>
            <span className="text-gray-400 dark:text-gray-500 text-[7px]">Media</span>
          </div>

          <div className="flex-1 flex flex-col">
            <div className={`px-1.5 py-2 border-b border-gray-200 dark:border-gray-700 ${
              isHighlighted('call') ? `bg-green-400 ${pulseClass} ${highlightClass}` : 'bg-green-600'
            }`}>
              <div className={`font-bold text-center text-[9px] ${
                isHighlighted('callName') ? `text-yellow-300 ${pulseClass}` : 'text-white'
              }`}>
                AHMAD BIN ALI
              </div>
              <div className={`text-center text-[7px] mt-0.5 ${
                isHighlighted('callWindow') ? `text-yellow-300 ${pulseClass}` : 'text-white/80'
              }`}>
                BILIK 1
              </div>
            </div>

            <div className={`px-1.5 py-1 ${
              isHighlighted('queue') ? `bg-blue-100 dark:bg-blue-950 ${pulseClass} ${highlightClass}` : 'bg-gray-100 dark:bg-gray-850'
            }`}>
              <div className="text-[6px] text-gray-500 dark:text-gray-400 mb-0.5">Senarai Giliran</div>
              <div className="flex gap-0.5">
                {[1, 2, 3].map(i => (
                  <div 
                    key={i}
                    className={`flex-1 rounded-sm px-0.5 py-0.5 text-center text-white text-[6px] ${
                      isHighlighted('queueItem') ? `bg-blue-400 ${pulseClass} ${highlightClass}` : 'bg-blue-600'
                    }`}
                  >
                    #{String(i).padStart(3, '0')}
                  </div>
                ))}
              </div>
              <div className={`mt-0.5 text-[6px] ${
                isHighlighted('queueHistory') ? `text-yellow-600 font-bold ${pulseClass}` : 'text-gray-400'
              }`}>
                History: #004, #005
              </div>
            </div>
          </div>
        </div>

        <div className="flex border-t border-gray-200 dark:border-gray-700">
          <div className={`flex-1 px-1.5 py-1 text-center ${
            isHighlighted('prayer') ? `bg-purple-400 text-white ${pulseClass} ${highlightClass}` : 'bg-purple-700 text-white/90'
          }`}>
            <div className="text-[6px]">Subuh</div>
            <div className="text-[7px] font-bold">5:45</div>
          </div>
          <div className={`flex-1 px-1.5 py-1 text-center ${
            isHighlighted('prayer') ? `bg-purple-400 text-white ${pulseClass} ${highlightClass}` : 'bg-purple-700 text-white/90'
          }`}>
            <div className="text-[6px]">Zohor</div>
            <div className="text-[7px] font-bold">1:15</div>
          </div>
          <div className={`flex-1 px-1.5 py-1 text-center ${
            isHighlighted('weather') ? `bg-orange-400 text-white ${pulseClass} ${highlightClass}` : 'bg-purple-700 text-white/90'
          }`}>
            <div className="text-[6px]">Asar</div>
            <div className="text-[7px] font-bold">4:30</div>
          </div>
        </div>

        {isHighlighted('modal') && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30 z-10">
            <div className={`bg-gray-800 border-2 border-yellow-400 rounded-sm px-3 py-1.5 text-center ${pulseClass} ${highlightClass}`}>
              <div className="text-white text-[8px] font-bold">SILA KE</div>
              <div className="text-yellow-400 text-[9px] font-bold">BILIK 1</div>
            </div>
          </div>
        )}

        <div className={`px-2 py-1 text-center overflow-hidden whitespace-nowrap ${
          isHighlighted('marquee') ? `bg-red-500 text-white ${pulseClass} ${highlightClass}` : 'bg-red-700 text-white/90'
        }`}>
          <span className="text-[7px]">Selamat Datang ke Klinik Kami</span>
        </div>
      </div>

      <div className="text-center mt-1">
        <span className="text-[10px] font-medium text-red-600 dark:text-red-400">
          {highlight === 'header' && 'Bahagian Header (atas)'}
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
          {highlight === 'media' && 'Bahagian Media/Gambar'}
        </span>
      </div>
    </div>
  );
}