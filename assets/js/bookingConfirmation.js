import { escapeHtml } from './bookingUtils.mjs';

export function printReservationConfirmation(booking) {
  const printWindow = window.open('', '_blank', 'popup,width=820,height=900');
  if (!printWindow) {
    alert('Allow pop-ups to print or save your reservation confirmation.');
    return;
  }

  const isDemo = booking.source === 'demo';
  const formatDate = value => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? escapeHtml(value)
      : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const markUrl = new URL('../assets/images/konkanstay-mark.svg', window.location.href).href;
  const heading = isDemo ? 'Demo booking confirmed' : 'Reservation confirmed';
  const message = isDemo
    ? 'This is a local demonstration only. No payment was taken and this is not a real reservation.'
    : 'Your host has confirmed this stay. Keep this confirmation handy when you travel.';
  const badge = isDemo ? 'DEMO ONLY · NOT A REAL RESERVATION' : 'HOST CONFIRMED';
  const note = isDemo
    ? 'DEMO ONLY. This record is stored only in this browser. No payment was taken; this is not a valid reservation, payment receipt, or tax invoice.'
    : 'Reservation confirmation only. KonkanStay does not process or verify payments; the host reviewed the transaction reference submitted with this booking. This document is not a tax invoice or payment receipt.';

  printWindow.document.write(`<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${heading} · KonkanStay</title><style>
      @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#f2f0e8;color:#193435;font-family:Georgia,serif}
      .sheet{width:210mm;min-height:297mm;margin:0 auto;padding:22mm 20mm;background:#fbfaf6}
      .top{display:flex;align-items:center;gap:12px;padding-bottom:22px;border-bottom:2px solid #174f4d}
      .top img{width:42px;height:42px}.brand{font-size:23px;font-weight:700;color:#174f4d}.tag{font:11px Arial,sans-serif;letter-spacing:1.5px;color:#687878}
      .eyebrow{margin-top:38px;color:#b57843;font:700 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase}
      h1{margin:8px 0 12px;font-size:36px;font-weight:500;color:#174f4d}.intro{max-width:470px;color:#647372;font:14px/1.7 Arial,sans-serif}
      .status{display:inline-block;margin:22px 0;padding:8px 12px;border-radius:4px;background:${isDemo ? '#fff1df' : '#e3f1e9'};color:${isDemo ? '#8c4d19' : '#286247'};font:700 11px Arial,sans-serif;letter-spacing:1px}
      .property{padding:22px 0;border-top:1px solid #d9dfd7;border-bottom:1px solid #d9dfd7}.property h2{margin:0 0 5px;font-size:24px;font-weight:500}.property p{margin:0;color:#687878;font:13px Arial,sans-serif}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:22px 36px;padding:25px 0}.label{display:block;margin-bottom:5px;color:#788483;font:700 10px Arial,sans-serif;letter-spacing:1.2px;text-transform:uppercase}.value{font:16px Arial,sans-serif;color:#193435}
      .total{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:17px 0;border-top:1px solid #d9dfd7;border-bottom:1px solid #d9dfd7}.total strong{font:700 20px Arial,sans-serif;color:#174f4d}
      .code{margin-top:25px;color:#687878;font:12px Arial,sans-serif;overflow-wrap:anywhere}.note{margin-top:42px;padding-top:14px;border-top:1px solid #d9dfd7;color:#77817e;font:11px/1.6 Arial,sans-serif}
      @media print{body{background:#fff}.sheet{margin:0;box-shadow:none}}
    </style></head><body><main class="sheet">
      <header class="top"><img src="${markUrl}" alt=""><div><div class="brand">KonkanStay</div><div class="tag">COASTAL ESCAPES</div></div></header>
      <div class="eyebrow">Your Konkan journey</div><h1>${heading}</h1>
      <p class="intro">${message}</p><div class="status">${badge}</div>
      <section class="property"><h2>${escapeHtml(booking.propTitle)}</h2><p>${escapeHtml(booking.propLocation)} · Konkan, Maharashtra</p></section>
      <section class="grid">
        <div><span class="label">Check-in</span><span class="value">${formatDate(booking.checkin)}</span></div>
        <div><span class="label">Check-out</span><span class="value">${formatDate(booking.checkout)}</span></div>
        <div><span class="label">Guests</span><span class="value">${Number(booking.guests) || 0}</span></div>
        <div><span class="label">Nights</span><span class="value">${Number(booking.nights) || 0}</span></div>
      </section>
      <div class="total"><span>Stay total${isDemo ? ' · simulated' : ''}</span><strong>₹${Number(booking.totalPrice).toLocaleString('en-IN')}</strong></div>
      <p class="code">Confirmation ID: ${escapeHtml(booking.id)}</p>
      <p class="note">${note}</p>
    </main><script>window.addEventListener('load',()=>{window.focus();window.print()});</script></body></html>`);
  printWindow.document.close();
}