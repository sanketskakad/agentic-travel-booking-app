import React from 'react';
import { Hotel, Check } from 'lucide-react';

export default function HotelSection({
  hotels = [],
  selectedHotel = null,
  onSelectHotel,
  checkInDate = "",
  onCheckInDateChange,
  nights = 1,
  onNightsChange,
  expandedCards = {},
  onToggleExpand,
  renderReviewsSection,
  dark,
  tokens
}) {
  const { A, border, surf, card, text, sub } = tokens;

  let checkOutStr = "";
  if (checkInDate) {
    const outDate = new Date(checkInDate);
    outDate.setDate(outDate.getDate() + (nights || 1));
    if (!isNaN(outDate.getTime())) {
      checkOutStr = outDate.toISOString().split('T')[0];
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: text, letterSpacing: '-0.1px' }}>
        <Hotel size={14} color={A.blue} />
        <span>Step 2: Select Hotel & Duration</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: surf, border: `1px solid ${border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>📅 Check-In Date</label>
            <input
              type="date"
              value={checkInDate}
              onChange={e => onCheckInDateChange && onCheckInDateChange(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
                background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>🌙 Duration (Nights)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={nights}
              onChange={e => onNightsChange && onNightsChange(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
                background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
              }}
            />
          </div>
        </div>

        {checkOutStr && (
          <div style={{ fontSize: 11, color: A.blue, fontWeight: 600 }}>
            Calculated Check-Out Date: {checkOutStr}
          </div>
        )}
      </div>

      {hotels.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hotels.map((h, idx) => {
            const isSelected = selectedHotel?.id === h.id;
            const cardId = h.id;
            const isExpanded = !!expandedCards[cardId];
            return (
              <div key={idx} style={{
                display: 'flex', flexDirection: 'column',
                padding: '14px 18px', borderRadius: 16,
                background: isSelected ? (dark ? 'rgba(0,113,227,0.1)' : 'rgba(0,113,227,0.04)') : card,
                border: isSelected ? `2px solid ${A.blue}` : `1px solid ${border}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => onSelectHotel(isSelected ? null : h)}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = A.blue; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: sub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{h.city}</span>
                      <span>•</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{h.id}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: text }}>
                      €{((h.price * (nights || 1)) / 100).toFixed(2)}
                      <span style={{ fontSize: 10, color: sub, fontWeight: 500 }}> (€{(h.price / 100).toFixed(2)}/night)</span>
                    </span>
                    {onToggleExpand && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(cardId, h.id);
                        }}
                        style={{
                          background: 'transparent', color: A.blue, border: `1px solid ${border}`, borderRadius: 980,
                          padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        {isExpanded ? "Hide Reviews" : "Show Reviews"}
                      </button>
                    )}
                    <div onClick={() => onSelectHotel(isSelected ? null : h)} style={{ display: 'flex', alignItems: 'center' }}>
                      {isSelected ? (
                        <Check size={16} color="#ffffff" style={{ background: A.blue, borderRadius: '50%', padding: 2 }} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sub}` }} />
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded && renderReviewsSection && renderReviewsSection(h.id)}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 16, background: surf, borderRadius: 12, border: `1px dashed ${border}`, color: sub, fontSize: 13, textAlign: 'center' }}>
          No accommodation options found.
        </div>
      )}
    </div>
  );
}
