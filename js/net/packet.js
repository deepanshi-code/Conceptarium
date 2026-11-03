// A message's journey from one computer to another through a router, layer by layer.
// Going down, each layer wraps the data in its own header; going up, each layer removes it.
// The router only climbs to the network layer: it reads the IP address, picks the next hop, and sends it on.

export const MODELS = {
  tcpip: {
    name: 'TCP/IP (4 layers)',
    layers: [
      { name: 'Application', header: 'HTTP', what: 'Your app’s data, e.g. a web request.' },
      { name: 'Transport', header: 'TCP', what: 'Port numbers, so it reaches the right app; numbering so nothing is lost.' },
      { name: 'Internet', header: 'IP', what: 'Source and destination IP address, so routers can find the way.' },
      { name: 'Link', header: 'ETH', what: 'MAC address of the next device on this cable or Wi-Fi.' },
    ],
    networkLayer: 2,
  },
  osi: {
    name: 'OSI (7 layers)',
    layers: [
      { name: 'Application', header: 'HTTP', what: 'The protocol your app speaks.' },
      { name: 'Presentation', header: 'TLS', what: 'Encryption and data format.' },
      { name: 'Session', header: 'SES', what: 'Keeps the conversation open.' },
      { name: 'Transport', header: 'TCP', what: 'Ports and reliable delivery.' },
      { name: 'Network', header: 'IP', what: 'IP addresses and routing.' },
      { name: 'Data link', header: 'ETH', what: 'MAC address of the next hop.' },
      { name: 'Physical', header: 'BITS', what: 'Turned into signals on the wire.' },
    ],
    networkLayer: 4,
  },
};

/**
 * Steps of the journey. Each step: { node: 'sender' | 'router' | 'receiver' | 'wire1' | 'wire2', layer, action, headers }.
 * `headers` is the stack of header names wrapped around the data at that moment (outermost last).
 */
export function journey(modelKey) {
  const { layers, networkLayer } = MODELS[modelKey];
  const steps = [];
  let headers = [];
  const bottom = layers.length - 1;
  for (let i = 0; i <= bottom; i++) {
    headers = [...headers, layers[i].header];
    steps.push({ node: 'sender', layer: i, action: 'wrap', headers });
  }
  steps.push({ node: 'wire1', layer: bottom, action: 'travel', headers });
  // The router peels off only the layers below the network layer, so the IP header is on the outside when it reads it.
  for (let i = bottom; i > networkLayer; i--) {
    headers = headers.slice(0, -1);
    steps.push({ node: 'router', layer: i, action: 'unwrap', headers });
  }
  steps.push({ node: 'router', layer: networkLayer, action: 'route', headers });
  for (let i = networkLayer + 1; i <= bottom; i++) {
    headers = [...headers, layers[i].header];
    steps.push({ node: 'router', layer: i, action: 'wrap', headers });
  }
  steps.push({ node: 'wire2', layer: bottom, action: 'travel', headers });
  for (let i = bottom; i >= 0; i--) {
    headers = headers.slice(0, -1);
    steps.push({ node: 'receiver', layer: i, action: 'unwrap', headers });
  }
  return steps;
}
