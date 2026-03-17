import React from 'react';
import { Plane, ArrowRight, Check } from 'lucide-react';

export default function FlightSection({
  title = "Step 1: Select Outbound Flight & Date",
  flights = [],
  selectedFlight = null,
  onSelectFlight,
  dateLabel = "📅 Departure Date",
  dateValue = "",
  onDateChange,
  expandedCards = {},
  onToggleExpand,
  renderReviewsSection,
  dark,
  tokens
}) {
  const { A, border, surf, card, text, sub } = tokens;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: text, letterSpacing: '-0.1px' }}>
        <Plane size={14} color={A.blue} />
        <span>{title}</span>
      </div>

      {dateValue !== undefined && onDateChange && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 14, background: surf, border: `1px solid ${border}` }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>{dateLabel}</label>
          <input
            type="date"
            value={dateValue}
            onChange={e => onDateChange(e.target.value)}
            style={{
              padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
              background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
            }}
          />
        </div>
      )}

      {flights.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {flights.map((f, idx) => {
            const isSelected = selectedFlight?.id === f.id;
            const cardId = f.id;
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
              onClick={() => onSelectFlight(isSelected ? null : f)}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = A.blue; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: sub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{f.origin}</span>
                      <ArrowRight size={10} />
                      <span>{f.destination}</span>
                      <span>•</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{f.id}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: text }}>€{(f.price / 100).toFixed(2)}</span>
                    {onToggleExpand && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpand(cardId, f.id);
                        }}
                        style={{
                          background: 'transparent', color: A.blue, border: `1px solid ${border}`, borderRadius: 980,
                          padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        {isExpanded ? "Hide Reviews" : "Show Reviews"}
                      </button>
                    )}
                    <div onClick={() => onSelectFlight(isSelected ? null : f)} style={{ display: 'flex', alignItems: 'center' }}>
                      {isSelected ? (
                        <Check size={16} color="#ffffff" style={{ background: A.blue, borderRadius: '50%', padding: 2 }} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sub}` }} />
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded && renderReviewsSection && renderReviewsSection(f.id)}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: 16, background: surf, borderRadius: 12, border: `1px dashed ${border}`, color: sub, fontSize: 13, textAlign: 'center' }}>
          No flights available for this section.
        </div>
      )}
    </div>
  );
}
