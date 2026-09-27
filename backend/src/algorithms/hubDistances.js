/**
 * Computes all-pairs shortest path distances between all hubs in the network
 * using the Floyd–Warshall algorithm.
 *
 * Design Context:
 * - Vertices (V): The set of distribution hubs in the network (H hubs).
 * - Edges (E): Undirected road segments connecting pairs of directly accessible hubs.
 *   Not all hub pairs are directly connected by a road segment; unconnected pairs
 *   are initialized with a weight of Infinity.
 * - Weights (W): Road distance in kilometers (distance_km) between directly connected hubs.
 *   Because roads can be traversed in both directions, edges are undirected (symmetric weights).
 *   Self-distances (the diagonal) are set to 0.
 *
 * Floyd–Warshall Algorithm:
 * - Runs a triple-nested loop over all hubs as intermediate points (k), updating the shortest
 *   path between every pair of hubs (i, j) by checking if a route through k is shorter:
 *   dist(i, j) = min(dist(i, j), dist(i, k) + dist(k, j)).
 * - Time Complexity: O(H^3)
 * - Space Complexity: O(H^2)
 *
 * @param {Array<Object|number|string>} hubs List of hub objects (having .id, .lat, .lng) or hub IDs
 * @param {Array<Object>} hubEdges List of edges ({ hub_a_id, hub_b_id, distance_km })
 * @returns {Array<Array<number>>} H x H matrix of shortest road distances in km, accessible by both
 *                                 hub ID (matrix[hubAId][hubBId]) and 0-based array index (matrix[i][j]).
 */
function computeHubDistanceMatrix(hubs, hubEdges = []) {
  if (!Array.isArray(hubs)) {
    throw new TypeError('hubs must be an array');
  }

  // Extract hub IDs and maintain order
  const hubIds = hubs.map((h) => (h && typeof h === 'object' && 'id' in h ? h.id : h));
  const n = hubIds.length;
  const hubIndexMap = new Map();
  hubIds.forEach((id, idx) => {
    hubIndexMap.set(id, idx);
  });

  // Initialize H x H distance matrix with 0 on diagonal and Infinity elsewhere
  const matrix = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      const initialDist = i === j ? 0 : Infinity;
      row[j] = initialDist;
      row[hubIds[j]] = initialDist;
    }
    matrix[i] = row;
    matrix[hubIds[i]] = row;
  }

  // Store metadata for spoke distance calculations in eligibility graph
  matrix.hubs = hubs;
  matrix.hubMap = {};
  for (const h of hubs) {
    if (h && typeof h === 'object' && 'id' in h) {
      matrix.hubMap[h.id] = h;
    }
  }

  // Populate direct edges (undirected road network)
  if (Array.isArray(hubEdges)) {
    for (const edge of hubEdges) {
      const u =
        edge.hub_a_id !== undefined
          ? edge.hub_a_id
          : edge.from !== undefined
          ? edge.from
          : edge.u !== undefined
          ? edge.u
          : Array.isArray(edge)
          ? edge[0]
          : undefined;

      const v =
        edge.hub_b_id !== undefined
          ? edge.hub_b_id
          : edge.to !== undefined
          ? edge.to
          : edge.v !== undefined
          ? edge.v
          : Array.isArray(edge)
          ? edge[1]
          : undefined;

      const rawDist =
        edge.distance_km !== undefined
          ? edge.distance_km
          : edge.distance !== undefined
          ? edge.distance
          : edge.weight !== undefined
          ? edge.weight
          : Array.isArray(edge)
          ? edge[2]
          : undefined;

      const dist = Number(rawDist);
      if (u !== undefined && v !== undefined && !isNaN(dist)) {
        const i = hubIndexMap.get(u);
        const j = hubIndexMap.get(v);
        if (i !== undefined && j !== undefined) {
          const currentMin = Math.min(matrix[i][j], dist);
          // Set both directions since edges are undirected
          matrix[i][j] = currentMin;
          matrix[i][v] = currentMin;
          matrix[u][j] = currentMin;
          matrix[u][v] = currentMin;

          matrix[j][i] = currentMin;
          matrix[j][u] = currentMin;
          matrix[v][i] = currentMin;
          matrix[v][u] = currentMin;
        }
      }
    }
  }

  // Classic Floyd–Warshall triple-nested relaxation
  for (let k = 0; k < n; k++) {
    const hubK = hubIds[k];
    for (let i = 0; i < n; i++) {
      const hubI = hubIds[i];
      for (let j = 0; j < n; j++) {
        const hubJ = hubIds[j];
        const distIK = matrix[i][k];
        const distKJ = matrix[k][j];

        if (distIK !== Infinity && distKJ !== Infinity && distIK + distKJ < matrix[i][j]) {
          const relaxedDist = distIK + distKJ;
          matrix[i][j] = relaxedDist;
          matrix[i][hubJ] = relaxedDist;
          matrix[hubI][j] = relaxedDist;
          matrix[hubI][hubJ] = relaxedDist;
        }
      }
    }
  }

  return matrix;
}

computeHubDistanceMatrix.computeHubDistanceMatrix = computeHubDistanceMatrix;
module.exports = computeHubDistanceMatrix;
module.exports.computeHubDistanceMatrix = computeHubDistanceMatrix;
