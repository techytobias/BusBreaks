import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Bus tracking config
const POLL_INTERVAL = 15 * 1000;
const BREAK_THRESHOLD = 180;
const POSITION_TOLERANCE = 0.0001;
const BUS_API_URL = 'https://cwruuh.transloc.com/Services/JSONPRelay.svc/GetMapVehiclePoints?method=jQuery1111026019195338200984_1742691992392&ApiKey=8882812681&isPublicMap=true&_=1742691993260';

const busTracker = {};

const DEPOT_BOUNDS = {
  minLat: 41.5088,
  maxLat: 41.5107,
  minLng: -81.619,
  maxLng: -81.6154
};

const ROUTE_NAMES = {
  9: 'South Loop',
  33: 'NightLink',
  41: 'UCRC',
  14: 'KSL Express',
  34: 'HEC After Hours',
  7: 'Commuter AM',
  19: 'A',
  20: 'B',
  21: 'C',
  24: 'West Campus',
  29: 'Charter',
  30: 'Out of Service',
  10: 'Greenlink',
  11: 'HEC Flyer',
  12: 'HEC Main',
  18: 'Nursing 1',
  17: 'Nursing 2',

  // Add others as needed
};


function isInDepot(lat, lng) {
  return (
    lat >= DEPOT_BOUNDS.minLat &&
    lat <= DEPOT_BOUNDS.maxLat &&
    lng >= DEPOT_BOUNDS.minLng &&
    lng <= DEPOT_BOUNDS.maxLng
  );
}

function isSamePosition(pos1, pos2) {
  return (
    Math.abs(pos1.Latitude - pos2.Latitude) < POSITION_TOLERANCE &&
    Math.abs(pos1.Longitude - pos2.Longitude) < POSITION_TOLERANCE
  );
}

async function fetchBusData() {
  const res = await fetch(BUS_API_URL, {
    headers: {
      "accept": "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      "referer": "https://cwruuh.transloc.com/iframe.aspx?showTwitter=false&showRouteMenu=false&showMainMenu=false"
    }
  });

  const text = await res.text();
  const match = text.match(/^[^(]+\((.*)\);?$/);
  if (!match) throw new Error("Invalid JSONP response");

  return JSON.parse(match[1]);
}

// Polling + update logic
async function monitorBuses() {
  try {
    const vehicles = await fetchBusData();
    const now = Date.now();

    vehicles.forEach(bus => {
      const id = bus.VehicleID;
      const prev = busTracker[id];

      const isSame = prev && isSamePosition(prev.position, bus);
      const inDepot = isInDepot(bus.Latitude, bus.Longitude);


      if (!prev) {
        busTracker[id] = {
          position: { Latitude: bus.Latitude, Longitude: bus.Longitude },
          stationaryFor: 0,
          totalBreakTime: 0,
          onBreak: false,
          name: bus.Name,
          routeId: bus.RouteID,
          lastSeen: now,
          currentBreakStart: null,
          breaks: []
        };
        return;
      }

      if (isSame) {
        busTracker[id].stationaryFor += POLL_INTERVAL / 1000;
      } else {
        if (prev.onBreak) {
          const endTime = now;
          const duration = prev.stationaryFor;

          if (!isInDepot(prev.position.Latitude, prev.position.Longitude)) {
            prev.totalBreakTime += duration;

            prev.breaks.push({
              startTime: prev.currentBreakStart,
              endTime,
              duration: Math.floor(duration)
            });
          }

          prev.onBreak = false;
          prev.currentBreakStart = null;
        }

        prev.position = { Latitude: bus.Latitude, Longitude: bus.Longitude };
        prev.stationaryFor = 0;
      }

      prev.lastSeen = now;
      prev.name = bus.Name;
      prev.routeId = bus.RouteID;

      // Start a new break session if not already on break
      if (!prev.onBreak && prev.stationaryFor >= BREAK_THRESHOLD && !inDepot) {
        prev.onBreak = true;
        prev.currentBreakStart = now;
      }
    });
  } catch (err) {
    console.error("Error during monitoring:", err);
  }
}

// API route for frontend
const STALE_THRESHOLD = 60 * 1000; // 60 seconds

app.get('/api/breaks', (req, res) => {
  const now = Date.now();

  const onBreak = Object.entries(busTracker)
    .filter(([_, data]) =>
      data.onBreak &&
      data.lastSeen && (now - data.lastSeen) <= STALE_THRESHOLD
    )
    .map(([id, data]) => ({
      vehicleId: id,
      name: data.name,
      routeId: data.routeId,
      currentBreak: Math.floor(data.stationaryFor),
      totalBreak: Math.floor(data.totalBreakTime + data.stationaryFor)
    }));

  res.json(onBreak);
});

app.get('/api/break-history', (req, res) => {
  const history = Object.entries(busTracker).map(([id, data]) => ({
    vehicleId: id,
    name: data.name,
    routeId: data.routeId,
    breaks: data.breaks.map(b => ({
      startTime: new Date(b.startTime).toISOString(),
      endTime: new Date(b.endTime).toISOString(),
      duration: b.duration
    }))
  }));

  res.json(history);
});

// Start server and poller
app.listen(PORT, () => {
  console.log(`🚀 Dashboard running at http://localhost:${PORT}`);
});

setInterval(monitorBuses, POLL_INTERVAL);
