// konkanMap.js — cartoon "treasure island" style animated map of the Konkan coast (pure SVG, no tiles/Leaflet/CARTO)
import { escapeHtml } from './bookingUtils.mjs';

const W = 900, H = 640;
const px = (lat, lng) => [((lng - 72.3) / 1.9) * W, ((19.05 - lat) / 3.4) * (H - 30) + 15];
const RAW = [[19.05, 72.80], [18.95, 72.82], [18.85, 72.85], [18.72, 72.83], [18.65, 72.85], [18.52, 72.88], [18.4, 72.92], [18.31, 72.95], [18.2, 72.97], [18.05, 73.0], [17.92, 73.03], [17.8, 73.1], [17.7, 73.14], [17.55, 73.15], [17.4, 73.18], [17.25, 73.24], [17.05, 73.28], [16.9, 73.3], [16.75, 73.33], [16.6, 73.36], [16.45, 73.4], [16.3, 73.42], [16.15, 73.43], [16.05, 73.45], [15.9, 73.55], [15.75, 73.7]];
const pts = [];
RAW.forEach((r, i) => {
  const [x, y] = px(...r); pts.push([x + Math.sin(i * 2.3) * 6, y]);
  if (i < RAW.length - 1) { const [x2, y2] = px(...RAW[i + 1]); pts.push([(x + x2) / 2 + Math.cos(i * 3.1) * 10, (y + y2) / 2]); }
});
const f = v => v.toFixed(1);
const smooth = p => p.reduce((d, q, i) => {
  if (!i) return `M${f(q[0])} ${f(q[1])}`;
  const p0 = p[i - 2] || p[i - 1], p1 = p[i - 1], p3 = p[i + 1] || q;
  return d + `C${f(p1[0] + (q[0] - p0[0]) / 6)} ${f(p1[1] + (q[1] - p0[1]) / 6)} ${f(q[0] - (p3[0] - p1[0]) / 6)} ${f(q[1] - (p3[1] - p1[1]) / 6)} ${f(q[0])} ${f(q[1])}`;
}, '');
const coastPath = smooth(pts);
const endY = pts.at(-1)[1], endX = pts.at(-1)[0];
const landPath = coastPath + ` L${W + 600} ${endY} L${W + 600} -300 L${pts[0][0]} -300 Z`;
const coastX = y => { for (let i = 1; i < pts.length; i++) if (y <= pts[i][1]) { const a = pts[i - 1], b = pts[i], t = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * t; } return endX; };
const rnd = n => { const x = Math.sin(n * 91.7) * 43758.5; return x - Math.floor(x); };

const palm = (x, y, s, i) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><g class="km-palm" style="animation-delay:${-i * .7}s">
  <path d="M0 0Q6-22 2-44" stroke="#8a5a2b" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${[-70, -35, 0, 35, 70].map(a => `<path d="M2-44q${a < 0 ? -22 : 22} ${-8 - Math.abs(a) / 8} ${a * .55} ${14 + Math.abs(a) / 6}q${a < 0 ? 6 : -6}-6 ${a < 0 ? -2 : 2}-14" transform="rotate(${a * .3} 2 -44)" fill="#2fa83a" stroke="#1d7a2a" stroke-width="1.2"/>`).join('')}
  <circle cx="0" cy="-42" r="3" fill="#6b3f16"/></g></g>`;
const tree = (x, y, s) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><ellipse cy="9" rx="10" ry="3" fill="rgba(0,0,0,.15)"/><circle r="10" fill="#2f8f3a"/><circle cx="-3" cy="-3" r="6.5" fill="#4cb84a"/></g>`;
const peak = (x, y, s) => `<g transform="translate(${f(x)} ${f(y)}) scale(${s})"><path d="M-24 14L-4-26 6-10 14-20 30 14Z" fill="#b9733b" stroke="#7a4a22" stroke-width="2" stroke-linejoin="round"/><path d="M-4-26L6-10 0 14-24 14Z" fill="#d79a5c"/><path d="M-4-26l-6 10 6-3 5 4z" fill="#fff"/></g>`;
const river = (y0, k) => {
  const sx = coastX(y0 - 90) + 330, sy = y0 - 90, ex = coastX(y0) - 26, p = [];
  for (let t = 0; t <= 6; t++) p.push([sx + (ex - sx) * t / 6 + (t % 2 ? 34 : -34) * k * (t < 6 ? 1 : 0), sy + 90 * t / 6]);
  return smooth(p);
};
const squiggle = (x, y) => `M${f(x)} ${f(y)}q6-5 12 0t12 0`;


// ── Map scenery: villages, parks, beaches, forts, roads, railway, wildlife ──
const plaque = (x, y, t) => { const w = t.length * 6.4 + 16; return `<g transform="translate(${f(x)} ${f(y)})"><rect x="${-w / 2}" y="-10" width="${w}" height="19" rx="7" fill="#fff4d6" stroke="#8a5a2b" stroke-width="1.8"/><text y="4" text-anchor="middle" font-family="Outfit,sans-serif" font-weight="800" font-size="10" fill="#6b3f16">${t}</text></g>`; };
const house = (x, y, c) => `<g transform="translate(${f(x)} ${f(y)})"><rect x="-7" y="-6" width="14" height="11" fill="#fff4d6" stroke="#8a5a2b" stroke-width="1.4"/><path d="M-9-6L0-15 9-6Z" fill="${c}" stroke="#6b3f16" stroke-width="1.4" stroke-linejoin="round"/><rect x="-2" y="-1" width="4" height="6" fill="#8a5a2b"/></g>`;
const village = (x, y, name, seed) => { const cs = ['#d9382f', '#e8743a', '#c2452f']; let o = ''; for (let i = 0; i < 6; i++) o += house(x + (i % 3) * 22 - 22 + rnd(seed + i) * 6, y + Math.floor(i / 3) * 20 - 6 + rnd(seed + i + 9) * 5, cs[i % 3]); return o + plaque(x, y + 34, name); };
const park = (x, y, name) => `<g><rect x="${x - 62}" y="${y - 34}" width="124" height="68" rx="22" fill="#b6ec6c" stroke="#fff" stroke-width="3"/><path d="M${x - 50} ${y + 10}Q${x} ${y - 30} ${x + 50} ${y + 10}" fill="none" stroke="#f6e0a0" stroke-width="5" stroke-linecap="round"/><ellipse cx="${x + 28}" cy="${y + 12}" rx="20" ry="10" fill="#4cc3ea" stroke="#fff" stroke-width="2"/><path class="km-sq" d="${squiggle(x + 18, y + 12)}" style="stroke-width:1.6"/>${tree(x - 38, y - 8, .8)}${tree(x - 14, y + 14, .7)}${tree(x + 6, y - 14, .9)}${tree(x + 42, y - 14, .7)}<rect x="${x - 22}" y="${y + 20}" width="14" height="4" rx="2" fill="#8a5a2b"/>${plaque(x, y - 40, name)}</g>`;
const rice = (x, y) => [0, 1, 2].map(i => `<rect x="${x - 40}" y="${y - 24 + i * 17}" width="80" height="14" rx="5" fill="${i % 2 ? '#c6dc55' : '#e1ee7a'}" stroke="#8fae2c" stroke-width="1.4"/>`).join('') + plaque(x, y + 42, 'Rice Fields');
const orchard = (x, y) => { let o = ''; for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const tx = x - 44 + c * 22, ty = y - 18 + r * 20; o += `<circle cx="${tx}" cy="${ty}" r="8" fill="#2f9a3a" stroke="#1d7a2a" stroke-width="1"/><circle cx="${tx - 2}" cy="${ty - 1}" r="2.2" fill="#ffb02e"/><circle cx="${tx + 3}" cy="${ty + 2}" r="2.2" fill="#ffb02e"/>`; } return o + plaque(x, y + 40, 'Mango Orchard'); };
const umbrella = (x, y, c) => `<g transform="translate(${f(x)} ${f(y)}) scale(1.5)"><path d="M0 0V-12" stroke="#6b3f16" stroke-width="1.6"/><path d="M-9-12Q0-22 9-12Z" fill="${c}" stroke="#fff" stroke-width="1.2"/><path d="M-3-14Q0-20 3-14" fill="none" stroke="#fff" stroke-width="1"/><rect x="-13" y="2" width="12" height="4" rx="2" fill="#fff" stroke="#8a5a2b" stroke-width="1"/></g>`;
const beach = (y, name) => { const x = coastX(y); let o = '';[['#e8433a', 0], ['#3a8fe0', 17], ['#ffb02e', 34]].forEach(([c, d], i) => o += umbrella(x + 28 + (i % 2) * 10, y + d - 8, c)); return o + `<circle cx="${f(x + 30)}" cy="${f(y + 46)}" r="4" fill="#fff" stroke="#d9382f" stroke-width="1.5"/>` + plaque(x - 34, y - 22, name); };
const island = (x, y, kind) => `<g transform="translate(${f(x)} ${f(y)})"><ellipse class="km-foam" rx="46" ry="30" style="stroke-width:10"/><ellipse rx="42" ry="26" fill="#f6e0a0" stroke="#8a5a2b" stroke-width="2.5"/><ellipse rx="34" ry="19" fill="#7ccf3f"/>
  <rect x="-22" y="-14" width="44" height="22" fill="#cfc8ba" stroke="#6f675a" stroke-width="2"/><path d="M-22-14v-5h6v5h6v-5h6v5h6v-5h6v5h6v-5h6v5" fill="#cfc8ba" stroke="#6f675a" stroke-width="2"/>
  <rect x="-26" y="-22" width="9" height="30" fill="#bdb5a5" stroke="#6f675a" stroke-width="2"/><rect x="17" y="-22" width="9" height="30" fill="#bdb5a5" stroke="#6f675a" stroke-width="2"/>
  <path d="M0-14V-34" stroke="#5a3512" stroke-width="2"/><path d="M0-34l13 4-13 5z" fill="#ff9933"/><rect x="-4" y="-2" width="8" height="10" rx="4" fill="#6b3f16"/></g>` + plaque(x, y + 44, kind);
const lighthouse = (x, y) => `<g transform="translate(${f(x)} ${f(y)})"><ellipse cy="3" rx="14" ry="5" fill="rgba(0,0,0,.2)"/><path d="M-8 2L-5-44H5L8 2Z" fill="#fff" stroke="#6b3f16" stroke-width="2"/><path d="M-6.5-14L6.5-14 7-25-6-25Z" fill="#e8433a"/><rect x="-7" y="-52" width="14" height="9" rx="2" fill="#ffe27a" stroke="#6b3f16" stroke-width="2"/><path d="M-9-52L0-62 9-52Z" fill="#e8433a" stroke="#6b3f16" stroke-width="1.6"/>
  <path d="M0-48L-110-70V-26Z" fill="rgba(255,240,160,.5)"><animateTransform attributeName="transform" type="rotate" values="-18 0 -48;18 0 -48;-18 0 -48" dur="5s" repeatCount="indefinite"/></path></g>`;
const turbine = (x, y) => `<g transform="translate(${f(x)} ${f(y)})"><path d="M0 0V-34" stroke="#fff" stroke-width="3" stroke-linecap="round"/><g class="km-spin" transform="translate(0 -34)"><path d="M0 0V-18M0 0L15 9M0 0L-15 9" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle r="3" fill="#d9382f"/></g></g>`;
const fboat = (x, y, i) => `<g transform="translate(${f(x)} ${f(y)})"><g class="km-bob" style="animation-delay:${-i * .6}s"><path d="M-12 0h24l-5 7h-14z" fill="#e8743a" stroke="#6b3f16" stroke-width="1.6" stroke-linejoin="round"/><path d="M0 0V-14l9 12Z" fill="#fff" stroke="#8a6a45" stroke-width="1.2"/></g></g>`;
const buoy = (x, y, i) => `<g class="km-bob" style="animation-delay:${-i}s" transform="translate(${f(x)} ${f(y)})"><path d="M-5 0Q0-9 5 0Z" fill="#e8433a" stroke="#fff" stroke-width="1.4"/><rect x="-5" y="0" width="10" height="3" fill="#fff"/></g>`;
const dolphin = (x, y, d) => `<g transform="translate(${f(x)} ${f(y)})"><g class="km-jump" style="animation-delay:${d}s"><path d="M-16 6Q-8-14 10-6Q16-2 22-8Q20 2 14 6Q4 10-16 6Z" fill="#7aa7c7" stroke="#2f5f86" stroke-width="1.8"/><path d="M-2-6L2-15 5-6Z" fill="#7aa7c7" stroke="#2f5f86" stroke-width="1.4"/></g></g>`;
const bird = (y, d, s) => `<g transform="translate(0 ${y})"><path class="km-bird" d="M0 0q5-7 10 0q5-7 10 0" style="animation-delay:${-d}s;animation-duration:${s}s"/></g>`;

function scenery() {
  const sh = pts.map(([x, y]) => [x + 78, y]), roadD = smooth(sh), railD = smooth(pts.map(([x, y]) => [Math.min(x + 300, W - 22 - (y / H) * 6), y]));
  const car = (c, dur, b, rev) => `<g><rect x="-7" y="-4" width="14" height="8" rx="3" fill="${c}" stroke="#fff" stroke-width="1"/><rect x="0" y="-3" width="5" height="6" fill="#bfefff"/><animateMotion dur="${dur}s" begin="${b}s" repeatCount="indefinite" rotate="auto" keyPoints="${rev ? '1;0' : '0;1'}" keyTimes="0;1" calcMode="linear"><mpath href="#km-road"/></animateMotion></g>`;
  const train = `<g>${[0, 1, 2, 3].map(i => `<rect x="${-i * 15 - 7}" y="-4" width="13" height="8" rx="2" fill="${i ? '#3a8fe0' : '#d9382f'}" stroke="#fff" stroke-width="1"/>`).join('')}<animateMotion dur="38s" repeatCount="indefinite" rotate="auto"><mpath href="#km-rail"/></animateMotion></g>`;
  let o = `<path id="km-road" d="${roadD}" fill="none"/><use href="#km-road" fill="none" stroke="#6b5a45" stroke-width="14" stroke-linecap="round"/><use href="#km-road" fill="none" stroke="#9a9aa3" stroke-width="10" stroke-linecap="round"/><use href="#km-road" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="7 7"/>`;
  o += `<path id="km-rail" d="${railD}" fill="none" stroke="#5b5146" stroke-width="7"/><use href="#km-rail" fill="none" stroke="#e9dcc0" stroke-width="3" stroke-dasharray="2 4"/>`;
  o += rice(coastX(385) + 250, 385) + orchard(coastX(560) + 235, 560) + park(coastX(225) + 235, 225, 'Coastal Park');
  o += `<g><path d="M${f(coastX(60) + 250)} 58Q${f(coastX(60) + 285)} 36 ${f(coastX(60) + 320)} 58Q${f(coastX(60) + 285)} 80 ${f(coastX(60) + 250)} 58Z" fill="#4cc3ea" stroke="#fff" stroke-width="3"/></g>` + plaque(coastX(60) + 285, 92, 'Lake');
  o += village(coastX(225) + 118, 238, 'Roha', 1) + village(coastX(385) + 120, 392, 'Chiplun', 20) + village(coastX(560) + 108, 572, 'Kudal', 40) + village(coastX(60) + 128, 62, 'Panvel', 60);
  o += village(coastX(470) + 150, 470, 'Ratnagiri', 80);
  o += beach(112, 'Kashid Beach') + beach(318, 'Guhagar Beach') + beach(510, 'Tarkarli Beach');
  o += lighthouse(coastX(430) + 12, 438) + turbine(Math.min(coastX(150) + 395, W - 30), 150) + turbine(Math.min(coastX(330) + 395, W - 30), 330) + turbine(Math.min(coastX(500) + 395, W - 30), 500);
  o += `<g><path d="M${f(coastX(410) + 345)} 392V430" stroke="#fff" stroke-width="5" stroke-dasharray="7 4" class="km-flow"/><ellipse cx="${f(coastX(410) + 345)}" cy="434" rx="9" ry="3" fill="#bfefff"/></g>`;
  o += `<rect x="${f(coastX(205) - 52)}" y="203" width="56" height="5" fill="#8a5a2b" stroke="#5a3512"/>` + [0, 1, 2, 3].map(i => `<rect x="${f(coastX(205) - 50 + i * 15)}" y="208" width="3" height="7" fill="#5a3512"/>`).join('') + plaque(coastX(205) - 70, 195, 'Harbour');
  o += island(coastX(290) - 120, 290, 'Janjira Fort') + island(coastX(580) - 125, 580, 'Sindhudurg Fort');
  [[120, 60], [260, 110], [400, 130], [470, 150], [545, 100]].forEach(([y, d], i) => o += fboat(coastX(y) - 50 - rnd(i) * 30, y + 12, i));
  [[90, 150], [210, 300], [350, 120], [450, 280], [600, 220]].forEach(([y, x], i) => o += buoy(Math.min(x, coastX(y) - 70), y, i));
  o += dolphin(100, 440, 0) + dolphin(190, 210, 2.5) + [60, 190, 330, 470].map((y, i) => bird(y, i * 3, 14 + i * 3)).join('');
  o += `<ellipse class="km-cl2" cx="0" cy="200" rx="90" ry="22"/><ellipse class="km-cl2" cx="0" cy="480" rx="120" ry="26" style="animation-delay:-35s"/><ellipse class="km-cl2" cx="0" cy="340" rx="70" ry="18" style="animation-delay:-60s"/>`;
  o += car('#e8433a', 26, 0, false) + car('#3a8fe0', 30, 7, true) + car('#ffb02e', 34, 13, false) + `<g>${train}</g>`;
  return o;
}

export function renderKonkanMap(el, props, onOpen) {
  const list = props.filter(p => p.lat && p.lng);
  const ys = list.map(p => px(p.lat, p.lng)[1]), order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]), GAP = 58;
  for (let k = 1; k < order.length; k++) ys[order[k]] = Math.max(ys[order[k]], ys[order[k - 1]] + GAP);
  const last = order.at(-1); if (last !== undefined && ys[last] > H - 70) { ys[last] = H - 70; for (let k = order.length - 2; k >= 0; k--) ys[order[k]] = Math.min(ys[order[k]], ys[order[k + 1]] - GAP); }
  const rank = []; order.forEach((idx, r) => rank[idx] = r);
  const spots = list.map((_, i) => [coastX(ys[i]) + 34 + (rank[i] % 2) * 90, ys[i]]);

  let seaSq = '';
  for (let i = 0; i < 46; i++) { const y = 10 + rnd(i) * (H - 20), x = rnd(i + 50) * Math.max(80, coastX(y) - 60); seaSq += `<path class="km-sq" d="${squiggle(x, y)}" style="animation-delay:${-rnd(i + 9) * 6}s"/>`; }
  let decor = '';
  for (let i = 0; i < 70; i++) { const y = 20 + rnd(i + 3) * (H - 40), x = coastX(y) + 70 + rnd(i + 7) * 190; decor += tree(x, y, .7 + rnd(i) * .6); }
  for (let y = 45, i = 0; y < H - 20; y += 62, i++) decor += palm(coastX(y) + 16 + rnd(i) * 10, y + 12, .8 + rnd(i + 2) * .35, i);
  for (let y = 40, i = 0; y < H; y += 58, i++) decor += peak(coastX(y) + 330 + rnd(i) * 70, y, .9 + rnd(i + 4) * .5);
  const rivers = [190, 350, 510].map((y, i) => { const d = river(y, i % 2 ? -1 : 1); return `<path d="${d}" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#35aee0" stroke-width="15" stroke-linecap="round"/><path class="km-flow" d="${d}" fill="none" stroke="#c9f1ff" stroke-width="3" stroke-linecap="round"/>`; }).join('');
  const shipPath = (o, d) => smooth([40, 180, 330, 480, 600].map(y => [coastX(y) - o - rnd(y) * 40, y]));
  const ship = (id, s, dur, begin, rev) => `<g><g class="km-bob"><use href="#km-ship" transform="scale(${s})"/></g><animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" keyPoints="${rev ? '1;0' : '0;1'}" keyTimes="0;1" calcMode="linear"><mpath href="#${id}"/></animateMotion></g>`;

  const pins = list.map((p, i) => {
    const [x, y] = spots[i], label = '₹' + Number(p.price || 0).toLocaleString('en-IN'), w = 28 + label.length * 8;
    return `<g class="km-pin" data-i="${i}" transform="translate(${f(x)} ${f(y)})" style="animation-delay:${1.6 + i * .15}s"><g class="km-in">
      <ellipse class="km-ring" rx="10" ry="4"/><ellipse cy="1" rx="11" ry="4" fill="rgba(0,0,0,.28)"/>
      <g class="km-bob2" style="animation-delay:${-i * .4}s"><path d="M0 0C-22-22-18-46 0-46S22-22 0 0Z" fill="#e8433a" stroke="#fff" stroke-width="3"/><circle cy="-30" r="7" fill="#fff"/></g>
      <rect x="${-w / 2}" y="8" width="${w}" height="24" rx="7" fill="#fff4d6" stroke="#8a5a2b" stroke-width="2.2"/>
      <text class="km-pt" y="25" text-anchor="middle">${label}</text>
      <text class="km-pn" y="46" text-anchor="middle">${escapeHtml(p.location)}</text></g></g>`;
  }).join('');
  const minPrice = list.length ? Math.min(...list.map(p => Number(p.price) || 0)) : 0;

  el.innerHTML = `<style>
    .km{position:relative;width:100%;height:100%;min-height:480px;overflow:hidden;border-radius:22px;background:#3fb6e0;border:4px solid #8a5a2b;box-sizing:border-box;touch-action:none;user-select:none}
    .km svg{width:100%;height:100%;display:block;cursor:grab}.km svg:active{cursor:grabbing}
    .km-sq{fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;opacity:.7;animation:km-sqa 5s ease-in-out infinite}
    @keyframes km-sqa{0%,100%{transform:translateX(0);opacity:.25}50%{transform:translateX(14px);opacity:.85}}
    .km-foam{fill:none;stroke:#fff;stroke-width:16;stroke-linejoin:round;animation:km-foam 3.2s ease-in-out infinite}
    @keyframes km-foam{0%,100%{opacity:.35;stroke-width:12}50%{opacity:.95;stroke-width:20}}
    .km-flow{stroke-dasharray:6 14;animation:km-dash 1.2s linear infinite}
    @keyframes km-dash{to{stroke-dashoffset:-20}}
    .km-trail{fill:none;stroke:#e9c77b;stroke-width:3.5;stroke-dasharray:1 9;stroke-linecap:round;animation:km-dash 2s linear infinite}
    .km-palm{transform-box:fill-box;transform-origin:50% 100%;animation:km-sway 3.6s ease-in-out infinite}
    @keyframes km-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
    .km-bob{animation:km-bobk 2.4s ease-in-out infinite}
    @keyframes km-bobk{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}
    .km-bob2{animation:km-hop 1.6s ease-in-out infinite}
    @keyframes km-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    .km-pin{cursor:pointer;opacity:0;animation:km-pop .5s ease forwards}
    @keyframes km-pop{to{opacity:1}}
    .km-in{transition:transform .25s;transform-box:fill-box;transform-origin:50% 100%}.km-pin:hover .km-in{transform:scale(1.2)}
    .km-ring{fill:none;stroke:#fff;stroke-width:3;animation:km-ping 2.2s ease-out infinite;transform-box:fill-box;transform-origin:center}
    @keyframes km-ping{from{transform:scale(.8);opacity:1}to{transform:scale(4);opacity:0}}
    .km-pt{fill:#6b3f16;font:800 14px Outfit,sans-serif}
    .km-pn{fill:#fff;font:800 12px Outfit,sans-serif;letter-spacing:.06em;stroke:#5a3512;stroke-width:3.5;paint-order:stroke;stroke-linejoin:round}
    .km-hud{position:absolute;left:16px;top:14px;pointer-events:none;background:#fff4d6;border:3px solid #8a5a2b;border-radius:14px;padding:.45rem .9rem;color:#6b3f16;font-family:Outfit,sans-serif;box-shadow:0 5px 0 #8a5a2b}
    .km-hud h3{margin:0;font:800 1.35rem 'Playfair Display',serif}.km-hud span{font-size:.78rem;font-weight:600}
    .km-ctl{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;gap:7px;z-index:4}
    .km-ctl button{width:40px;height:40px;border-radius:12px;border:3px solid #8a5a2b;background:#fff4d6;color:#6b3f16;font:800 1.2rem Outfit,sans-serif;cursor:pointer;box-shadow:0 3px 0 #8a5a2b;transition:transform .15s}
    .km-ctl button:hover{transform:translateY(-2px);background:#ffe49a}
    .km-panel{position:absolute;right:14px;bottom:14px;width:270px;background:#fff4d6;border:4px solid #8a5a2b;border-radius:18px;overflow:hidden;color:#5a3512;font-family:Outfit,sans-serif;box-shadow:0 8px 0 #8a5a2b,0 20px 40px rgba(0,0,0,.35);animation:km-up .45s cubic-bezier(.3,1.5,.5,1) both;z-index:5}
    @keyframes km-up{from{opacity:0;transform:translateY(30px) scale(.9)}}
    .km-panel img{width:100%;height:125px;object-fit:cover;border-bottom:3px solid #8a5a2b}
    .km-panel .b{padding:.8rem 1rem 1rem}.km-panel b{font:800 1.1rem 'Playfair Display',serif;display:block}
    .km-panel small{color:#8a6a45;font-weight:600}.km-panel .pr{margin:.45rem 0;font-weight:800;font-size:1.25rem;color:#d9382f}
    .km-panel button.go{width:100%;border:3px solid #2f7d1f;border-radius:12px;padding:.6rem;font:800 .95rem Outfit,sans-serif;color:#fff;background:#4cb84a;box-shadow:0 4px 0 #2f7d1f;cursor:pointer}
    .km-panel button.go:active{transform:translateY(3px);box-shadow:0 1px 0 #2f7d1f}
    .km-x{position:absolute;top:4px;right:10px;cursor:pointer;font-size:1.5rem;color:#fff;text-shadow:0 1px 4px #000;z-index:2}
    @media(prefers-reduced-motion:reduce){.km *{animation:none!important}.km-pin{opacity:1}}
  .km-spin{transform-box:fill-box;transform-origin:center;animation:km-rot 3s linear infinite}
    @keyframes km-rot{to{transform:rotate(360deg)}}
    .km-jump{animation:km-jmp 5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
    @keyframes km-jmp{0%,55%,100%{transform:translateY(14px) rotate(-30deg);opacity:0}65%{opacity:1}75%{transform:translateY(-16px) rotate(0)}90%{transform:translateY(10px) rotate(35deg);opacity:1}}
    .km-bird{fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;animation:km-fl 16s linear infinite}
    @keyframes km-fl{from{transform:translateX(-60px)}to{transform:translateX(520px)}}
    .km-cl2{fill:#fff;opacity:.5;filter:url(#km-soft);animation:km-cl 100s linear infinite}
    @keyframes km-cl{from{transform:translateX(-250px)}to{transform:translateX(1250px)}}
    .km-legend{position:absolute;left:14px;bottom:14px;background:#fff4d6;border:3px solid #8a5a2b;border-radius:14px;padding:.45rem .7rem;font:700 .74rem/1.55 Outfit,sans-serif;color:#6b3f16;box-shadow:0 4px 0 #8a5a2b;pointer-events:none}
    .km-legend b{display:block;font:800 .82rem 'Playfair Display',serif;margin-bottom:2px}
  </style>
  <div class="km">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cartoon map of Konkan stays">
      <defs>
        <linearGradient id="km-sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#66d6ee"/><stop offset="1" stop-color="#2a9fd4"/></linearGradient>
        <radialGradient id="km-grass" cx=".3" cy=".4" r=".9"><stop offset="0" stop-color="#9be04a"/><stop offset="1" stop-color="#58b52c"/></radialGradient>
        <pattern id="km-cliff" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#d49a5d"/><rect width="5" height="10" fill="#bf8148"/></pattern>
        <filter id="km-soft"><feGaussianBlur stdDeviation="9"/></filter>
        <clipPath id="km-clip"><path d="${landPath}"/></clipPath>
        <symbol id="km-ship" overflow="visible"><path d="M-30 0h60l-10 14h-40z" fill="#8a5a2b" stroke="#5a3512" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 0V-52" stroke="#5a3512" stroke-width="3"/><path d="M-3-48Q-30-30-26-6H-3Z" fill="#fff4d6" stroke="#8a6a45" stroke-width="2"/><path d="M3-48Q30-30 26-6H3Z" fill="#fff" stroke="#8a6a45" stroke-width="2"/><path d="M0-52l14 4-14 5z" fill="#e8433a"/></symbol>
        <path id="km-p1" d="${shipPath(120)}"/><path id="km-p2" d="${shipPath(190)}"/>
      </defs>
      <rect x="-700" y="-600" width="${W + 2200}" height="${H + 1400}" fill="url(#km-sea)"/>
      ${seaSq}
      <path class="km-foam" d="${coastPath}"/>
      <path d="${landPath}" transform="translate(-9 15)" fill="url(#km-cliff)" stroke="#7a4a22" stroke-width="3" stroke-linejoin="round"/>
      <path d="${landPath}" fill="url(#km-grass)"/>
      <g clip-path="url(#km-clip)"><path d="${coastPath}" fill="none" stroke="#f6e0a0" stroke-width="64" stroke-linejoin="round"/><path d="${coastPath}" fill="none" stroke="#fff0c0" stroke-width="10" transform="translate(-4 0)"/>
        </g>
      <path d="${coastPath}" fill="none" stroke="#6bc23a" stroke-width="3" stroke-linejoin="round" opacity=".0"/>
      ${rivers}${decor}${scenery()}
      <text x="${coastX(300) + 190}" y="330" font-family="Playfair Display,serif" font-weight="800" font-size="26" fill="#2c6b1f" opacity=".45" letter-spacing="6">MAHARASHTRA</text>
      ${ship('km-p1', .8, 40, 0, false)}${ship('km-p2', .6, 55, 8, true)}
      <g transform="translate(${f(coastX(12) + 100)} 24)"><rect x="-44" y="-15" width="88" height="26" rx="8" fill="#fff4d6" stroke="#8a5a2b" stroke-width="2.2"/><text y="3" text-anchor="middle" class="km-pt" style="font-size:13px">⚓ MUMBAI</text></g>
      <g transform="translate(150 330)"><circle r="40" fill="#f6e0a0" stroke="#8a5a2b" stroke-width="4"/><circle r="30" fill="#fff" stroke="#8a5a2b" stroke-width="2"/>
        <g><path d="M0-27L6 0 0 27-6 0Z" fill="#d9382f"/><path d="M-27 0L0-6 27 0 0 6Z" fill="#4a8fd0"/><circle r="5" fill="#fff4d6" stroke="#8a5a2b" stroke-width="2"/><animateTransform attributeName="transform" type="rotate" values="-10;14;-10" dur="6s" repeatCount="indefinite"/></g>
        <text y="-44" text-anchor="middle" class="km-pt">N</text></g>
      ${pins}
    </svg>
    <div class="km-hud"><h3>🏝️ Konkan Coast</h3><span>${list.length} stays · from ₹${minPrice.toLocaleString('en-IN')}/night · tap a pin</span></div>
    <div class="km-legend"><b>Map key</b>📍 Stay · 🏖️ Beach · 🏘️ Village<br>🏰 Fort · 🌳 Park · 🗼 Lighthouse<br>🛣️ Highway · 🚆 Railway · 🐬 Wildlife</div>
    <div class="km-ctl"><button data-z="1.5" aria-label="Zoom in">+</button><button data-z="0.67" aria-label="Zoom out">−</button><button data-z="0" aria-label="Reset view">⟲</button></div>
  </div>`;

  const box = el.querySelector('.km'), svg = box.querySelector('svg');
  const home = [0, 0, W, H];
  let vb = matchMedia('(prefers-reduced-motion:reduce)').matches ? home.slice() : [-380, -260, 1660, 1180], raf;
  const setVB = () => svg.setAttribute('viewBox', vb.map(n => n.toFixed(1)).join(' '));
  const fly = (to, ms = 1100) => {
    cancelAnimationFrame(raf); const from = vb.slice(), t0 = performance.now();
    const step = t => { let k = Math.min(1, (t - t0) / ms); k = 1 - Math.pow(1 - k, 3); vb = from.map((v, i) => v + (to[i] - v) * k); setVB(); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
  };
  setVB(); setTimeout(() => fly(home, 2600), 120);

  box.querySelectorAll('.km-ctl button').forEach(b => b.onclick = () => {
    const z = +b.dataset.z; if (!z) return fly(home);
    const w = Math.min(W * 1.7, Math.max(220, vb[2] / z)), h = w * H / W;
    fly([vb[0] + (vb[2] - w) / 2, vb[1] + (vb[3] - h) / 2, w, h], 500);
  });

  let drag = null, moved = 0;
  svg.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; moved = 0; cancelAnimationFrame(raf); });
  addEventListener('pointerup', () => { drag = null; });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const s = Math.min(svg.clientWidth / vb[2], svg.clientHeight / vb[3]), dx = e.clientX - drag[0], dy = e.clientY - drag[1];
    moved += Math.abs(dx) + Math.abs(dy); vb[0] -= dx / s; vb[1] -= dy / s; drag = [e.clientX, e.clientY]; setVB();
  });

  const closePanel = () => box.querySelector('.km-panel')?.remove();
  svg.addEventListener('click', () => { if (moved < 5) closePanel(); });
  box.querySelectorAll('.km-pin').forEach(g => g.addEventListener('click', ev => {
    ev.stopPropagation(); closePanel();
    const i = +g.dataset.i, p = list[i], [x, y] = spots[i], w = 380, h = w * H / W;
    fly([x - w * .4, y - h / 2, w, h], 1100);
    const card = document.createElement('div'); card.className = 'km-panel';
    card.innerHTML = `<span class="km-x">&times;</span><img src="${escapeHtml(p.image || '../assets/images/destinations/alibaug.avif')}" onerror="this.src='../assets/images/destinations/alibaug.avif'" alt="">
      <div class="b"><b>${escapeHtml(p.title)}</b><small>📍 ${escapeHtml(p.location)} · ${Number(p.guests) || 0} guests · ${Number(p.bedrooms) || 0} bedrooms</small>
      <div class="pr">₹${Number(p.price || 0).toLocaleString('en-IN')} <small>/ night</small></div><button type="button" class="go">View &amp; Book</button></div>`;
    card.querySelector('.km-x').onclick = () => { closePanel(); fly(home); };
    card.querySelector('.go').onclick = () => onOpen?.(p.id);
    box.appendChild(card);
  }));
}