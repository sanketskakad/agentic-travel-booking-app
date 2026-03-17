import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Sun, Moon, Plus, MessageSquare,
  Plane, Hotel, Activity, Compass,
  Globe, Menu, X, Check, Calendar, User, ArrowRight
} from 'lucide-react';
import FlightSection from './components/FlightSection';
import HotelSection from './components/HotelSection';
import ActivitySection from './components/ActivitySection';
import SummaryModal from './components/SummaryModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.port === '5173' ? '' : window.location.origin);

/* ── Exact design system tokens ──────────────────────────────────────────── */
const A = {
  blue:        '#0071e3',
  blueHover:   '#0066cc',
  blueLight:   '#2997ff',
  black:       '#000000',
  white:       '#ffffff',
  ink:         '#1d1d1f',
  gray:        '#6e6e73',
  midGray:     '#86868b',
  lightBg:     '#f2f2f7', // System sidebar/background light gray
  darkBg:      '#1c1c1e',
  cardDark:    '#272729',
  borderLight: 'rgba(0,0,0,0.08)',
  borderDark:  'rgba(255,255,255,0.08)',
};

/* ── Helper to parse structured travel responses ────────────────────────── */
function parseTravelResponse(msg) {
  if (msg && typeof msg === 'object') {
    if (msg.flights || msg.returnFlights || msg.hotels || msg.activities) {
      return {
        flights: msg.flights || [],
        returnFlights: msg.returnFlights || [],
        hotels: msg.hotels || [],
        activities: msg.activities || []
      };
    }
  }
  
  const text = typeof msg === 'string' ? msg : (msg?.content || '');
  if (!text) return { flights: [], returnFlights: [], hotels: [], activities: [] };
  const lines = text.split('\n');
  const result = { flights: [], returnFlights: [], hotels: [], activities: [] };
  let currentSection = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().includes('flights found:')) {
      currentSection = 'flights';
      continue;
    } else if (trimmed.toLowerCase().includes('return flights found:')) {
      currentSection = 'returnFlights';
      continue;
    } else if (trimmed.toLowerCase().includes('hotels found:')) {
      currentSection = 'hotels';
      continue;
    } else if (trimmed.toLowerCase().includes('activities found:')) {
      currentSection = 'activities';
      continue;
    }

    if (trimmed.startsWith('-')) {
      if (currentSection === 'flights') {
        const match = trimmed.match(/^-\s*(.*?)\s*\((.*?)\):\s*(.*?)\s*->\s*(.*?),\s*Price:\s*(\d+)/i);
        if (match) {
          result.flights.push({
            name: match[1],
            id: match[2],
            origin: match[3],
            destination: match[4],
            price: parseInt(match[5])
          });
        }
      } else if (currentSection === 'returnFlights') {
        const match = trimmed.match(/^-\s*(.*?)\s*\((.*?)\):\s*(.*?)\s*->\s*(.*?),\s*Price:\s*(\d+)/i);
        if (match) {
          result.returnFlights.push({
            name: match[1],
            id: match[2],
            origin: match[3],
            destination: match[4],
            price: parseInt(match[5])
          });
        }
      } else if (currentSection === 'hotels') {
        const match = trimmed.match(/^-\s*(.*?)\s*\((.*?)\)\s*in\s*(.*?),\s*Price:\s*(\d+)/i);
        if (match) {
          result.hotels.push({
            name: match[1],
            id: match[2],
            city: match[3],
            price: parseInt(match[4])
          });
        }
      } else if (currentSection === 'activities') {
        const match = trimmed.match(/^-\s*(.*?)\s*\((.*?)\):\s*(.*?),\s*Price:\s*(\d+)/i);
        if (match) {
          result.activities.push({
            name: match[1],
            id: match[2],
            description: match[3],
            price: parseInt(match[4])
          });
        }
      }
    }
  }
  return result;
}

function markdownToHtml(md, dark) {
  if (!md) return '';
  
  // Normalize newlines to prevent parsing discrepancies across OS platforms
  let html = md
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
    
  // Escape HTML tags to prevent injections
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
     
  // Setext Headers (underlined with === or ---)
  html = html.replace(/^([^\n]+)\n={3,}\s*$/gm, '<h2 style="margin: 18px 0 10px; font-weight: 700; font-size: 19px; color: inherit;">$1</h2>');
  html = html.replace(/^([^\n]+)\n-{3,}\s*$/gm, `<h3 style="margin: 16px 0 8px; font-weight: 700; font-size: 17px; border-bottom: 1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; padding-bottom: 4px; color: inherit;">$1</h3>`);
  
  // Atx Headers (# to ###)
  html = html.replace(/^###\s+(.*?)$/gm, '<h4 style="margin: 12px 0 6px; font-weight: 700; font-size: 15px; color: inherit;">$1</h4>');
  html = html.replace(/^##\s+(.*?)$/gm, `<h3 style="margin: 14px 0 8px; font-weight: 700; font-size: 17px; border-bottom: 1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; padding-bottom: 4px; color: inherit;">$1</h3>`);
  html = html.replace(/^#\s+(.*?)$/gm, '<h2 style="margin: 16px 0 10px; font-weight: 700; font-size: 19px; color: inherit;">$1</h2>');
  
  // Dividers
  html = html.replace(/^---$/gm, `<hr style="border: none; border-top: 1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}; margin: 14px 0;" />`);
  
  // Lists with bullet characters (*, -, +)
  html = html.replace(/^(\s*)[*+-]\s+(.*?)$/gm, (match, spaces, content) => {
    const indent = spaces.length * 12 + 8;
    return `<div style="padding-left: ${indent}px; margin-bottom: 4px; display: flex; align-items: flex-start; gap: 6px; line-height: 1.55;"><span style="color: #0071e3; font-weight: 700;">•</span><span>${content}</span></div>`;
  });
  
  // Lists with numbers
  html = html.replace(/^(\s*)(\d+)\.\s+(.*?)$/gm, (match, spaces, num, content) => {
    const indent = spaces.length * 12 + 8;
    return `<div style="padding-left: ${indent}px; margin-bottom: 4px; display: flex; align-items: flex-start; gap: 6px; line-height: 1.55;"><span style="font-weight: 700; color: #0071e3;">${num}.</span><span>${content}</span></div>`;
  });
  
  // Bold blocks
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>');
  
  // Inline code tags
  const codeBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const codeColor = dark ? '#2997ff' : '#0071e3';
  html = html.replace(/`(.*?)`/g, `<code style="font-family: monospace; background: ${codeBg}; color: ${codeColor}; padding: 2px 5px; border-radius: 4px; font-size: 90%;">$1</code>`);
  
  // Multiline linebreaks
  html = html.replace(/\n/g, '<br />');
  
  // Trim redundant linebreaks after closing block elements
  html = html.replace(/(<\/h2>|<\/h3>|<\/h4>|<\/hr>|<\/div>)\s*<br \/>/g, '$1');
  
  return html;
}

function App() {
  /* ── State ──────────────────────────────────────────────────────────── */
  const [dark, setDark] = useState(() => {
    const s = localStorage.getItem('sys-theme');
    return s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-open');
    return saved !== null ? saved === 'true' : true;
  });
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('conversations');
    return saved ? JSON.parse(saved) : [
      { id: 'default', title: 'New Conversation', messages: [] }
    ];
  });
  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem('active-chat-id');
    return saved || 'default';
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('checking'); // 'checking' | 'online' | 'offline'

  // Expanded cards & reviews cache
  const [expandedCards, setExpandedCards] = useState({}); // { [cardId]: boolean }
  const [reviewsCache, setReviewsCache] = useState({}); // { [itemId]: [reviews] }
  const [reviewsLoading, setReviewsLoading] = useState({}); // { [itemId]: boolean }

  // Option selection and booking state
  const [selections, setSelections] = useState(() => {
    const saved = localStorage.getItem('selections');
    return saved ? JSON.parse(saved) : {};
  });
  const [bookingNames, setBookingNames] = useState(() => {
    const saved = localStorage.getItem('booking-names');
    return saved ? JSON.parse(saved) : {};
  });
  const [bookingSteps, setBookingSteps] = useState(() => {
    const saved = localStorage.getItem('booking-steps');
    return saved ? JSON.parse(saved) : {};
  });
  const [bookedMessages, setBookedMessages] = useState(() => {
    const saved = localStorage.getItem('booked-messages');
    return saved ? JSON.parse(saved) : {};
  });

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Theme ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('sys-theme', dark ? 'dark' : 'light');
  }, [dark]);

  /* ── State Persistence ──────────────────────────────────────────────── */
  useEffect(() => {
    localStorage.setItem('sidebar-open', sidebarOpen ? 'true' : 'false');
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('active-chat-id', activeId);
  }, [activeId]);

  useEffect(() => {
    localStorage.setItem('selections', JSON.stringify(selections));
  }, [selections]);

  useEffect(() => {
    localStorage.setItem('booking-names', JSON.stringify(bookingNames));
  }, [bookingNames]);

  useEffect(() => {
    localStorage.setItem('booking-steps', JSON.stringify(bookingSteps));
  }, [bookingSteps]);

  useEffect(() => {
    localStorage.setItem('booked-messages', JSON.stringify(bookedMessages));
  }, [bookedMessages]);

  /* ── Health polling ─────────────────────────────────────────────────── */
  useEffect(() => {
    const ping = async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/health`);
        setStatus(r.ok ? 'online' : 'offline');
      } catch { setStatus('offline'); }
    };
    ping();
    const id = setInterval(ping, 8000);
    return () => clearInterval(id);
  }, []);

  /* ── Auto scroll ────────────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, loading]);

  const activeChat = conversations.find(c => c.id === activeId) || conversations[0];

  useEffect(() => {
    if (activeChat && activeChat.id !== activeId) {
      setActiveId(activeChat.id);
    }
  }, [activeChat, activeId]);

  /* ── Handlers ───────────────────────────────────────────────────────── */
  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', content: msg, ts };
    const title = activeChat.messages.length === 0
      ? (msg.length > 28 ? msg.slice(0, 26) + '…' : msg)
      : activeChat.title;

    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, title, messages: [...c.messages, userMsg] } : c
    ));
    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/travelplan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: msg })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const depDate = data.departure_date && data.departure_date !== 'Not specified' ? data.departure_date : '';
      const retDate = data.return_date && data.return_date !== 'Not specified' ? data.return_date : '';
      
      const botMsg = {
        role: 'assistant',
        content: data.response,
        flights: data.flights || [],
        returnFlights: data.return_flights || [],
        hotels: data.hotels || [],
        activities: data.activities || [],
        departureDate: depDate,
        returnDate: retDate,
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const currentChat = conversations.find(c => c.id === activeId);
      const msgIndex = currentChat ? currentChat.messages.length + 1 : 1;

      // Calculate duration in nights between dates
      let initialNights = 1;
      if (depDate && retDate) {
        const t1 = new Date(depDate).getTime();
        const t2 = new Date(retDate).getTime();
        if (!isNaN(t1) && !isNaN(t2)) {
          const diff = t2 - t1;
          const calculated = Math.round(diff / (1000 * 60 * 60 * 24));
          initialNights = calculated > 0 ? calculated : 1;
        }
      }

      setSelections(sPrev => ({
        ...sPrev,
        [msgIndex]: {
          flight: null,
          returnFlight: null,
          hotel: null,
          activities: [],
          departureDate: depDate,
          returnDate: retDate,
          checkInDate: depDate,
          nights: initialNights
        }
      }));

      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: [...c.messages, botMsg] } : c
      ));
    } catch (e) {
      const errMsg = { role: 'assistant', content: `Unable to reach the travel API. (${e.message})`, isError: true, ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setConversations(prev => prev.map(c =>
        c.id === activeId ? { ...c, messages: [...c.messages, errMsg] } : c
      ));
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    const id = `chat_${Date.now()}`;
    setConversations(prev => [{ id, title: 'New Conversation', messages: [] }, ...prev]);
    setActiveId(id);
  };

  const fetchReviews = async (itemId) => {
    if (reviewsCache[itemId] || reviewsLoading[itemId]) return;
    setReviewsLoading(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch(`${BACKEND_URL}/api/reviews/${itemId}`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      setReviewsCache(prev => ({ ...prev, [itemId]: data.reviews }));
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setReviewsLoading(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const renderReviewsSection = (itemId) => {
    const reviews = reviewsCache[itemId];
    const isLoading = reviewsLoading[itemId];
    
    if (isLoading) {
      return (
        <div style={{ padding: '12px 0 4px', fontSize: 12, color: A.gray, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11 }}>Loading reviews…</span>
        </div>
      );
    }
    
    if (!reviews) return null;
    if (reviews.length === 0) {
      return <div style={{ padding: '12px 0 4px', fontSize: 12, color: A.gray }}>No reviews available for this item.</div>;
    }
    
    const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
    
    return (
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10, borderTop: `1px solid ${border}`, paddingTop: 12 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: text }}>
          <span>Rating: {avgRating} / 5.0</span>
          <span style={{ color: '#ffd60a' }}>{'★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating))}</span>
          <span>({reviews.length} reviews)</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
          {reviews.map((r, rIdx) => (
            <div key={rIdx} style={{ padding: 10, borderRadius: 10, background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: text }}>
                <span>{r.reviewer}</span>
                <span style={{ color: sub }}>{r.date}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 11, color: '#ffd60a', margin: '4px 0' }}>
                <span>{'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</span>
                {r.aspects && Object.entries(r.aspects).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: sub, textTransform: 'capitalize' }}>
                    {k}: {v}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 12, color: sub, margin: '6px 0 0', lineHeight: 1.45 }}>{r.comment}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleGroupBook = async (i) => {
    const guestName = (bookingNames?.[i] || '').trim();
    if (!guestName) {
      alert("Please enter a guest name before confirming booking.");
      return;
    }
    
    const activeChat = conversations.find(c => c.id === activeId) || conversations[0];
    const msg = activeChat.messages[i] || {};
    const selection = selections[i] || {};

    const depDateDefault = msg.departureDate || '';
    const retDateDefault = msg.returnDate || '';
    
    let initialNightsDefault = 1;
    if (depDateDefault && retDateDefault) {
      const t1 = new Date(depDateDefault).getTime();
      const t2 = new Date(retDateDefault).getTime();
      if (!isNaN(t1) && !isNaN(t2)) {
        const diff = t2 - t1;
        const calculated = Math.round(diff / (1000 * 60 * 60 * 24));
        initialNightsDefault = calculated > 0 ? calculated : 1;
      }
    }

    const departureDate = selection.departureDate !== undefined ? selection.departureDate : depDateDefault;
    const returnDate = selection.returnDate !== undefined ? selection.returnDate : retDateDefault;
    const checkInDate = selection.checkInDate !== undefined ? selection.checkInDate : depDateDefault;
    const nights = selection.nights !== undefined ? selection.nights : initialNightsDefault;

    const itemsToBook = [];
    if (selection.flight) itemsToBook.push({ ...selection.flight, type: 'flight' });
    if (selection.returnFlight) itemsToBook.push({ ...selection.returnFlight, type: 'return flight' });
    if (selection.hotel) itemsToBook.push({ ...selection.hotel, type: 'hotel' });
    if (selection.activities && selection.activities.length > 0) {
      selection.activities.forEach(act => {
        itemsToBook.push({ ...act, type: 'activity' });
      });
    }
    
    if (itemsToBook.length === 0) {
      alert("Please select at least one item to book.");
      return;
    }
    
    setLoading(true);
    const results = [];
    
    for (const item of itemsToBook) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: guestName,
            itemId: item.id
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        results.push({ item, booking: data });
      } catch (err) {
        results.push({ item, error: err.message });
      }
    }
    
    setSelections(prev => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setBookingNames(prev => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setBookingSteps(prev => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setBookedMessages(prev => ({ ...prev, [i]: true }));
    
    const summaryItems = results
      .filter(res => !res.error)
      .map(res => {
        let details = "";
        if (res.item.type === 'flight') {
          details = `${res.item.origin} to ${res.item.destination} departing on ${departureDate}`;
        } else if (res.item.type === 'return flight') {
          details = `${res.item.origin} to ${res.item.destination} returning on ${returnDate}`;
        } else if (res.item.type === 'hotel') {
          let checkOutStr = "";
          if (checkInDate) {
            const outDate = new Date(checkInDate);
            outDate.setDate(outDate.getDate() + nights);
            if (!isNaN(outDate.getTime())) {
              checkOutStr = outDate.toISOString().split('T')[0];
            }
          }
          details = `in ${res.item.city}, Check-In: ${checkInDate}, Check-Out: ${checkOutStr} (${nights} nights)`;
        } else if (res.item.type === 'activity') {
          details = `${res.item.description} (Suggested Date: during stay starting ${departureDate})`;
        }
        return {
          id: res.item.id,
          name: res.item.name,
          type: res.item.type,
          price: res.item.price,
          details: `Booking ID: ${res.booking.bookingId}. ${details}`
        };
      });
      
    let summaryText = "";
    try {
      const summaryRes = await fetch(`${BACKEND_URL}/api/generatesummary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName,
          items: summaryItems
        })
      });
      if (!summaryRes.ok) throw new Error("Failed to generate summary");
      const summaryData = await summaryRes.json();
      summaryText = summaryData.summary;
    } catch (err) {
      summaryText = `### 🎉 Travel Booking Confirmation\n\n**Guest Name:** ${guestName}\n\n`;
      summaryText += `Here is your detailed itinerary and booking summary:\n\n`;
      let totalCost = 0;
      for (const res of results) {
        if (res.error) {
          summaryText += `❌ **Failed to book ${res.item.name}:** ${res.error}\n\n`;
        } else {
          const b = res.booking;
          const item = res.item;
          totalCost += item.price;
          summaryText += `- **${item.type.toUpperCase()}:** ${item.name} (${item.id}) - Booking ID: \`${b.bookingId}\` (Price: €${(item.price / 100).toFixed(2)})\n`;
        }
      }
      summaryText += `\nTotal Cost: €${(totalCost / 100).toFixed(2)}`;
    }
    
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const botMsg = { role: 'assistant', content: summaryText, ts };
    
    setConversations(prev => prev.map(c =>
      c.id === activeId ? { ...c, messages: [...c.messages, botMsg] } : c
    ));
    
    setLoading(false);
  };

  const PROMPTS = [
    { icon: Plane,    text: 'Find flights from Berlin to Rotterdam departing on 2026-08-15 and returning on 2026-08-22, hotels in Rotterdam, and local activities.' },
    { icon: Compass,  text: 'Plan a trip from Frankfurt to Paris with outbound flight on 2026-09-01, return flight on 2026-09-10, and a 4-star hotel.' },
  ];

  /* ── Palette helpers ────────────────────────────────────────────────── */
  const bg     = dark ? A.black   : A.white;
  const surf   = dark ? A.darkBg  : A.lightBg;
  const card   = dark ? A.cardDark : A.white;
  const border = dark ? A.borderDark : A.borderLight;
  const text   = dark ? A.white   : A.ink;
  const sub    = A.gray;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: bg, color: text, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <aside className="animate-fade-in" style={{
          width: 280,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: surf,
          borderRight: `1px solid ${border}`,
          overflow: 'hidden',
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* Sidebar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: A.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 8px ${A.blue}44` }}>
                <Globe size={15} color="#fff" />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px', color: text }}>EuroTrip Planner</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: sub, marginLeft: 'auto' }}>
              <X size={16} />
            </button>
          </div>

          {/* New Chat */}
          <div style={{ padding: '16px 16px 10px' }}>
            <button
              onClick={newChat}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                background: A.blue, color: '#fff', border: 'none', borderRadius: 980,
                padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: `0 4px 12px ${A.blue}33`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = A.blueHover;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = A.blue;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={15} /> New Conversation
            </button>
          </div>

          {/* Conversation list */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: sub, padding: '12px 10px 8px' }}>Recent Trips</div>
            {conversations.map(chat => {
              const isActive = chat.id === activeId;
              return (
                <button
                  key={chat.id}
                  onClick={() => setActiveId(chat.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: isActive ? (dark ? A.cardDark : 'rgba(0,0,0,0.05)') : 'transparent',
                    color: isActive ? text : sub,
                    fontSize: 13, fontWeight: isActive ? 600 : 500,
                    marginBottom: 4, transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <MessageSquare size={15} style={{ flexShrink: 0, opacity: isActive ? 0.9 : 0.5 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{chat.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Theme switcher */}
          <div style={{ padding: '12px 16px 20px', borderTop: `1px solid ${border}` }}>
            <button
              onClick={() => setDark(d => !d)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderRadius: 980, border: `1px solid ${border}`,
                background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: text,
                justifyContent: 'space-between',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = border}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {dark
                  ? <Sun size={15} color="#ffd60a" />
                  : <Moon size={15} color={sub} />
                }
                {dark ? 'Light Mode' : 'Dark Mode'}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: sub }}>Switch</span>
            </button>
          </div>
        </aside>
      )}

      {/* ── MAIN AREA ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <header style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', borderBottom: `1px solid ${border}`, flexShrink: 0,
          background: bg, backdropFilter: 'blur(20px)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Menu size={20} />
              </button>
            )}
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.2px', color: text }}>Workspace</span>
          </div>

          {/* Status indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 980,
            border: `1px solid ${status === 'online' ? '#34c759' : status === 'offline' ? '#ff3b30' : border}`,
            background: status === 'online'
              ? (dark ? 'rgba(52,199,89,0.1)' : '#f0fdf4')
              : status === 'offline'
                ? (dark ? 'rgba(255,59,48,0.1)' : '#fff5f5')
                : (dark ? A.darkBg : A.lightBg),
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: status === 'online' ? '#34c759' : status === 'offline' ? '#ff3b30' : A.gray,
              ...(status !== 'offline' && { animation: 'pulse 1.8s infinite' }),
            }} />
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.01em',
              color: status === 'online' ? '#34c759' : status === 'offline' ? '#ff3b30' : A.gray,
            }}>
              {status === 'online' ? 'API CONNECTED' : status === 'offline' ? 'API DISCONNECTED' : 'CHECKING STATUS…'}
            </span>
          </div>
        </header>

        {/* Message area */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '36px 24px', background: bg }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>

            {/* Empty state */}
            {activeChat.messages.length === 0 && (
              <div className="animate-slide-in" style={{ textAlign: 'center', paddingTop: 64 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: 20,
                  background: A.blue, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px', boxShadow: `0 8px 24px ${A.blue}33`
                }}>
                  <Globe size={28} color="#fff" />
                </div>
                <h2 style={{ fontSize: 32, fontWeight: 700, color: text, margin: '0 0 12px', letterSpacing: '-0.6px' }}>
                  EuroTrip Planner AI
                </h2>
                <p style={{ fontSize: 16, color: sub, margin: '0 0 42px', lineHeight: 1.6, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                  Your personal travel assistant specialized in European journeys. Query round-trip flights, search top accommodations, find tours, and book your trip.
                </p>

                {/* Suggestions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {PROMPTS.map((p, i) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => send(p.text)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '16px 20px', borderRadius: 18,
                          border: `1px solid ${border}`, background: card,
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = A.blue;
                          e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)';
                          e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.04)`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = border;
                          e.currentTarget.style.transform = 'translateY(0) scale(1)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: surf, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={16} color={A.blue} />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: text, lineHeight: 1.4 }}>{p.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {activeChat.messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const parsed = !isUser ? parseTravelResponse(msg) : null;
                const originallyHasResults = parsed && (parsed.flights.length > 0 || parsed.returnFlights.length > 0 || parsed.hotels.length > 0 || parsed.activities.length > 0);
                const isBooked = !!bookedMessages?.[i];
                const hasResults = originallyHasResults && !isBooked;

                return (
                  <div key={i} className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: sub, paddingLeft: 4, paddingRight: 4 }}>
                      {isUser ? <User size={10} /> : <Compass size={10} />}
                      <span>{isUser ? 'You' : 'Travel Agent'}</span>
                      <span>•</span>
                      <span>{msg.ts}</span>
                    </div>

                    {isUser ? (
                      <div style={{
                        maxWidth: '85%',
                        padding: '12px 18px',
                        borderRadius: '20px 20px 4px 20px',
                        fontSize: 14, lineHeight: 1.65,
                        background: A.blue,
                        color: '#ffffff',
                        border: `1px solid ${border}`,
                        boxShadow: `0 4px 12px ${A.blue}22`,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {msg.content}
                      </div>
                    ) : !originallyHasResults ? (
                      <div style={{
                        maxWidth: '85%',
                        padding: '12px 18px',
                        borderRadius: '20px 20px 20px 4px',
                        fontSize: 14, lineHeight: 1.65,
                        background: msg.isError
                          ? (dark ? 'rgba(255,59,48,0.12)' : '#fff1f0')
                          : (dark ? A.cardDark : A.lightBg),
                        color: msg.isError
                          ? '#ff3b30'
                          : text,
                        border: msg.isError ? `1px solid rgba(255,59,48,0.25)` : `1px solid ${border}`,
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                      }}
                      dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content, dark) }}
                      />
                    ) : null}

                    {/* Interactive Options Section */}
                    {hasResults && (() => {
                      const currentStep = bookingSteps?.[i] || 1;
                      
                      const depDateDefault = msg.departureDate || '';
                      const retDateDefault = msg.returnDate || '';
                      
                      let initialNightsDefault = 1;
                      if (depDateDefault && retDateDefault) {
                        const t1 = new Date(depDateDefault).getTime();
                        const t2 = new Date(retDateDefault).getTime();
                        if (!isNaN(t1) && !isNaN(t2)) {
                          const diff = t2 - t1;
                          const calculated = Math.round(diff / (1000 * 60 * 60 * 24));
                          initialNightsDefault = calculated > 0 ? calculated : 1;
                        }
                      }

                      const currentDepartureDate = selections[i]?.departureDate !== undefined ? selections[i]?.departureDate : depDateDefault;
                      const currentReturnDate = selections[i]?.returnDate !== undefined ? selections[i]?.returnDate : retDateDefault;
                      const currentCheckInDate = selections[i]?.checkInDate !== undefined ? selections[i]?.checkInDate : depDateDefault;
                      const currentNights = selections[i]?.nights !== undefined ? selections[i]?.nights : initialNightsDefault;

                      const steps = [
                        { num: 1, label: 'Departure' },
                        { num: 2, label: 'Hotel' },
                        { num: 3, label: 'Activities' },
                        { num: 4, label: 'Return' },
                        { num: 5, label: 'Summary' }
                      ];

                      return (
                        <div className="animate-scale-in" style={{ width: '100%', maxWidth: 640, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
                          
                          {/* Step Progress Tracker */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: surf, padding: '12px 16px', borderRadius: 16, border: `1px solid ${border}` }}>
                            {steps.map((st, sIdx) => {
                              const isActive = currentStep === st.num;
                              const isDone = currentStep > st.num;
                              return (
                                <React.Fragment key={st.num}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                                    <div style={{
                                      width: 22, height: 22, borderRadius: '50%',
                                      background: isActive ? A.blue : isDone ? '#34c759' : border,
                                      color: isActive || isDone ? '#fff' : sub,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: 10, fontWeight: 700
                                    }}>
                                      {isDone ? '✓' : st.num}
                                    </div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? A.blue : sub, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{st.label}</span>
                                  </div>
                                  {sIdx < steps.length - 1 && (
                                    <div style={{ height: 2, flex: 0.5, background: currentStep > st.num ? '#34c759' : border, minWidth: 10 }} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>

                          {/* Step 1: Outbound Flight Selection */}
                          {currentStep === 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: text, letterSpacing: '-0.1px' }}>
                                <Plane size={14} color={A.blue} />
                                <span>Step 1: Select Outbound Flight & Date</span>
                              </div>

                              {/* Departure Date input shown at top */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 14, background: surf, border: `1px solid ${border}` }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>📅 Departure Date</label>
                                <input
                                  type="date"
                                  value={currentDepartureDate}
                                  onChange={e => setSelections(prev => {
                                    const nextDepDate = e.target.value;
                                    const current = prev[i] || {};
                                    // Also sync check-in date
                                    return {
                                      ...prev,
                                      [i]: { ...current, departureDate: nextDepDate, checkInDate: nextDepDate }
                                    };
                                  })}
                                  style={{
                                    padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
                                    background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
                                  }}
                                />
                              </div>

                              {parsed.flights.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {parsed.flights.map((f, idx) => {
                                    const isSelected = selections[i]?.flight?.id === f.id;
                                    const cardId = `${i}_${f.id}`;
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
                                      onClick={() => setSelections(prev => {
                                        const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                        return {
                                          ...prev,
                                          [i]: { ...current, flight: isSelected ? null : f }
                                        };
                                      })}
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
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const nextExpanded = !isExpanded;
                                                setExpandedCards(prev => ({ ...prev, [cardId]: nextExpanded }));
                                                if (nextExpanded) fetchReviews(f.id);
                                              }}
                                              style={{
                                                background: 'transparent', color: A.blue, border: `1px solid ${border}`, borderRadius: 980,
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                                              }}
                                            >
                                              {isExpanded ? "Hide Reviews" : "Show Reviews"}
                                            </button>
                                            <div onClick={() => setSelections(prev => {
                                              const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                              return {
                                                ...prev,
                                                [i]: { ...current, flight: isSelected ? null : f }
                                              };
                                            })} style={{ display: 'flex', alignItems: 'center' }}>
                                              {isSelected ? (
                                                <Check size={16} color="#ffffff" style={{ background: A.blue, borderRadius: '50%', padding: 2 }} />
                                              ) : (
                                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sub}` }} />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        {isExpanded && renderReviewsSection(f.id)}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ padding: 16, background: surf, borderRadius: 12, border: `1px dashed ${border}`, color: sub, fontSize: 13, textAlign: 'center' }}>
                                  No departure flights found for this destination.
                                </div>
                              )}

                              {/* Navigation Controls */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                <button
                                  disabled={parsed.flights.length > 0 && (!selections[i]?.flight || !currentDepartureDate)}
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 2 }))}
                                  style={{
                                    background: (parsed.flights.length > 0 && (!selections[i]?.flight || !currentDepartureDate)) ? border : A.blue,
                                    color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px',
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                    opacity: (parsed.flights.length > 0 && (!selections[i]?.flight || !currentDepartureDate)) ? 0.6 : 1
                                  }}
                                >
                                  Next: Choose Hotel ➔
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 2: Accommodation Selection */}
                          {currentStep === 2 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: text, letterSpacing: '-0.1px' }}>
                                <Hotel size={14} color={A.blue} />
                                <span>Step 2: Select Hotel & Duration</span>
                              </div>

                              {/* Hotel Booking Date & Duration input shown at top */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14, borderRadius: 14, background: surf, border: `1px solid ${border}` }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>📅 Check-In Date</label>
                                    <input
                                      type="date"
                                      value={currentCheckInDate}
                                      onChange={e => setSelections(prev => ({
                                        ...prev,
                                        [i]: { ...prev[i], checkInDate: e.target.value }
                                      }))}
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
                                      value={currentNights}
                                      onChange={e => setSelections(prev => ({
                                        ...prev,
                                        [i]: { ...prev[i], nights: Math.max(1, parseInt(e.target.value) || 1) }
                                      }))}
                                      style={{
                                        padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
                                        background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
                                      }}
                                    />
                                  </div>
                                </div>
                                
                                {(() => {
                                  const checkIn = currentCheckInDate;
                                  const nights = currentNights;
                                  if (checkIn) {
                                    const outDate = new Date(checkIn);
                                    outDate.setDate(outDate.getDate() + nights);
                                    if (!isNaN(outDate.getTime())) {
                                      const checkOutStr = outDate.toISOString().split('T')[0];
                                      return (
                                        <div style={{ fontSize: 12, fontWeight: 600, color: A.blue, textAlign: 'center', marginTop: 4 }}>
                                          Stay Dates: {checkIn} to {checkOutStr} ({nights} nights)
                                        </div>
                                      );
                                    }
                                  }
                                  return null;
                                })()}
                              </div>

                              {parsed.hotels.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {parsed.hotels.map((h, idx) => {
                                    const isSelected = selections[i]?.hotel?.id === h.id;
                                    const cardId = `${i}_${h.id}`;
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
                                      onClick={() => setSelections(prev => {
                                        const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                        return {
                                          ...prev,
                                          [i]: { ...current, hotel: isSelected ? null : h }
                                        };
                                      })}
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
                                            <span style={{ fontSize: 15, fontWeight: 700, color: text }}>€{(h.price / 100).toFixed(2)} <span style={{ fontSize: 10, fontWeight: 500, color: sub }}>/ night</span></span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const nextExpanded = !isExpanded;
                                                setExpandedCards(prev => ({ ...prev, [cardId]: nextExpanded }));
                                                if (nextExpanded) fetchReviews(h.id);
                                              }}
                                              style={{
                                                background: 'transparent', color: A.blue, border: `1px solid ${border}`, borderRadius: 980,
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                                              }}
                                            >
                                              {isExpanded ? "Hide Reviews" : "Show Reviews"}
                                            </button>
                                            <div onClick={() => setSelections(prev => {
                                              const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                              return {
                                                ...prev,
                                                [i]: { ...current, hotel: isSelected ? null : h }
                                              };
                                            })} style={{ display: 'flex', alignItems: 'center' }}>
                                              {isSelected ? (
                                                <Check size={16} color="#ffffff" style={{ background: A.blue, borderRadius: '50%', padding: 2 }} />
                                              ) : (
                                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sub}` }} />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        {isExpanded && renderReviewsSection(h.id)}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ padding: 16, background: surf, borderRadius: 12, border: `1px dashed ${border}`, color: sub, fontSize: 13, textAlign: 'center' }}>
                                  No accommodations found for this destination.
                                </div>
                              )}

                              {/* Navigation Controls */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <button
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 1 }))}
                                  style={{
                                    background: 'transparent', color: text, border: `1px solid ${border}`,
                                    borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  🎚 Back
                                </button>
                                <button
                                  disabled={parsed.hotels.length > 0 && !selections[i]?.hotel}
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 3 }))}
                                  style={{
                                    background: (parsed.hotels.length > 0 && !selections[i]?.hotel) ? border : A.blue,
                                    color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px',
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                    opacity: (parsed.hotels.length > 0 && !selections[i]?.hotel) ? 0.6 : 1
                                  }}
                                >
                                  Next: Choose Activities ➔
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 3: Activities Selection */}
                          {currentStep === 3 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: text, letterSpacing: '-0.1px' }}>
                                <Compass size={14} color={A.blue} />
                                <span>Step 3: Select Attractions & Activities</span>
                              </div>
                              {parsed.activities.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {parsed.activities.map((act, idx) => {
                                    const isSelected = (selections[i]?.activities || []).some(a => a.id === act.id);
                                    const cardId = `${i}_${act.id}`;
                                    const isExpanded = !!expandedCards[cardId];
                                    return (
                                      <div key={idx} style={{
                                        display: 'flex', flexDirection: 'column', gap: 8,
                                        padding: '14px 18px', borderRadius: 16,
                                        background: isSelected ? (dark ? 'rgba(0,113,227,0.1)' : 'rgba(0,113,227,0.04)') : card,
                                        border: isSelected ? `2px solid ${A.blue}` : `1px solid ${border}`,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                      }}
                                      onClick={() => setSelections(prev => {
                                        const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                        const currentActs = current.activities || [];
                                        const nextActs = isSelected 
                                          ? currentActs.filter(a => a.id !== act.id) 
                                          : [...currentActs, act];
                                        return {
                                          ...prev,
                                          [i]: { ...current, activities: nextActs }
                                        };
                                      })}
                                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = A.blue; }}
                                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                          <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{act.name}</div>
                                            <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: sub, marginTop: 2 }}>{act.id}</div>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => e.stopPropagation()}>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: text }}>€{(act.price / 100).toFixed(2)}</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const nextExpanded = !isExpanded;
                                                setExpandedCards(prev => ({ ...prev, [cardId]: nextExpanded }));
                                                if (nextExpanded) fetchReviews(act.id);
                                              }}
                                              style={{
                                                background: 'transparent', color: A.blue, border: `1px solid ${border}`, borderRadius: 980,
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                                              }}
                                            >
                                              {isExpanded ? "Hide Reviews" : "Show Reviews"}
                                            </button>
                                            <div onClick={() => setSelections(prev => {
                                              const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                              const currentActs = current.activities || [];
                                              const nextActs = isSelected 
                                                ? currentActs.filter(a => a.id !== act.id) 
                                                : [...currentActs, act];
                                              return {
                                                ...prev,
                                                [i]: { ...current, activities: nextActs }
                                              };
                                            })} style={{ display: 'flex', alignItems: 'center' }}>
                                              {isSelected ? (
                                                <Check size={16} color="#ffffff" style={{ background: A.blue, borderRadius: '50%', padding: 2 }} />
                                              ) : (
                                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sub}` }} />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: sub, lineHeight: 1.5, margin: 0 }}>{act.description}</p>
                                        {isExpanded && renderReviewsSection(act.id)}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ padding: 16, background: surf, borderRadius: 12, border: `1px dashed ${border}`, color: sub, fontSize: 13, textAlign: 'center' }}>
                                  No attractions or activities found for this destination.
                                </div>
                              )}

                              {/* Navigation Controls */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <button
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 2 }))}
                                  style={{
                                    background: 'transparent', color: text, border: `1px solid ${border}`,
                                    borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  🎚 Back
                                </button>
                                <button
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 4 }))}
                                  style={{
                                    background: A.blue, color: '#fff', border: 'none', borderRadius: 12,
                                    padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  Next: Choose Return Flight ➔
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 4: Return Flight Selection */}
                          {currentStep === 4 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: text, letterSpacing: '-0.1px' }}>
                                <Plane size={14} color={A.blue} />
                                <span>Step 4: Select Return Flight & Date</span>
                              </div>

                              {/* Return Date input */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 14, background: surf, border: `1px solid ${border}` }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>📅 Return Date</label>
                                <input
                                  type="date"
                                  value={currentReturnDate}
                                  onChange={e => setSelections(prev => ({
                                    ...prev,
                                    [i]: { ...prev[i], returnDate: e.target.value }
                                  }))}
                                  style={{
                                    padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
                                    background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
                                  }}
                                />
                              </div>

                              {parsed.returnFlights && parsed.returnFlights.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {parsed.returnFlights.map((rf, idx) => {
                                    const isSelected = selections[i]?.returnFlight?.id === rf.id;
                                    const cardId = `${i}_${rf.id}`;
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
                                      onClick={() => setSelections(prev => {
                                        const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                        return {
                                          ...prev,
                                          [i]: { ...current, returnFlight: isSelected ? null : rf }
                                        };
                                      })}
                                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = A.blue; }}
                                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                          <div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>{rf.name}</div>
                                            <div style={{ fontSize: 12, color: sub, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                              <span>{rf.origin}</span>
                                              <ArrowRight size={10} />
                                              <span>{rf.destination}</span>
                                              <span>•</span>
                                              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{rf.id}</span>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={e => e.stopPropagation()}>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: text }}>€{(rf.price / 100).toFixed(2)}</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const nextExpanded = !isExpanded;
                                                setExpandedCards(prev => ({ ...prev, [cardId]: nextExpanded }));
                                                if (nextExpanded) fetchReviews(rf.id);
                                              }}
                                              style={{
                                                background: 'transparent', color: A.blue, border: `1px solid ${border}`, borderRadius: 980,
                                                padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                                              }}
                                            >
                                              {isExpanded ? "Hide Reviews" : "Show Reviews"}
                                            </button>
                                            <div onClick={() => setSelections(prev => {
                                              const current = prev[i] || { flight: null, returnFlight: null, hotel: null, activities: [] };
                                              return {
                                                ...prev,
                                                [i]: { ...current, returnFlight: isSelected ? null : rf }
                                              };
                                            })} style={{ display: 'flex', alignItems: 'center' }}>
                                              {isSelected ? (
                                                <Check size={16} color="#ffffff" style={{ background: A.blue, borderRadius: '50%', padding: 2 }} />
                                              ) : (
                                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${sub}` }} />
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        {isExpanded && renderReviewsSection(rf.id)}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ padding: 16, background: surf, borderRadius: 12, border: `1px dashed ${border}`, color: sub, fontSize: 13, textAlign: 'center' }}>
                                  No return flights found for this destination.
                                </div>
                              )}

                              {/* Navigation Controls */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <button
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 3 }))}
                                  style={{
                                    background: 'transparent', color: text, border: `1px solid ${border}`,
                                    borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  🎚 Back
                                </button>
                                <button
                                  disabled={(parsed.returnFlights && parsed.returnFlights.length > 0) && (!selections[i]?.returnFlight || !currentReturnDate)}
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 5 }))}
                                  style={{
                                    background: ((parsed.returnFlights && parsed.returnFlights.length > 0) && (!selections[i]?.returnFlight || !currentReturnDate)) ? border : A.blue,
                                    color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px',
                                    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                    opacity: ((parsed.returnFlights && parsed.returnFlights.length > 0) && (!selections[i]?.returnFlight || !currentReturnDate)) ? 0.6 : 1
                                  }}
                                >
                                  Next: Review Itinerary ➔
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Step 5: Booking Confirmation Summary */}
                          {currentStep === 5 && (
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
                                {selections[i]?.flight && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontWeight: 600 }}>
                                      <span>✈️ Outbound Flight: {selections[i]?.flight?.name}</span>
                                      <span>€{(selections[i]?.flight?.price / 100).toFixed(2)}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: sub }}>Departure: {currentDepartureDate} • {selections[i]?.flight?.origin} to {selections[i]?.flight?.destination}</span>
                                  </div>
                                )}
                                {selections[i]?.hotel && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontWeight: 600 }}>
                                      <span>🏨 Accommodation: {selections[i]?.hotel?.name}</span>
                                      <span>€{((selections[i]?.hotel?.price * currentNights) / 100).toFixed(2)}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: sub }}>Check-in: {currentCheckInDate} • Duration: {currentNights} nights (€{(selections[i]?.hotel?.price / 100).toFixed(2)} / night)</span>
                                  </div>
                                )}
                                {selections[i]?.activities && selections[i]?.activities?.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
                                    <span style={{ color: text, fontWeight: 600 }}>🎟️ Selected Attractions:</span>
                                    {selections[i]?.activities?.map((act, actIdx) => (
                                      <div key={actIdx} style={{ display: 'flex', justifyContent: 'space-between', color: sub, paddingLeft: 8 }}>
                                        <span>• {act.name}</span>
                                        <span style={{ fontWeight: 600, color: text }}>€{(act.price / 100).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {selections[i]?.returnFlight && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${border}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: text, fontWeight: 600 }}>
                                      <span>✈️ Return Flight: {selections[i]?.returnFlight?.name}</span>
                                      <span>€{(selections[i]?.returnFlight?.price / 100).toFixed(2)}</span>
                                    </div>
                                    <span style={{ fontSize: 11, color: sub }}>Departure: {currentReturnDate} • {selections[i]?.returnFlight?.origin} to {selections[i]?.returnFlight?.destination}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                                  <span>Total Itinerary Price</span>
                                  <span style={{ color: A.blue }}>
                                    €{(
                                      ((selections[i]?.flight?.price || 0) + 
                                       (selections[i]?.returnFlight?.price || 0) + 
                                       ((selections[i]?.hotel?.price || 0) * currentNights) + 
                                       (selections[i]?.activities || []).reduce((sum, act) => sum + act.price, 0)) / 100
                                    ).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Embedded Guest Form */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: 'uppercase' }}>Guest Full Name</label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                  <input
                                    required
                                    type="text"
                                    value={bookingNames?.[i] || ''}
                                    onChange={e => setBookingNames(prev => ({ ...prev, [i]: e.target.value }))}
                                    placeholder="e.g. John Doe"
                                    style={{
                                      flex: 1, padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`,
                                      background: dark ? A.cardDark : '#fff', color: text, fontSize: 13, outline: 'none'
                                    }}
                                  />
                                  <button
                                    onClick={() => handleGroupBook(i)}
                                    disabled={loading || !(bookingNames?.[i] || '').trim()}
                                    style={{
                                      background: A.blue, color: '#fff', border: 'none', borderRadius: 12,
                                      padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                      opacity: !(bookingNames?.[i] || '').trim() ? 0.6 : 1, transition: 'all 0.2s',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={e => { if (!loading && (bookingNames?.[i] || '').trim()) e.currentTarget.style.background = A.blueHover; }}
                                    onMouseLeave={e => { if (!loading && (bookingNames?.[i] || '').trim()) e.currentTarget.style.background = A.blue; }}
                                  >
                                    Book Selected Trip
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <button
                                  onClick={() => setBookingSteps(prev => ({ ...prev, [i]: 4 }))}
                                  style={{
                                    background: 'transparent', color: text, border: `1px solid ${border}`,
                                    borderRadius: 12, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  🎚 Back
                                </button>
                                <button
                                  onClick={() => {
                                    setSelections(prev => {
                                      const next = { ...prev };
                                      delete next[i];
                                      return next;
                                    });
                                    setBookingSteps(prev => ({ ...prev, [i]: 1 }));
                                  }}
                                  style={{
                                    background: 'transparent', color: '#ff3b30', border: 'none',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer'
                                  }}
                                >
                                  Reset Selection
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: sub, paddingLeft: 4 }}>
                  <Compass size={10} />
                  <span>Travel Agent</span>
                  <span>•</span>
                  <span>Thinking…</span>
                </div>
                <div style={{
                  padding: '12px 18px', borderRadius: '18px 18px 18px 4px',
                  background: dark ? A.cardDark : A.lightBg,
                  display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${border}`,
                }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Input bar */}
        <footer style={{ padding: '16px 24px 20px', background: bg, borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <form
              onSubmit={e => { e.preventDefault(); send(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: surf, border: `1px solid ${border}`,
                borderRadius: 980, padding: '10px 12px 10px 20px',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.02)',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = A.blue;
                e.currentTarget.style.boxShadow = dark ? 'none' : `0 4px 16px ${A.blue}15`;
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = dark ? 'none' : '0 2px 8px rgba(0,0,0,0.02)';
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                placeholder="Ask about flights, hotels, activities…"
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 14, color: text,
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: loading || !input.trim() ? A.midGray : A.blue,
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!loading && input.trim()) e.currentTarget.style.background = A.blueHover; }}
                onMouseLeave={e => { if (!loading && input.trim()) e.currentTarget.style.background = A.blue; }}
              >
                <Send size={16} color="#fff" />
              </button>
            </form>
            <p style={{ textAlign: 'center', fontSize: 11, color: sub, marginTop: 12, letterSpacing: '0.02em' }}>
              Made with <span style={{ color: '#ff3b30', fontSize: 13 }}>♥</span> by Sanket Kakad
            </p>
          </div>
        </footer>

      </div>



    </div>
  );
}

export default App;
