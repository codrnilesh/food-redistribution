/**
 * Runs Edmonds-Karp Maximum Flow algorithm to allocate food donations to requests.
 *
 * Flow Network Structure:
 * - SOURCE -> Donation node: capacity = donation.remaining_quantity
 * - Donation node -> Request node (per eligibilityAdjacency): capacity = Infinity
 * - Request node -> SINK: capacity = request.remaining_quantity
 *
 * Augmenting paths are identified via BFS in the residual network (Edmonds-Karp).
 * When exploring outgoing edges from a donation node, candidate request nodes
 * are visited in the order prescribed by priorityOrderedRequestIds.
 *
 * @param {Array<Object>} donations List of donation objects with .id and .remaining_quantity
 * @param {Array<Object>} requests List of request objects with .id and .remaining_quantity
 * @param {Object} eligibilityAdjacency Adjacency map: donation.id -> array of eligible request IDs
 * @param {Array<string|number>} [priorityOrderedRequestIds=[]] Request IDs in descending priority order
 * @returns {{ edges: Array<Object>, allocations: Array<Object>, totalFlow: number }}
 */
function runMaxFlowAllocation(
  donations = [],
  requests = [],
  eligibilityAdjacency = {},
  priorityOrderedRequestIds = []
) {
  const SOURCE = '__SOURCE__';
  const SINK = '__SINK__';

  const dNode = (id) => `d_${id}`;
  const rNode = (id) => `r_${id}`;

  const graph = new Map(); // Node -> Array<neighborNode>
  const capacity = new Map(); // "u->v" -> number
  const flow = new Map(); // "u->v" -> number

  function getCap(u, v) {
    return capacity.get(`${u}->${v}`) || 0;
  }
  function setCap(u, v, c) {
    capacity.set(`${u}->${v}`, c);
  }
  function getFlow(u, v) {
    return flow.get(`${u}->${v}`) || 0;
  }
  function setFlow(u, v, f) {
    flow.set(`${u}->${v}`, f);
  }
  function getResidual(u, v) {
    return getCap(u, v) - getFlow(u, v);
  }

  function addEdge(u, v, cap) {
    if (!graph.has(u)) graph.set(u, []);
    if (!graph.has(v)) graph.set(v, []);
    if (!graph.get(u).includes(v)) graph.get(u).push(v);
    if (!graph.get(v).includes(u)) graph.get(v).push(u); // Include residual backward edge in graph
    setCap(u, v, (getCap(u, v) || 0) + cap);
    if (!capacity.has(`${v}->${u}`)) setCap(v, u, 0);
  }

  // 1. Source -> Donations (capacity = remaining_quantity)
  for (const d of donations) {
    const qty = Number(d.remaining_quantity || 0);
    if (qty > 0) {
      addEdge(SOURCE, dNode(d.id), qty);
    }
  }

  // 2. Donations -> Requests (capacity = Infinity for eligible edges)
  for (const d of donations) {
    const u = dNode(d.id);
    const adjacent = eligibilityAdjacency[d.id] || [];
    for (const req of adjacent) {
      const rId = req && typeof req === 'object' && 'id' in req ? req.id : req;
      addEdge(u, rNode(rId), Infinity);
    }
  }

  // 3. Requests -> Sink (capacity = remaining_quantity)
  for (const r of requests) {
    const qty = Number(r.remaining_quantity || 0);
    if (qty > 0) {
      addEdge(rNode(r.id), SINK, qty);
    }
  }

  // Map request node keys to their priority index for deterministic BFS edge exploration
  const priorityIndex = new Map();
  if (Array.isArray(priorityOrderedRequestIds)) {
    priorityOrderedRequestIds.forEach((id, idx) => {
      priorityIndex.set(rNode(id), idx);
    });
  }

  let totalFlow = 0;

  // Edmonds–Karp: Repeat BFS until no augmenting path in the residual graph exists
  while (true) {
    const parent = new Map();
    const visited = new Set([SOURCE]);
    const queue = [SOURCE];

    let foundPath = false;

    while (queue.length > 0) {
      const u = queue.shift();

      if (u === SINK) {
        foundPath = true;
        break;
      }

      let neighbors = graph.get(u) || [];

      // When exploring edges out of a donation node, visit request nodes
      // ordered by priorityOrderedRequestIds first
      if (u.startsWith('d_')) {
        neighbors = [...neighbors].sort((a, b) => {
          const isAReq = a.startsWith('r_');
          const isBReq = b.startsWith('r_');

          if (isAReq && isBReq) {
            const pA = priorityIndex.has(a) ? priorityIndex.get(a) : Infinity;
            const pB = priorityIndex.has(b) ? priorityIndex.get(b) : Infinity;
            return pA - pB;
          }
          if (isAReq) return -1;
          if (isBReq) return 1;
          return 0;
        });
      }

      for (const v of neighbors) {
        if (!visited.has(v) && getResidual(u, v) > 0) {
          visited.add(v);
          parent.set(v, u);
          queue.push(v);
        }
      }
    }

    if (!foundPath) {
      break;
    }

    // Find bottleneck capacity along the augmenting path
    let bottleneck = Infinity;
    let curr = SINK;
    while (curr !== SOURCE) {
      const p = parent.get(curr);
      bottleneck = Math.min(bottleneck, getResidual(p, curr));
      curr = p;
    }

    // Augment flow along the path
    curr = SINK;
    while (curr !== SOURCE) {
      const p = parent.get(curr);
      setFlow(p, curr, getFlow(p, curr) + bottleneck);
      setFlow(curr, p, getFlow(curr, p) - bottleneck);
      curr = p;
    }

    totalFlow += bottleneck;
  }

  // Collect all donation-request edges with active positive flow
  const edges = [];
  for (const d of donations) {
    const u = dNode(d.id);
    const adjacent = eligibilityAdjacency[d.id] || [];
    for (const req of adjacent) {
      const rId = req && typeof req === 'object' && 'id' in req ? req.id : req;
      const v = rNode(rId);
      const allocatedQty = getFlow(u, v);
      if (allocatedQty > 0) {
        edges.push({
          donation_id: d.id,
          request_id: rId,
          donationId: d.id,
          requestId: rId,
          allocated_quantity: allocatedQty,
          allocatedQuantity: allocatedQty,
          flow: allocatedQty,
        });
      }
    }
  }

  return {
    edges,
    allocations: edges,
    totalFlow,
  };
}

runMaxFlowAllocation.runMaxFlowAllocation = runMaxFlowAllocation;
module.exports = runMaxFlowAllocation;
module.exports.runMaxFlowAllocation = runMaxFlowAllocation;
