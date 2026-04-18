import { useQuery } from "@tanstack/react-query";

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

interface Setting { key: string; value: string }

const UNIFIED_BG_COLOR = '#0f172a';
const UNIFIED_BG_GRADIENT = 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)';
const ACCENT_BG_COLOR = '#f09819';
const ACCENT_BG_GRADIENT = 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)';

function getBg(mode: string | undefined, color: string | undefined, gradient: string | undefined, fallbackColor: string, fallbackGradient: string) {
  if (mode === 'gradient') return { background: gradient || fallbackGradient };
  return { background: color || fallbackColor };
}

function getTextColor(mode: string | undefined, color: string | undefined, gradient: string | undefined, fallbackColor: string, fallbackGradient: string) {
  if (mode === 'gradient') {
    return {
      background: gradient || fallbackGradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    } as React.CSSProperties;
  }
  return { color: color || fallbackColor } as React.CSSProperties;
}

export function TvLayoutPreview({ highlight }: TvLayoutPreviewProps) {
  const { data: settings = [] } = useQuery<Setting[]>({
    queryKey: ['/api/settings'],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const s = settings.reduce((acc: Record<string, string>, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  // Read live colors from settings (matches TVDisplay defaults)
  const headerBg = getBg(s.headerBackgroundMode || 'gradient', s.headerBackgroundColor, s.headerBackgroundGradient, UNIFIED_BG_COLOR, UNIFIED_BG_GRADIENT);
  const callBg = getBg(s.callBackgroundMode || 'gradient', s.callBackgroundColor, s.callBackgroundGradient, ACCENT_BG_COLOR, ACCENT_BG_GRADIENT);
  const prayerBg = getBg(s.prayerTimesBackgroundMode || 'gradient', s.prayerTimesBackgroundColor, s.prayerTimesBackgroundGradient, UNIFIED_BG_COLOR, UNIFIED_BG_GRADIENT);
  const weatherBg = getBg(s.weatherBackgroundMode || 'gradient', s.weatherBackgroundColor, s.weatherBackgroundGradient, UNIFIED_BG_COLOR, UNIFIED_BG_GRADIENT);
  const queueItemBg = getBg(s.queueItemBackgroundMode || 'gradient', s.queueItemBackgroundColor, s.queueItemBackgroundGradient, '#1e293b', 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)');
  const marqueeBg = getBg(s.marqueeBackgroundMode || 'gradient', s.marqueeBackgroundColor, s.marqueeBackgroundGradient, UNIFIED_BG_COLOR, UNIFIED_BG_GRADIENT);

  const clinicNameTxt = getTextColor(s.clinicNameTextMode || 'solid', s.clinicNameTextColor, s.clinicNameTextGradient, '#ffffff', 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)');
  const callNameTxt = getTextColor(s.callNameTextMode || 'solid', s.callNameTextColor, s.callNameTextGradient, '#ffffff', 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)');
  const windowTxt = getTextColor(s.windowTextMode || 'solid', s.windowTextColor, s.windowTextGradient, '#ffffff', 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)');
  const prayerTxt = getTextColor(s.prayerTimesTextMode || 'solid', s.prayerTimesTextColor, s.prayerTimesTextGradient, '#ffffff', 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)');
  const weatherTxt = getTextColor(s.weatherTextMode || 'solid', s.weatherTextColor, s.weatherTextGradient, '#ffffff', 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)');
  const historyNameTxt = getTextColor(s.historyNameMode || 'gradient', s.historyNameColor, s.historyNameGradient, '#facc15', 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)');
  const marqueeTxt = { color: s.marqueeColor || '#ffffff' };

  const modalBgColor = s.modalBackgroundColor || '#1e293b';
  const modalBorderColor = s.modalBorderColor || '#fbbf24';
  const modalTextColor = s.modalTextColor || '#ffffff';

  const is = (sect: HighlightSection | HighlightSection[]) => {
    if (Array.isArray(sect)) return sect.includes(highlight);
    return sect === highlight;
  };

  const ring = "ring-2 ring-red-500 ring-offset-1";
  const pulse = "animate-pulse";

  return (
    <div className="w-full max-w-[300px] mx-auto" data-testid="tv-layout-preview">
      <div className="relative border-2 border-gray-400 dark:border-gray-500 rounded-md overflow-hidden bg-white dark:bg-gray-950" style={{ aspectRatio: '16/9' }}>
        <div className="w-full h-full" style={{ display: 'grid', gridTemplateRows: '65% 35%', gridTemplateColumns: '65% 35%' }}>

          {/* Media tile */}
          <div className={`flex items-center justify-center ${
            is('media') ? `${pulse} ${ring}` : ''
          }`} style={{ backgroundColor: '#000000' }}>
            <div className="text-center">
              <div className="w-6 h-4 mx-auto mb-0.5 rounded-sm bg-gray-700" />
              <span className={`text-[6px] ${is('media') ? 'text-yellow-300 font-bold' : 'text-gray-400'}`}>Media / Iklan</span>
            </div>
          </div>

          {/* Right column header (spans 2 rows) */}
          <div className={`row-span-2 flex flex-col p-1 ${
            is('header') ? `${pulse} ${ring}` : ''
          }`} style={headerBg}>

            {is('clinicLogo') && (
              <div className={`mx-auto mb-0.5 w-6 h-3 bg-white rounded-sm ${pulse} ${ring}`} />
            )}
            <div className={`text-center text-[7px] font-bold truncate px-0.5 ${
              is('clinicName') ? pulse : ''
            }`} style={clinicNameTxt}>
              KLINIK
            </div>

            {/* CALLING label box */}
            <div className={`mx-0.5 mt-0.5 rounded-sm text-center py-0.5 ${
              is('call') ? `${pulse} ${ring}` : ''
            }`} style={callBg}>
              <div className={`text-[6px] font-bold ${
                is('callName') ? pulse : ''
              }`} style={callNameTxt}>CALLING</div>
            </div>

            {/* Patient name + room box */}
            <div className={`mx-0.5 mt-0.5 rounded-sm text-center py-1 ${
              is(['call', 'callName', 'callWindow']) ? `${pulse} ${ring}` : ''
            }`} style={callBg}>
              <div className={`text-[8px] font-bold leading-tight ${
                is('callName') ? pulse : ''
              }`} style={callNameTxt}>
                AHMAD
              </div>
              <div className={`text-[6px] leading-tight ${
                is('callWindow') ? pulse : ''
              }`} style={windowTxt}>
                BILIK 1
              </div>
            </div>

            {/* History list */}
            <div className="mx-0.5 mt-1 flex-1 overflow-hidden rounded-sm p-0.5 flex flex-col gap-px">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex flex-col items-center rounded-sm mb-px py-px ${
                  is(['queueItem', 'queue']) ? `${pulse} ${ring}` : ''
                }`} style={queueItemBg}>
                  <div className={`text-center text-[5px] font-bold leading-none ${
                    is(['queueHistory', 'queue']) ? pulse : ''
                  }`} style={historyNameTxt}>Patient {i}</div>
                  <div className={`text-center text-[5px] leading-none ${
                    is(['queueHistory', 'queue']) ? pulse : ''
                  }`} style={historyNameTxt}>Bilik {i}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom-left: prayer / weather */}
          <div className={`flex flex-col items-center justify-center p-1 ${
            is('prayer') || is('weather') ? `${pulse} ${ring}` : ''
          }`} style={is('weather') ? weatherBg : prayerBg}>
            <div className="bg-white rounded-sm px-1 py-0.5 mb-0.5 flex items-center gap-1">
              <span className="text-[6px] font-bold text-gray-800">12</span>
              <span className="text-[5px] text-gray-500">Jan</span>
              <span className="text-[6px] font-bold text-gray-800">10:30</span>
            </div>

            {is('weather') ? (
              <div className={`text-center ${pulse}`}>
                <div className="text-[5px] font-bold" style={weatherTxt}>WEATHER</div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <span className="text-[8px]" style={weatherTxt}>30°C</span>
                </div>
              </div>
            ) : (
              <div className={`text-center ${is('prayer') ? pulse : ''}`}>
                <div className="text-[5px] font-bold" style={prayerTxt}>PRAYER TIME</div>
                <div className="flex gap-1 mt-0.5">
                  {['Sub', 'Zoh', 'Asr', 'Mag', 'Ish'].map(p => (
                    <div key={p} className="text-center">
                      <div className="text-[4px]" style={prayerTxt}>{p}</div>
                      <div className="text-[4px] font-bold" style={prayerTxt}>5:45</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Marquee overlay */}
        <div className={`absolute bottom-0 left-0 right-0 py-0.5 text-center ${is('marquee') ? `${pulse} ${ring}` : ''}`} style={marqueeBg}>
          <span className="text-[5px] font-bold" style={marqueeTxt}>
            {is('marquee') ? 'Selamat Datang ke Klinik' : 'Marquee'}
          </span>
        </div>

        {/* Modal preview */}
        {is('modal') && (
          <div className={`absolute inset-0 flex items-center justify-center z-10`} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <div className={`relative rounded-sm px-4 py-2 text-center ${pulse} ${ring}`} style={{ backgroundColor: modalBgColor, border: `2px solid ${modalBorderColor}` }}>
              <div className="absolute top-0 left-0 w-3 h-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute top-0 left-0 h-3 w-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute top-0 right-0 w-3 h-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute top-0 right-0 h-3 w-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute bottom-0 left-0 w-3 h-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute bottom-0 left-0 h-3 w-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute bottom-0 right-0 w-3 h-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="absolute bottom-0 right-0 h-3 w-px" style={{ backgroundColor: modalBorderColor }} />
              <div className="text-[6px] mb-0.5" style={{ color: modalTextColor, opacity: 0.8 }}>NAME</div>
              <div className="text-[9px] font-bold border px-2 py-0.5 rounded-sm mb-1" style={{ color: modalTextColor, borderColor: modalBorderColor }}>AHMAD</div>
              <div className="text-[6px] mb-0.5" style={{ color: modalTextColor, opacity: 0.8 }}>ROOM</div>
              <div className="text-[9px] font-bold border px-2 py-0.5 rounded-sm" style={{ color: modalTextColor, borderColor: modalBorderColor }}>BILIK 1</div>
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
