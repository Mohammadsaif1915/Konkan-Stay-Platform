const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function getStayNights(checkin, checkout) {
  const startDate = parseDate(checkin);
  const endDate = parseDate(checkout);
  if (!startDate || !endDate) return null;

  const nights = (endDate.getTime() - startDate.getTime()) / DAY_IN_MILLISECONDS;
  return Number.isInteger(nights) && nights > 0 ? nights : null;
}

export function getStayDateKeys(checkin, checkout) {
  const nights = getStayNights(checkin, checkout);
  const startDate = parseDate(checkin);
  if (nights === null || !startDate) return [];

  return Array.from({ length: nights }, (_, offset) => {
    const night = new Date(startDate);
    night.setUTCDate(night.getUTCDate() + offset);
    return night.toISOString().slice(0, 10);
  });
}

export function getOccupiedNightRanges(propertyId, occupiedNights) {
  const dates = Object.entries(occupiedNights || {})
    .filter(([date, occupied]) => occupied === true && parseDate(date))
    .map(([date]) => date)
    .sort();
  if (!dates.length) return [];

  const nextDate = date => {
    const value = parseDate(date);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  };
  const ranges = [];
  let rangeStart = dates[0];
  let rangeEnd = dates[0];

  for (const date of dates.slice(1)) {
    if (date === nextDate(rangeEnd)) {
      rangeEnd = date;
      continue;
    }
    ranges.push({ propId: propertyId, checkin: rangeStart, checkout: nextDate(rangeEnd), status: 'Confirmed' });
    rangeStart = date;
    rangeEnd = date;
  }

  ranges.push({ propId: propertyId, checkin: rangeStart, checkout: nextDate(rangeEnd), status: 'Confirmed' });
  return ranges;
}

export function getHostBookingNextStep(booking, today = getLocalDateString()) {
  if (booking.status === 'Pending verification') {
    return booking.txnId?.trim()
      ? { action: 'Confirmed', label: 'Confirm booking' }
      : { action: null, label: 'Payment reference required' };
  }
  if (booking.status === 'Requested') return { action: null, label: 'Awaiting payment reference' };
  if (booking.status === 'Confirmed') {
    if (today < booking.checkin) return { action: null, label: `Check-in on ${booking.checkin}` };
    if (today >= booking.checkout) return { action: null, label: 'Stay dates passed; follow up with guest' };
    return { action: 'Checked in', label: 'Mark guest checked in' };
  }
  if (booking.status === 'Checked in') {
    if (today < booking.checkout) return { action: null, label: `Check-out on ${booking.checkout}` };
    return { action: 'Completed', label: 'Mark checked out' };
  }
  if (booking.status === 'Completed') return { action: null, label: 'Stay completed' };
  if (booking.status === 'Declined') return { action: null, label: 'Request declined' };
  return { action: null, label: 'No action available' };
}

export function hasDateOverlap(firstCheckin, firstCheckout, secondCheckin, secondCheckout) {
  if (getStayNights(firstCheckin, firstCheckout) === null
    || getStayNights(secondCheckin, secondCheckout) === null) return false;
  return firstCheckin < secondCheckout && secondCheckin < firstCheckout;
}

export function isPropertyAvailable(propertyId, checkin, checkout, reservations, now = Date.now()) {
  if (getStayNights(checkin, checkout) === null) return false;

  return !reservations.some(reservation => {
    if (reservation.propId !== propertyId
      || !hasDateOverlap(checkin, checkout, reservation.checkin, reservation.checkout)) return false;
    if (reservation.status === 'Confirmed' || reservation.status === 'Demo confirmed') return true;
    return reservation.status === 'Hold' && Number(reservation.expiresAt) > now;
  });
}

export function getAvailabilityStatus(propertyId, checkin, checkout, reservations, now = Date.now(), today = getLocalDateString()) {
  const activeReservations = reservations.filter(reservation => {
    if (reservation.propId !== propertyId) return false;
    if (reservation.status === 'Confirmed' || reservation.status === 'Demo confirmed') return true;
    return reservation.status === 'Hold' && Number(reservation.expiresAt) > now;
  });

  if (checkin || checkout) {
    if (getStayNights(checkin, checkout) === null) return { status: 'choose-dates', availableFrom: null };
    const overlapping = activeReservations.filter(reservation =>
      hasDateOverlap(checkin, checkout, reservation.checkin, reservation.checkout)
    );
    if (!overlapping.length) return { status: 'available', availableFrom: null };
    return {
      status: 'occupied',
      availableFrom: overlapping.reduce((latest, reservation) =>
        reservation.checkout > latest ? reservation.checkout : latest, '')
    };
  }

  let occupiedToday = activeReservations.filter(reservation =>
    reservation.checkin <= today && today < reservation.checkout
  );
  if (!occupiedToday.length) {
    const nextReservation = activeReservations
      .filter(reservation => reservation.checkin > today)
      .sort((first, second) => first.checkin.localeCompare(second.checkin))[0];
    return { status: 'available', availableFrom: null, bookedFrom: nextReservation?.checkin || null };
  }

  let availableFrom = occupiedToday.reduce((latest, reservation) =>
    reservation.checkout > latest ? reservation.checkout : latest, '');
  while (true) {
    const followingReservations = activeReservations.filter(reservation =>
      reservation.checkin <= availableFrom && reservation.checkout > availableFrom
    );
    const extendedDate = followingReservations.reduce((latest, reservation) =>
      reservation.checkout > latest ? reservation.checkout : latest, availableFrom);
    if (extendedDate === availableFrom) break;
    availableFrom = extendedDate;
  }

  return { status: 'occupied', availableFrom };
}

export function calculateStayTotal(pricePerNight, checkin, checkout) {
  const nights = getStayNights(checkin, checkout);
  if (!Number.isSafeInteger(pricePerNight) || pricePerNight <= 0 || nights === null) return null;

  const total = pricePerNight * nights;
  return Number.isSafeInteger(total) ? total : null;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}