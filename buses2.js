import fetch from 'node-fetch';

const URL = 'https://cwruuh.transloc.com/Services/JSONPRelay.svc/GetMapVehiclePoints?method=jQuery1111026019195338200984_1742691992392&ApiKey=8882812681&isPublicMap=true&_=1742691993260';

const POLL_INTERVAL = 15 * 1000; // 15 seconds
const BREAK_THRESHOLD = 180;
const POSITION_TOLERANCE = 0.0001; // account for gps errors

const busTracker = {};

function isSamePosition(pos1, pos2) {
  return (
    Math.abs(pos1.Latitude - pos2.Latitude) < POSITION_TOLERANCE &&
    Math.abs(pos1.Longitude - pos2.Longitude) < POSITION_TOLERANCE
  );
}

async function fetchBusData() {
  const res = await fetch(URL, {
    headers: {
      "accept": "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      "referer": "https://cwruuh.transloc.com/iframe.aspx?showTwitter=false&showRouteMenu=false&showMainMenu=false"
    }
  });

  const text = await res.text();
  const match = text.match(/^[^(]+\((.*)\);?$/);
  if (!match) throw new Error("Invalid JSONP response");

  const data = JSON.parse(match[1]);
  return data;
}

async function monitorBuses() {
  try {
    const vehicles = await fetchBusData(); // Already the array

    vehicles.forEach(bus => {
      const id = bus.VehicleID;
      const prev = busTracker[id];

      if (prev && isSamePosition(prev.position, bus)) {
        busTracker[id].stationaryFor += POLL_INTERVAL / 1000;
      } else {
        busTracker[id] = {
          position: { Latitude: bus.Latitude, Longitude: bus.Longitude },
          stationaryFor: 0
        };
      }

      if (busTracker[id].stationaryFor >= BREAK_THRESHOLD) {
        console.log(`Bus ${bus.Name} has been stationary for ${busTracker[id].stationaryFor} seconds`);
      }
    });
  } catch (err) {
    console.error("No data", err);
  }
}

setInterval(monitorBuses, POLL_INTERVAL);
console.log("working");
