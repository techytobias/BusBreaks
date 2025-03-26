// Save this as busData.js and run with Node.js (18+)
import fetch from 'node-fetch';
import fs from 'fs';

async function getBusData() {
  const url = 'https://cwruuh.transloc.com/Services/JSONPRelay.svc/GetMapVehiclePoints?method=jQuery1111026019195338200984_1742691992392&ApiKey=8882812681&isPublicMap=true&_=1742691993260';

  const res = await fetch(url, {
    headers: {
      "accept": "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01",
      "x-requested-with": "XMLHttpRequest",
      "referer": "https://cwruuh.transloc.com/iframe.aspx?showTwitter=false&showRouteMenu=false&showMainMenu=false"
    }
  });

  const text = await res.text();

  // Strip JSONP wrapper
  const jsonpMatch = text.match(/^[^(]+\((.*)\);?$/);
  if (!jsonpMatch) {
    throw new Error("Unexpected JSONP format");
  }

  const jsonString = jsonpMatch[1];
  const data = JSON.parse(jsonString);

  // Save to file
  fs.writeFileSync('busData.json', JSON.stringify(data, null, 2));
  console.log('Bus data saved to busData.json');
}

getBusData().catch(console.error);
