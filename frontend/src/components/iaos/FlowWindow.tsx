import { useRef, useCallback, useState } from 'react';
import { useUIStore, FlowWindow as WinType } from '../../stores/useUIStore';

type Props = {
  win: WinType;
  children: React.ReactNode;
};

function buildPopupUrl(win: WinType): string {
  const params = new URLSearchParams();
  params.set('popup', '1');
  params.set('component', win.component);
  params.set('title', win.title);
  if (win.props && Object.keys(win.props).length > 0) {
    params.set('props', encodeURIComponent(JSON.stringify(win.props)));
  }
  return `/?${params.toString()}`;
}

export default function FlowWindow({ win, children }: Props) {
  const { closeWindow, minimizeWindow, focusWindow, moveWindow, resizeWindow, windowOpacity } = useUIStore();

  const handlePopOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildPopupUrl(win);
    // Detect if on second screen: open on screen 2 if available
    const screenW = window.screen.availWidth;
    const screenH = window.screen.availHeight;
    const w = Math.min(1400, screenW);
    const h = Math.min(900, screenH);
    // Try to open on second monitor by offsetting by primary screen width
    const left = window.screenX + window.outerWidth + 40;
    const top = window.screenY;
    window.open(url, `flow_popup_${win.id}`, `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,status=no`);
    closeWindow(win.id); // Remove from main window
  };
  const [maximized, setMaximized] = useState(false);
  const [preMax, setPreMax] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (maximized) return;
    e.preventDefault();
    focusWindow(win.id);
    dragRef.current = { startX: e.clientX, startY: e.clientY, winX: win.position.x, winY: win.position.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      moveWindow(win.id, dragRef.current.winX + dx, dragRef.current.winY + dy);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [win.id, win.position.x, win.position.y, focusWindow, moveWindow, maximized]);

  const handleMaximize = () => {
    if (maximized) {
      // Restore
      if (preMax) {
        moveWindow(win.id, preMax.x, preMax.y);
        resizeWindow(win.id, preMax.w, preMax.h);
      }
      setMaximized(false);
    } else {
      // Save current and maximize
      setPreMax({ x: win.position.x, y: win.position.y, w: win.size.w, h: win.size.h });
      moveWindow(win.id, 0, 32);
      resizeWindow(win.id, window.innerWidth, window.innerHeight - 100);
      setMaximized(true);
    }
  };

  if (win.minimized) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: maximized ? 0 : win.position.x,
        top: maximized ? 32 : win.position.y,
        width: maximized ? '100%' : win.size.w,
        height: maximized ? 'calc(100% - 100px)' : win.size.h,
        zIndex: win.zIndex,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseDown={() => focusWindow(win.id)}
    >
      {/* Titlebar — minimal, semi-transparent */}
      <div
        onMouseDown={onMouseDown}
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          cursor: maximized ? 'default' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
          background: `rgba(15, 17, 25, ${Math.min(windowOpacity, 0.85)})`,
          backdropFilter: 'blur(16px)',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6, marginRight: 10, alignItems: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
            style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', opacity: 0.85 }}
            title="Chiudi"
          />
          <button
            onClick={(e) => { e.stopPropagation(); minimizeWindow(win.id); }}
            style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', border: 'none', cursor: 'pointer', opacity: 0.85 }}
            title="Riduci"
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleMaximize(); }}
            style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', border: 'none', cursor: 'pointer', opacity: 0.85 }}
            title={maximized ? 'Ripristina' : 'Ingrandisci'}
          />
          {/* Pop-out to separate window (multi-monitor) */}
          <button
            onClick={handlePopOut}
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: 'rgba(139,92,246,0.8)', border: 'none', cursor: 'pointer', opacity: 0.85,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'white',
              marginLeft: 2,
            }}
            title="Apri in finestra separata (secondo monitor)"
          >↗</button>
        </div>
        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 11, fontWeight: 500,
          color: 'rgba(224,230,240,0.5)',
          letterSpacing: 0.3,
        }}>
          {win.title}
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        borderRadius: '0 0 8px 8px',
        background: `rgba(15,18,25,${windowOpacity})`,
        backdropFilter: windowOpacity < 0.95 ? `blur(${Math.round((1 - windowOpacity) * 30)}px)` : 'none',
      }}>
        {children}
      </div>
    </div>
  );
}
