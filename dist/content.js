const x="ops-copilot-launcher-host";function i(o){return chrome.runtime.sendMessage(o)}function w(){var e;return((e=window.getSelection())==null?void 0:e.toString().trim())||void 0}function v(o){var n;const e=((n=document.title)==null?void 0:n.trim())||location.hostname;return`${o}: ${e}`.slice(0,180)}async function S(){var g;if(window.top!==window.self||document.getElementById(x)||!document.documentElement||!((g=chrome==null?void 0:chrome.runtime)!=null&&g.id))return;const o=await i({type:"GET_LAUNCHER_SETTINGS",hostname:location.hostname}),e=o.ok&&o.data?o.data:void 0;if(!(e!=null&&e.visible))return;const n=document.createElement("div");n.id=x;const c=n.attachShadow({mode:"open"}),E=e.compact?" compact":"";c.innerHTML=`
    <style>
      :host {
        all: initial;
        position: fixed;
        right: 0;
        top: ${Math.round(e.positionY*100)}vh;
        transform: translateY(-50%);
        z-index: 2147483647;
        opacity: ${e.opacity};
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .launcher {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 42px;
        padding: 0 8px 0 12px;
        border: 1px solid rgba(77, 163, 255, .32);
        border-right: 0;
        border-radius: 999px 0 0 999px;
        background: linear-gradient(135deg, rgba(18, 24, 33, .96), rgba(26, 35, 48, .96));
        color: #f5f7fa;
        box-shadow: 0 12px 40px rgba(0, 0, 0, .32);
        cursor: pointer;
        user-select: none;
        transition: width .16s ease, opacity .16s ease, transform .16s ease;
      }
      .launcher:hover { transform: translateX(-2px); }
      .launcher.compact { width: 32px; justify-content: center; padding-left: 8px; }
      .mark { font-size: 12px; font-weight: 800; letter-spacing: .04em; }
      .drag { display: grid; gap: 2px; cursor: ns-resize; opacity: .58; }
      .drag span { width: 3px; height: 3px; border-radius: 50%; background: #9ba7b4; }
      .compact .drag { display: none; }
      .menu {
        position: absolute;
        right: 8px;
        top: 48px;
        min-width: 190px;
        padding: 8px;
        border-radius: 12px;
        border: 1px solid rgba(38, 48, 65, .9);
        background: rgba(11, 15, 20, .98);
        color: #f5f7fa;
        box-shadow: 0 20px 80px rgba(0, 0, 0, .42);
      }
      .menu[hidden] { display: none; }
      button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        padding: 9px 10px;
        border-radius: 8px;
        color: #f5f7fa;
        cursor: pointer;
        font-size: 12px;
      }
      button:hover, button:focus-visible { background: rgba(77, 163, 255, .14); outline: 1px solid rgba(77, 163, 255, .38); }
      .tooltip {
        position: absolute;
        right: 8px;
        bottom: calc(100% + 6px);
        white-space: nowrap;
        border-radius: 8px;
        padding: 6px 8px;
        background: rgba(11, 15, 20, .96);
        color: #9ba7b4;
        font-size: 11px;
        opacity: 0;
        pointer-events: none;
        transition: opacity .14s ease;
      }
      .launcher:hover + .tooltip { opacity: 1; }
    </style>
    <div class="launcher${E}" tabindex="0" role="button" aria-label="Open Ops Copilot">
      <span class="mark">OC</span>
      <span class="drag" aria-hidden="true"><span></span><span></span><span></span></span>
    </div>
    <div class="tooltip">Ops Copilot</div>
    <div class="menu" hidden>
      <button data-action="open">Open side panel <span>Enter</span></button>
      <button data-action="task">Create task</button>
      <button data-action="capture">Capture current page</button>
      <button data-action="voice">Start voice command</button>
      <button data-action="focus">Start focus session</button>
      <button data-action="note">Add quick note</button>
    </div>
  `,document.documentElement.append(n);const a=c.querySelector(".launcher"),f=c.querySelector(".menu");if(!a||!f)return;const p=f;let u=!1,l=!1,s;function h(){p.hidden=!p.hidden}function b(){p.hidden=!0}async function m(){await i({type:"OPEN_SIDE_PANEL"})}async function k(t){if(b(),t==="open"||t==="voice"){await m();return}if(t==="task"){await i({type:"CREATE_TASK",payload:{task:v("Follow up"),priority:"medium",location:document.title,metadata:{createdAt:Date.now(),updatedAt:Date.now(),sourceUrl:location.href,sourceTitle:document.title}}});return}if(t==="capture"){await i({type:"CAPTURE_PAGE",payload:{selectedText:w()}});return}if(t==="focus"){await i({type:"START_FOCUS",payload:{durationMinutes:25}});return}t==="note"&&await i({type:"CREATE_TASK",payload:{task:v("Quick note"),priority:"low",notes:w()||`Captured from ${location.href}`,location:document.title,metadata:{createdAt:Date.now(),updatedAt:Date.now(),sourceUrl:location.href,sourceTitle:document.title}}})}a.addEventListener("pointerdown",t=>{u=!0,l=!1,a.setPointerCapture(t.pointerId),s=window.setTimeout(h,650)}),a.addEventListener("pointermove",t=>{if(!u)return;const r=Math.min(Math.max(t.clientY/window.innerHeight,.08),.92);n.style.top=`${Math.round(r*100)}vh`,l=!0,s&&window.clearTimeout(s)}),a.addEventListener("pointerup",async t=>{u=!1,a.releasePointerCapture(t.pointerId),s&&window.clearTimeout(s);const r=Number.parseFloat(n.style.top)/100;if(l){await i({type:"UPDATE_LAUNCHER_POSITION",payload:{positionY:r}});return}await m()}),a.addEventListener("keydown",t=>{if((t.key==="Enter"||t.key===" ")&&(t.preventDefault(),m()),t.key==="ArrowUp"||t.key==="ArrowDown"){t.preventDefault();const r=t.key==="ArrowUp"?-.04:.04,d=Math.min(Math.max((Number.parseFloat(n.style.top)||42)/100+r,.08),.92);n.style.top=`${Math.round(d*100)}vh`,i({type:"UPDATE_LAUNCHER_POSITION",payload:{positionY:d}})}}),a.addEventListener("contextmenu",t=>{t.preventDefault(),h()}),p.addEventListener("click",t=>{var y;const d=(y=t.target.closest("button"))==null?void 0:y.dataset.action;d&&k(d)}),document.addEventListener("click",t=>{n.contains(t.target)||b()})}S().catch(()=>{});
//# sourceMappingURL=content.js.map
