async function monitorBuses() {
  try {
    const vehicles = await fetchBusData(); // Already the array

    if (!vehicles || !Array.isArray(vehicles)) {
      console.warn("No vehicle data found");
      return;
    }

    vehicles.forEach(bus => {
      const id = bus.VehicleID;
      const prev = busTracker[id];

      if (prev && isSamePosition(prev.position, bus)) {
        // Update time stationary
        busTracker[id].stationaryFor += POLL_INTERVAL / 1000;
      } else {
        // Reset position and timer
        busTracker[id] = {
          position: { Latitude: bus.Latitude, Longitude: bus.Longitude },
          stationaryFor: 0
        };
      }

      if (busTracker[id].stationaryFor >= BREAK_THRESHOLD) {
        console.log(`🛑 Bus ${bus.Name} (ID: ${id}) has been stationary for ${busTracker[id].stationaryFor} seconds (likely on break)`);
      }
    });
  } catch (err) {
    console.error("Failed to fetch or process bus data:", err);
  }
}