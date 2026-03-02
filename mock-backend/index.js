// index.js - Generic Express API server based on db.json

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple CORS header middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Body parser for POST JSON payloads
app.use(express.json());

// Load database JSON once at startup
const dbPath = path.join(__dirname, 'database', 'db.json');
let db = {};
try {
  const raw = fs.readFileSync(dbPath, 'utf-8');
  db = JSON.parse(raw);
} catch (err) {
  console.error('Failed to load db.json:', err);
  process.exit(1);
}

// Ensure bookings subkey structure exists in dataset
if (!db.bookings || Array.isArray(db.bookings)) {
  db.bookings = {
    active_bookings: Array.isArray(db.bookings) ? db.bookings : (db.bookings?.active_bookings || [])
  };
}

// POST endpoint to record mock bookings
app.post('/book', (req, res) => {
  const { name, itemType, itemId, itemData, date } = req.body;
  if (!name || !itemId) {
    return res.status(400).json({ error: 'Guest name and Item ID are required.' });
  }

  const bookingId = `BKG-${Math.floor(100000 + Math.random() * 900000)}`;
  const newBooking = {
    bookingId,
    name,
    itemType: itemType || 'general',
    itemId,
    itemData: itemData || {},
    date: date || itemData?.date || new Date().toISOString().split('T')[0],
    bookedAt: new Date().toISOString()
  };

  db.bookings.active_bookings.push(newBooking);

  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write db.json during booking:', err);
  }

  res.status(201).json(newBooking);
});

// Helper: extract user-friendly item name for errors
function getItemName(key, subkey) {
  const name = subkey || key || 'items';
  if (name.toLowerCase().includes('activities')) return 'activities';
  if (name.toLowerCase().includes('flights')) return 'flights';
  if (name.toLowerCase().includes('hotels')) return 'hotels';
  return name;
}

// Helper: send filtered response or 404 error if range query yields no results
function sendFilteredResponse(req, res, val, key, subkey) {
  if (Array.isArray(val)) {
    const filtered = filterData(val, req.query);
    
    // Check if price filtering was attempted and returned no results
    const hasPriceFilter = req.query.minPrice !== undefined || req.query.maxPrice !== undefined || req.query.minprice !== undefined || req.query.maxprice !== undefined;
    if (hasPriceFilter && filtered.length === 0) {
      const itemName = getItemName(key, subkey);
      return res.status(404).json({ error: `no ${itemName} found in this range` });
    }
    
    return res.json(filtered);
  }
  return res.json(val);
}

// Helper: generic filter for an array of objects based on query params (with travel field aliases and price range filtering)
function filterData(dataArray, query) {
  if (!Array.isArray(dataArray)) return dataArray;
  
  // Extract price range query params
  const minPrice = query.minPrice || query.minprice;
  const maxPrice = query.maxPrice || query.maxprice;

  // Filter out price range keys from standard query matching
  const standardQuery = {};
  for (const k of Object.keys(query)) {
    if (['minprice', 'maxprice'].includes(k.toLowerCase())) {
      continue;
    }
    standardQuery[k] = query[k];
  }

  let filtered = dataArray;
  const standardKeys = Object.keys(standardQuery);
  
  // Apply standard filters first
  if (standardKeys.length > 0) {
    filtered = filtered.filter(item => {
      return standardKeys.every(k => {
        let val = standardQuery[k];
        if (!val) return true;
        
        // Skip filtering on 'date' key as flight/hotel/activity frequency is daily
        if (k.toLowerCase() === 'date') return true;

        // Standardize search key & handle aliases
        let targetKeys = [k];
        if (k.toLowerCase() === 'source') {
          targetKeys = ['originCode', 'origin', 'source', 'from'];
        } else if (k.toLowerCase() === 'dest' || k.toLowerCase() === 'destination') {
          targetKeys = ['destinationCode', 'destination', 'dest', 'to'];
        }
        
        return targetKeys.some(tk => {
          const itemKey = Object.keys(item).find(key => key.toLowerCase() === tk.toLowerCase());
          if (!itemKey) return false;
          return String(item[itemKey]).toLowerCase().includes(String(val).toLowerCase());
        });
      });
    });
  }

  // Apply price range filter if minPrice or maxPrice is provided
  if ((minPrice !== undefined && minPrice !== '') || (maxPrice !== undefined && maxPrice !== '')) {
    let min = -Infinity;
    let max = Infinity;

    if (minPrice !== undefined && minPrice !== '') {
      const parsedMin = Number(minPrice);
      if (!isNaN(parsedMin)) {
        min = parsedMin;
      }
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      const parsedMax = Number(maxPrice);
      if (!isNaN(parsedMax)) {
        max = parsedMax;
      }
    }

    filtered = filtered.filter(item => {
      const priceKey = Object.keys(item).find(key => 
        key.toLowerCase() === 'price' || key.toLowerCase() === 'pricepernight'
      );
      if (!priceKey) return false; // Filter out items with no price property
      
      const priceVal = Number(item[priceKey]);
      if (isNaN(priceVal)) return false;
      
      return priceVal >= min && priceVal <= max;
    });
  }

  return filtered;
}

// Health‑check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Root endpoint – list available top‑level keys and include metadata configuration
app.get('/', (req, res) => {
  const endpoints = Object.keys(db).filter(key => key !== 'metadata');
  res.json({
    availableEndpoints: endpoints,
    metadata: db.metadata || {}
  });
});

// Serve static assets from the built frontend dist folder (for Docker/production deployment)
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Generic dynamic nested route resolver (depth 1)
app.get('/:key', (req, res) => {
  const { key } = req.params;
  if (!db[key]) return res.status(404).json({ error: `Endpoint /${key} not found` });
  const val = db[key];
  return sendFilteredResponse(req, res, val, key, null);
});

// Generic dynamic nested route resolver (depth 2 - e.g. /flights/available_flights)
app.get('/:key/:subkey', (req, res) => {
  const { key, subkey } = req.params;
  if (!db[key] || !db[key][subkey]) {
    return res.status(404).json({ error: `Endpoint /${key}/${subkey} not found` });
  }
  const val = db[key][subkey];
  return sendFilteredResponse(req, res, val, key, subkey);
});

// Generic dynamic nested route resolver (depth 3 - e.g. /flights/available_flights/details)
app.get('/:key/:subkey/:detail', (req, res) => {
  const { key, subkey } = req.params;
  if (!db[key] || !db[key][subkey]) {
    return res.status(404).json({ error: `Endpoint /${key}/${subkey} not found` });
  }
  const val = db[key][subkey];
  return sendFilteredResponse(req, res, val, key, subkey);
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
