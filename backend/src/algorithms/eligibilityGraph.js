const haversineKm = require('./haversine');

/**
 * Helper to resolve coordinates of a given hub.
 */
function resolveHubCoordinates(hubId, item, hubDistanceMatrix, options) {
  // Check if item has embedded hub information
  if (item && item.nearest_hub && typeof item.nearest_hub === 'object') {
    if (item.nearest_hub.lat != null && item.nearest_hub.lng != null) {
      return { lat: Number(item.nearest_hub.lat), lng: Number(item.nearest_hub.lng) };
    }
  }
  if (item && item.hub && typeof item.hub === 'object') {
    if (item.hub.lat != null && item.hub.lng != null) {
      return { lat: Number(item.hub.lat), lng: Number(item.hub.lng) };
    }
  }
  if (item && item.hub_lat != null && item.hub_lng != null) {
    return { lat: Number(item.hub_lat), lng: Number(item.hub_lng) };
  }
  if (item && item.nearest_hub_lat != null && item.nearest_hub_lng != null) {
    return { lat: Number(item.nearest_hub_lat), lng: Number(item.nearest_hub_lng) };
  }

  // Check options.hubMap
  if (options && options.hubMap && options.hubMap[hubId]) {
    const hub = options.hubMap[hubId];
    if (hub && hub.lat != null && hub.lng != null) {
      return { lat: Number(hub.lat), lng: Number(hub.lng) };
    }
  }

  // Check options.hubs
  if (options && Array.isArray(options.hubs)) {
    const hub = options.hubs.find((h) => (h && typeof h === 'object' && h.id === hubId) || h === hubId);
    if (hub && hub.lat != null && hub.lng != null) {
      return { lat: Number(hub.lat), lng: Number(hub.lng) };
    }
  }

  // Check metadata attached to hubDistanceMatrix
  if (hubDistanceMatrix && hubDistanceMatrix.hubMap && hubDistanceMatrix.hubMap[hubId]) {
    const hub = hubDistanceMatrix.hubMap[hubId];
    if (hub && hub.lat != null && hub.lng != null) {
      return { lat: Number(hub.lat), lng: Number(hub.lng) };
    }
  }
  if (hubDistanceMatrix && Array.isArray(hubDistanceMatrix.hubs)) {
    const hub = hubDistanceMatrix.hubs.find((h) => (h && typeof h === 'object' && h.id === hubId) || h === hubId);
    if (hub && hub.lat != null && hub.lng != null) {
      return { lat: Number(hub.lat), lng: Number(hub.lng) };
    }
  }

  return null;
}

/**
 * Builds the eligibility graph between active donations and requests.
 *
 * For each donation-request pair with matching category:
 *   totalDistance = donorSpokeDistance + hubDistanceMatrix[donorHub][requestHub] + requestSpokeDistance
 * Edge is included if:
 *   totalDistance <= maxRadiusKm AND expiry_time allows delivery before needed_by.
 *
 * Runs BFS from each donation node across these edges to build the connected
 * adjacency list and identifies isolated donations and requests with 0 eligible edges.
 *
 * @param {Array<Object>} donations List of active donation objects
 * @param {Array<Object>} requests List of active request objects
 * @param {Array<Array<number>>|Object} hubDistanceMatrix Matrix of shortest road distances between hubs
 * @param {Object} [options={ maxRadiusKm: 15 }] Configuration options
 * @param {number} [options.maxRadiusKm=15] Maximum allowable total redistribution radius in km
 * @returns {{ adjacency: Object, isolatedDonations: Array, isolatedRequests: Array }}
 */
function buildEligibilityGraph(donations = [], requests = [], hubDistanceMatrix = {}, options = {}) {
  const maxRadiusKm = typeof options.maxRadiusKm === 'number' ? options.maxRadiusKm : 15;

  // Initialize adjacency map
  const adjacency = {};
  for (const d of donations) {
    adjacency[d.id] = [];
  }
  for (const r of requests) {
    adjacency[r.id] = [];
  }

  // Map to store validated eligible edges from donation to requests
  const eligibleEdgesByDonation = new Map();
  const eligibleEdgesByRequest = new Map();

  for (const d of donations) {
    eligibleEdgesByDonation.set(d.id, []);
  }
  for (const r of requests) {
    eligibleEdgesByRequest.set(r.id, []);
  }

  // Evaluate candidate edges
  for (const d of donations) {
    const donorHubId = d.nearest_hub_id !== undefined ? d.nearest_hub_id : d.hub_id;
    const donorCoords = d.lat != null && d.lng != null ? { lat: Number(d.lat), lng: Number(d.lng) } : null;
    const donorHubCoords = resolveHubCoordinates(donorHubId, d, hubDistanceMatrix, options);

    const donorSpokeDistance =
      donorCoords && donorHubCoords
        ? haversineKm(donorCoords.lat, donorCoords.lng, donorHubCoords.lat, donorHubCoords.lng)
        : (d.spoke_distance ?? 0);

    for (const r of requests) {
      // 1. Category match
      if (
        !d.category ||
        !r.category ||
        d.category.trim().toLowerCase() !== r.category.trim().toLowerCase()
      ) {
        continue;
      }

      // 2. Expiry allows delivery before needed_by
      const expiryMs = new Date(d.expiry_time).getTime();
      const neededByMs = new Date(r.needed_by).getTime();
      if (isNaN(expiryMs) || isNaN(neededByMs) || expiryMs < neededByMs) {
        continue;
      }

      // 3. Hub-to-hub distance from matrix
      const requestHubId = r.nearest_hub_id !== undefined ? r.nearest_hub_id : r.hub_id;
      let hubDist = Infinity;
      if (donorHubId === requestHubId) {
        hubDist = 0;
      } else if (
        hubDistanceMatrix &&
        hubDistanceMatrix[donorHubId] &&
        hubDistanceMatrix[donorHubId][requestHubId] !== undefined
      ) {
        hubDist = Number(hubDistanceMatrix[donorHubId][requestHubId]);
      }

      if (hubDist === Infinity) {
        continue;
      }

      // 4. Request spoke distance
      const requestCoords = r.lat != null && r.lng != null ? { lat: Number(r.lat), lng: Number(r.lng) } : null;
      const requestHubCoords = resolveHubCoordinates(requestHubId, r, hubDistanceMatrix, options);

      const requestSpokeDistance =
        requestCoords && requestHubCoords
          ? haversineKm(requestCoords.lat, requestCoords.lng, requestHubCoords.lat, requestHubCoords.lng)
          : (r.spoke_distance ?? 0);

      const totalDistance = donorSpokeDistance + hubDist + requestSpokeDistance;

      // 5. Radius threshold
      if (totalDistance <= maxRadiusKm) {
        eligibleEdgesByDonation.get(d.id).push({
          requestId: r.id,
          distance: totalDistance,
        });
        eligibleEdgesByRequest.get(r.id).push({
          donationId: d.id,
          distance: totalDistance,
        });
      }
    }
  }

  // BFS from each donation node across eligible edges to build connected adjacency list
  const isolatedDonations = [];
  const connectedRequestIds = new Set();

  for (const d of donations) {
    const directEdges = eligibleEdgesByDonation.get(d.id) || [];
    if (directEdges.length === 0) {
      isolatedDonations.push(d.id);
      continue;
    }

    // BFS queue starting from this donation node
    const queue = [d.id];
    const visitedInBFS = new Set([d.id]);

    while (queue.length > 0) {
      const currentId = queue.shift();
      const edges = eligibleEdgesByDonation.get(currentId) || [];

      for (const edge of edges) {
        const rId = edge.requestId;
        if (!adjacency[currentId].includes(rId)) {
          adjacency[currentId].push(rId);
        }
        if (!adjacency[rId].includes(currentId)) {
          adjacency[rId].push(currentId);
        }
        connectedRequestIds.add(rId);

        if (!visitedInBFS.has(rId)) {
          visitedInBFS.add(rId);
          // Explore other donations connected through request rId
          const rEdges = eligibleEdgesByRequest.get(rId) || [];
          for (const rEdge of rEdges) {
            const nextDonationId = rEdge.donationId;
            if (!visitedInBFS.has(nextDonationId)) {
              visitedInBFS.add(nextDonationId);
              queue.push(nextDonationId);
            }
          }
        }
      }
    }
  }

  // Flag requests with zero eligible edges
  const isolatedRequests = [];
  for (const r of requests) {
    const rEdges = eligibleEdgesByRequest.get(r.id) || [];
    if (rEdges.length === 0 || !connectedRequestIds.has(r.id)) {
      isolatedRequests.push(r.id);
    }
  }

  return {
    adjacency,
    isolatedDonations,
    isolatedRequests,
  };
}

buildEligibilityGraph.buildEligibilityGraph = buildEligibilityGraph;
module.exports = buildEligibilityGraph;
module.exports.buildEligibilityGraph = buildEligibilityGraph;
