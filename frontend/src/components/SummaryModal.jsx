import React from 'react';

export default function SummaryModal({
  selection = {},
  currentDepartureDate = "",
  currentReturnDate = "",
  currentCheckInDate = "",
  currentNights = 1,
  guestName = "",
  onGuestNameChange,
  onGroupBook,
  onBack,
  onReset,
  loading = false,
  dark,
  tokens
}) {
  const { A, border, surf, text, sub } = tokens;

  const flight = selection.flight;
  const returnFlight = selection.returnFlight;
  const hotel = selection.hotel;
  const activities = selection.activities || [];

  const flightPrice = flight ? flight.price : 0;
  const returnFlightPrice = returnFlight ? returnFlight.price : 0;
  const hotelPrice = hotel ? hotel.price * (currentNights || 1) : 0;
  const activitiesPrice = activities.reduce((sum, act) => sum + act.price, 0);

  const totalPrice = ((flightPrice + returnFlightPrice + hotelPrice + activitiesPrice) / 100).toFixed(2);

  return (
    <div style={{
      padding: 18, borderRadius: 18,
      background: surf,
      border: `1px dashed ${A.blue}`,
      display: 'flex', flexDirection: 'column', gap: 14
    }}
    className="animate-scale-in"
    >
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: A.blue }}>
        🛒 Trip Booking Summary
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        {flight && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontWeight: 600 }}>
              <span>✈️ Outbound Flight: {flight.name}</span>
              <span>€{(flight.price / 100).toFixed(2)}</span>
            </div>
            <span style={{ fontSize: 11, color: sub }}>Departure: {currentDepartureDate} • {flight.origin} to {flight.destination}</span>
          </div>
        )}

        {hotel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontWeight: 600 }}>
              <span>🏨 Accommodation: {hotel.name}</span>
              <span>€{((hotel.price * (currentNights || 1)) / 100).toFixed(2)}</span>
            </div>
            <span style={{ fontSize: 11, color: sub }}>Check-in: {currentCheckInDate} • Duration: {currentNights} nights (€{(hotel.price / 100).toFixed(2)} / night)</span>
          </div>
        )}

        {activities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
            <span style={{ color: text, fontWeight: 600 }}>🎟️ Selected Attractions:</span>
            {activities.map((act, actIdx) => (
              <div key={actIdx} style={{ display: 'flex', justifyContent: 'space-between', color: sub, paddingLeft: 8 }}>
                <span>• {act.name}</span>
                <span style={{ fontWeight: 600, color: text }}>€{(act.price / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {returnFlight && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontWeight: 600 }}>
              <span>✈️ Return Flight: {returnFlight.name}</span>
              <span>€{(returnFlight.price / 100).toFixed(2)}</span>
            </div>
            <span style={{ fontSize: 11, color: sub }}>Departure: {currentReturnDate} • {returnFlight.origin} to {returnFlight.destination}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
          <span>Total Itinerary Price</span>
          <span style={{ color: A.blue }}>€{totalPrice}</span>
        </div>
      </div>
      
      {/* Embedded Guest Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>Guest Full Name</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            required
            type="text"
            value={guestName}
            onChange={e => onGuestNameChange(e.target.value)}
            placeholder="e.g. John Doe"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`,
              background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
            }}
          />
          <button
            onClick={onGroupBook}
            disabled={loading || !guestName.trim()}
            style={{
              background: A.blue, color: '#fff', border: 'none', borderRadius: 12,
              padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: !guestName.trim() ? 0.6 : 1, transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Book Selected Trip
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent', color: text, border: `1px solid ${border}`,
            borderRadius: 12, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          🎚 Back
        </button>
        <button
          onClick={onReset}
          style={{
            background: 'transparent', color: '#ff3b30', border: 'none',
            fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}
        >
          Reset Selection
        </button>
      </div>
    </div>
  );
}
