/**
 * The clipboard fallback: when `navigator.clipboard` is missing or refuses,
 * the report text is shown in a read-only text area over the canvas, already
 * selected, with a Close button. This is the one DOM element outside the
 * canvas; it exists only while open. Not imported by anything under test.
 */
const OVERLAY_ID = 'mm-text-overlay';

export function showTextOverlay(text: string): void {
  document.getElementById(OVERLAY_ID)?.remove();
  const wrap = document.createElement('div');
  wrap.id = OVERLAY_ID;
  wrap.style.cssText =
    'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'background:rgba(0,0,0,0.7);z-index:10;font-family:ui-monospace,Menlo,Consolas,monospace;';
  const area = document.createElement('textarea');
  area.readOnly = true;
  area.value = text;
  area.style.cssText = 'width:min(900px,90vw);height:70vh;background:#161b22;color:#f2f2f2;border:1px solid #5c6773;padding:12px;font:12px inherit;';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.style.cssText = 'margin-top:12px;padding:8px 24px;background:#2a3139;color:#f2f2f2;border:1px solid #5c6773;border-radius:6px;font:bold 16px inherit;cursor:pointer;';
  close.addEventListener('click', () => wrap.remove());
  wrap.append(area, close);
  document.body.append(wrap);
  area.focus();
  area.select();
}
