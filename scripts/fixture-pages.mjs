// Synthetic app screens used only as test fixtures. They are rendered by
// Chromium from the HTML below, so every pixel is real, deterministic UI.

const statusBar = (fg) => `
  <div class="status" style="color:${fg}">
    <span>9:41</span>
    <span class="icons">
      <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5c2.3 0 4.4.9 6 2.4l1.1-1.2A10 10 0 0 0 8 1 10 10 0 0 0 .9 3.7L2 4.9a8.5 8.5 0 0 1 6-2.4Zm0 3.4c1.4 0 2.6.5 3.6 1.4l1.1-1.2A6.7 6.7 0 0 0 8 4.4a6.7 6.7 0 0 0-4.7 1.7l1.1 1.2c1-.9 2.2-1.4 3.6-1.4Zm0 3.3c.6 0 1.1.2 1.5.6L8 11.4 6.5 9.8c.4-.4.9-.6 1.5-.6Z" fill="currentColor"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" stroke="currentColor" opacity=".4" fill="none"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill="currentColor" opacity=".5"/></svg>
    </span>
  </div>`;

const base = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 393px; height: 852px; overflow: hidden; font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .status { height: 54px; display: flex; justify-content: space-between; align-items: center; padding: 14px 32px 0 40px; font-weight: 600; font-size: 16px; }
  .icons { display: flex; gap: 6px; align-items: center; }
  .home-indicator { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 134px; height: 5px; border-radius: 3px; }
`;

export const lightUi = `<!doctype html><html><head><style>${base}
  body { background: #F6F5F2; color: #16161A; position: relative; }
  header { padding: 12px 22px 8px; }
  .eyebrow { font-size: 13px; color: #6B6A73; letter-spacing: .02em; }
  h1 { font-size: 30px; letter-spacing: -0.02em; margin-top: 4px; }
  .hero { margin: 16px 22px; height: 210px; border-radius: 22px; padding: 20px; color: #fff; position: relative; overflow: hidden;
          background: linear-gradient(160deg, #2F6B5E 0%, #18423A 100%); }
  .hero .tag { display: inline-block; font-size: 12px; background: rgba(255,255,255,.18); padding: 4px 10px; border-radius: 999px; }
  .hero h2 { font-size: 26px; margin-top: 74px; letter-spacing: -0.01em; }
  .hero p { font-size: 14px; opacity: .85; margin-top: 4px; }
  .hero .sun { position: absolute; right: -30px; top: -30px; width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, #F4C76B 0%, rgba(244,199,107,0) 70%); }
  .chips { display: flex; gap: 8px; padding: 4px 22px 12px; }
  .chip { font-size: 13px; padding: 8px 14px; border-radius: 999px; background: #fff; border: 1px solid #E5E3DE; }
  .chip.active { background: #16161A; color: #fff; border-color: #16161A; }
  h3 { font-size: 17px; padding: 8px 22px 10px; display: flex; justify-content: space-between; }
  h3 span { font-size: 13px; color: #2F6B5E; font-weight: 600; }
  .row { display: flex; align-items: center; gap: 14px; margin: 0 22px 10px; padding: 12px; background: #fff; border-radius: 16px; border: 1px solid #ECEAE5; }
  .thumb { width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0; }
  .row strong { display: block; font-size: 15px; }
  .row small { font-size: 13px; color: #6B6A73; }
  .row .when { margin-left: auto; font-size: 12px; color: #6B6A73; text-align: right; }
  nav { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: rgba(255,255,255,.94); border-top: 1px solid #E5E3DE; display: flex; justify-content: space-around; padding-top: 10px; font-size: 11px; color: #8A8992; }
  nav div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  nav i { width: 24px; height: 24px; border-radius: 7px; background: #C9C7CF; display: block; }
  nav .on { color: #2F6B5E; } nav .on i { background: #2F6B5E; }
  .home-indicator { background: #16161A; }
</style></head><body>
  ${statusBar('#16161A')}
  <header><div class="eyebrow">Tuesday, 14 May</div><h1>Your trips</h1></header>
  <div class="hero"><div class="sun"></div><span class="tag">In 12 days</span><h2>Lisbon &amp; Sintra</h2><p>6 nights · 3 travellers · 4 bookings confirmed</p></div>
  <div class="chips"><span class="chip active">Upcoming</span><span class="chip">Drafts</span><span class="chip">Past</span></div>
  <h3>Itinerary <span>See all</span></h3>
  <div class="row"><div class="thumb" style="background:linear-gradient(135deg,#E8B07A,#C9714A)"></div><div><strong>Flight TP 1351</strong><small>London → Lisbon · Seat 14A</small></div><div class="when">Fri<br>07:40</div></div>
  <div class="row"><div class="thumb" style="background:linear-gradient(135deg,#8FB8C9,#4E7E92)"></div><div><strong>Casa do Largo</strong><small>Check-in from 15:00</small></div><div class="when">Fri<br>15:00</div></div>
  <div class="row"><div class="thumb" style="background:linear-gradient(135deg,#B5C99A,#6E8B4E)"></div><div><strong>Pena Palace tour</strong><small>Guided · 3 hours</small></div><div class="when">Sat<br>10:30</div></div>
  <div class="row"><div class="thumb" style="background:linear-gradient(135deg,#D9A5C0,#9C5C7E)"></div><div><strong>Dinner at Taberna</strong><small>Table for 3 · Alfama</small></div><div class="when">Sat<br>20:00</div></div>
  <nav><div class="on"><i></i>Trips</div><div><i></i>Explore</div><div><i></i>Saved</div><div><i></i>Profile</div></nav>
  <div class="home-indicator"></div>
</body></html>`;

export const darkUi = `<!doctype html><html><head><style>${base}
  body { background: #0B0B0F; color: #F2F2F5; position: relative; }
  header { padding: 12px 22px 6px; display: flex; justify-content: space-between; align-items: end; }
  h1 { font-size: 30px; letter-spacing: -0.02em; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#7C6CFF,#E05CA8); }
  .ring-card { margin: 16px 22px; padding: 20px; border-radius: 22px; background: #16161D; border: 1px solid #23232D; display: flex; gap: 20px; align-items: center; }
  .ring { width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(#7C6CFF 0 72%, #26262F 72% 100%); display: grid; place-items: center; flex-shrink: 0; }
  .ring div { width: 92px; height: 92px; border-radius: 50%; background: #16161D; display: grid; place-items: center; font-size: 26px; font-weight: 700; }
  .stat small { display: block; font-size: 13px; color: #9A9AA8; }
  .stat strong { display: block; font-size: 22px; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 22px; }
  .tile { background: #16161D; border: 1px solid #23232D; border-radius: 18px; padding: 16px; height: 120px; display: flex; flex-direction: column; justify-content: space-between; }
  .tile small { color: #9A9AA8; font-size: 13px; }
  .tile strong { font-size: 24px; }
  .tile .bar { height: 6px; border-radius: 3px; background: #26262F; overflow: hidden; }
  .tile .bar span { display: block; height: 100%; border-radius: 3px; }
  h3 { font-size: 17px; padding: 22px 22px 10px; }
  .session { display: flex; align-items: center; gap: 14px; margin: 0 22px 10px; padding: 14px; background: #16161D; border-radius: 16px; border: 1px solid #23232D; }
  .dot { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; }
  .session strong { display: block; font-size: 15px; }
  .session small { color: #9A9AA8; font-size: 13px; }
  .session .dur { margin-left: auto; font-size: 13px; color: #C8C8D2; }
  nav { position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: rgba(16,16,22,.96); border-top: 1px solid #23232D; display: flex; justify-content: space-around; padding-top: 10px; font-size: 11px; color: #6E6E7A; }
  nav div { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  nav i { width: 24px; height: 24px; border-radius: 7px; background: #3A3A46; display: block; }
  nav .on { color: #A99FFF; } nav .on i { background: #7C6CFF; }
  .home-indicator { background: #F2F2F5; }
</style></head><body>
  ${statusBar('#F2F2F5')}
  <header><h1>Today</h1><div class="avatar"></div></header>
  <div class="ring-card"><div class="ring"><div>72%</div></div><div class="stat"><small>Move goal</small><strong>432 / 600 kcal</strong><small>Focus time</small><strong>3 h 20 m</strong></div></div>
  <div class="grid">
    <div class="tile"><small>Steps</small><strong>8,214</strong><div class="bar"><span style="width:82%;background:#4FD1A5"></span></div></div>
    <div class="tile"><small>Sleep</small><strong>7 h 05 m</strong><div class="bar"><span style="width:88%;background:#7C6CFF"></span></div></div>
    <div class="tile"><small>Water</small><strong>1.6 L</strong><div class="bar"><span style="width:64%;background:#58A6FF"></span></div></div>
    <div class="tile"><small>Mindful</small><strong>12 min</strong><div class="bar"><span style="width:40%;background:#F5A35C"></span></div></div>
  </div>
  <h3>Sessions</h3>
  <div class="session"><div class="dot" style="background:linear-gradient(135deg,#4FD1A5,#1E8A6A)"></div><div><strong>Morning run</strong><small>5.2 km · Riverside loop</small></div><span class="dur">28 min</span></div>
  <div class="session"><div class="dot" style="background:linear-gradient(135deg,#7C6CFF,#4A3BC9)"></div><div><strong>Deep work</strong><small>Design review prep</small></div><span class="dur">1 h 50 m</span></div>
  <nav><div class="on"><i></i>Today</div><div><i></i>Trends</div><div><i></i>Plans</div><div><i></i>Settings</div></nav>
  <div class="home-indicator"></div>
</body></html>`;

/** Four solid quadrants: used to check orientation and aperture placement exactly. */
export const quadrants = `<!doctype html><html><head><style>
  * { margin: 0; } html, body { width: 393px; height: 852px; overflow: hidden; }
  body { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
</style></head><body>
  <div style="background:#FF0000"></div><div style="background:#00FF00"></div>
  <div style="background:#0000FF"></div><div style="background:#FFFF00"></div>
</body></html>`;
