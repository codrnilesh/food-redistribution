const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireRole } = require('../middleware/auth');
const haversineKm = require('../algorithms/haversine');
const computeHubDistanceMatrix = require('../algorithms/hubDistances');
const scheduleDeliveries = require('../algorithms/deliveryScheduler');
const optimizeRoute = require('../algorithms/routeOptimizer');

/**
 * Calculates transit distance between two geographical points via hubs.
 */
function getStopDistance(s1, s2, hubDistanceMatrix, hubs = []) {
  if (!s1 || !s2) return 0;
  if (s1.lat == null || s1.lng == null || s2.lat == null || s2.lng == null) return 0;

  const direct = haversineKm(Number(s1.lat), Number(s1.lng), Number(s2.lat), Number(s2.lng));

  const hub1Id = s1.nearest_hub_id;
  const hub2Id = s2.nearest_hub_id;

  if (!hub1Id || !hub2Id || hub1Id === hub2Id) {
    return direct;
  }

  const hub1 = Array.isArray(hubs) ? hubs.find((h) => h.id === hub1Id) : null;
  const hub2 = Array.isArray(hubs) ? hubs.find((h) => h.id === hub2Id) : null;

  if (!hub1 || !hub2 || hub1.lat == null || hub2.lat == null) {
    return direct;
  }

  const spoke1 = haversineKm(Number(s1.lat), Number(s1.lng), Number(hub1.lat), Number(hub1.lng));
  const spoke2 = haversineKm(Number(s2.lat), Number(s2.lng), Number(hub2.lat), Number(hub2.lng));

  let hubRoadDist = Infinity;
  if (
    hubDistanceMatrix &&
    hubDistanceMatrix[hub1Id] &&
    hubDistanceMatrix[hub1Id][hub2Id] !== undefined
  ) {
    hubRoadDist = Number(hubDistanceMatrix[hub1Id][hub2Id]);
  }

  if (hubRoadDist === Infinity) {
    return direct;
  }

  return Math.min(direct, spoke1 + hubRoadDist + spoke2);
}

// POST /routes/generate (Admin only)
router.post(
  ['/routes/generate', '/generate'],
  requireRole('admin'),
  async (req, res) => {
    try {
      // 1. Find all CONFIRMED allocations not yet assigned to any route
      const { data: existingStops, error: stopsQueryError } = await supabase
        .from('route_stops')
        .select('allocation_id');

      if (stopsQueryError) {
        return res.status(500).json({ error: stopsQueryError.message });
      }

      const assignedAllocationIds = new Set(
        (existingStops || []).map((s) => s.allocation_id).filter(Boolean)
      );

      const { data: confirmedAllocations, error: allocError } = await supabase
        .from('allocations')
        .select('*')
        .eq('status', 'CONFIRMED');

      if (allocError) {
        return res.status(500).json({ error: allocError.message });
      }

      const unroutedAllocations = (confirmedAllocations || []).filter(
        (a) => !assignedAllocationIds.has(a.id)
      );

      if (unroutedAllocations.length === 0) {
        return res.json({
          routes: [],
          message: 'No unrouted confirmed allocations found',
        });
      }

      // 2. Load available volunteers
      const { data: volunteers, error: volError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'volunteer');

      if (volError) {
        return res.status(500).json({ error: volError.message });
      }

      if (!volunteers || volunteers.length === 0) {
        return res.status(400).json({ error: 'No available volunteers found' });
      }

      // 3. Load associated donations and requests to retrieve coordinates
      const donationIds = [...new Set(unroutedAllocations.map((a) => a.donation_id))];
      const requestIds = [...new Set(unroutedAllocations.map((a) => a.request_id))];

      const { data: donations } = await supabase.from('donations').select('*').in('id', donationIds);
      const { data: requests } = await supabase.from('requests').select('*').in('id', requestIds);

      const donationMap = new Map((donations || []).map((d) => [d.id, d]));
      const requestMap = new Map((requests || []).map((r) => [r.id, r]));

      // 4. Load hubs and hub edges to build distance matrix
      const { data: hubs } = await supabase.from('hubs').select('*');
      const { data: hubEdges } = await supabase.from('hub_edges').select('*');
      const hubDistanceMatrix = computeHubDistanceMatrix(hubs || [], hubEdges || []);

      // 5. Run greedy activity selection delivery scheduler across volunteers
      const { assignments } = scheduleDeliveries(unroutedAllocations, volunteers);

      const allocMap = new Map(unroutedAllocations.map((a) => [a.id, a]));
      const createdRoutes = [];

      // 6. For each volunteer's assigned allocation group, optimize route
      for (const assignment of assignments) {
        const { volunteerId, allocationIds } = assignment;
        if (!allocationIds || allocationIds.length === 0) continue;

        const assignedAllocs = allocationIds.map((id) => allocMap.get(id)).filter(Boolean);

        // Build candidate stops for this volunteer: 1 PICKUP and 1 DROPOFF per allocation
        const candidateStops = [];
        for (const alloc of assignedAllocs) {
          const d = donationMap.get(alloc.donation_id);
          const r = requestMap.get(alloc.request_id);

          candidateStops.push({
            allocation_id: alloc.id,
            stop_type: 'PICKUP',
            lat: d ? d.lat : 0,
            lng: d ? d.lng : 0,
            nearest_hub_id: d ? d.nearest_hub_id : null,
          });

          candidateStops.push({
            allocation_id: alloc.id,
            stop_type: 'DROPOFF',
            lat: r ? r.lat : 0,
            lng: r ? r.lng : 0,
            nearest_hub_id: r ? r.nearest_hub_id : null,
          });
        }

        // Optimize path with Held-Karp (capped at 10 stops)
        const stopsToOptimize =
          candidateStops.length <= 10 ? candidateStops : candidateStops.slice(0, 10);

        const { orderedStops } = optimizeRoute(stopsToOptimize, (a, b) =>
          getStopDistance(a, b, hubDistanceMatrix, hubs || [])
        );

        // Ensure PICKUP precedes DROPOFF for each allocation
        const finalOrderedStops = [];
        const seenPickups = new Set();
        const pendingDropoffs = new Map();

        for (const stop of orderedStops) {
          if (stop.stop_type === 'PICKUP') {
            finalOrderedStops.push(stop);
            seenPickups.add(stop.allocation_id);
            if (pendingDropoffs.has(stop.allocation_id)) {
              finalOrderedStops.push(pendingDropoffs.get(stop.allocation_id));
              pendingDropoffs.delete(stop.allocation_id);
            }
          } else {
            if (seenPickups.has(stop.allocation_id)) {
              finalOrderedStops.push(stop);
            } else {
              pendingDropoffs.set(stop.allocation_id, stop);
            }
          }
        }

        for (const dropoff of pendingDropoffs.values()) {
          finalOrderedStops.push(dropoff);
        }

        // Insert route row
        const { data: newRoute, error: newRouteError } = await supabase
          .from('routes')
          .insert({
            volunteer_id: volunteerId,
            status: 'ASSIGNED',
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (newRouteError) {
          return res.status(500).json({ error: newRouteError.message });
        }

        // Insert route_stops
        const stopsToInsert = finalOrderedStops.map((stop, idx) => ({
          route_id: newRoute.id,
          allocation_id: stop.allocation_id,
          stop_order: idx + 1,
          stop_type: stop.stop_type,
          lat: stop.lat,
          lng: stop.lng,
          status: 'PENDING',
        }));

        let insertedStops = [];
        if (stopsToInsert.length > 0) {
          const { data: stopsResult, error: stopsError } = await supabase
            .from('route_stops')
            .insert(stopsToInsert)
            .select();

          if (stopsError) {
            return res.status(500).json({ error: stopsError.message });
          }
          insertedStops = stopsResult || [];
        }

        createdRoutes.push({
          ...newRoute,
          stops: insertedStops,
        });
      }

      return res.status(201).json({
        routes: createdRoutes,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// GET /routes/mine - Returns authenticated volunteer's own routes & stops
router.get(
  ['/routes/mine', '/mine'],
  async (req, res) => {
    try {
      const volunteerId = req.user.id;

      const { data: myRoutes, error: routesError } = await supabase
        .from('routes')
        .select('*')
        .eq('volunteer_id', volunteerId)
        .order('created_at', { ascending: false });

      if (routesError) {
        return res.status(500).json({ error: routesError.message });
      }

      if (!myRoutes || myRoutes.length === 0) {
        return res.json([]);
      }

      const routeIds = myRoutes.map((r) => r.id);
      const { data: allStops, error: stopsError } = await supabase
        .from('route_stops')
        .select('*')
        .in('route_id', routeIds)
        .order('stop_order', { ascending: true });

      if (stopsError) {
        return res.status(500).json({ error: stopsError.message });
      }

      const stopsByRoute = new Map();
      for (const stop of allStops || []) {
        if (!stopsByRoute.has(stop.route_id)) {
          stopsByRoute.set(stop.route_id, []);
        }
        stopsByRoute.get(stop.route_id).push(stop);
      }

      const response = myRoutes.map((r) => ({
        ...r,
        stops: stopsByRoute.get(r.id) || [],
      }));

      return res.json(response);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// PATCH /route-stops/:id - Sets route stop status to DONE (owning volunteer only)
router.patch(
  ['/route-stops/:id', '/:id'],
  async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Fetch route stop
      const { data: stop, error: stopError } = await supabase
        .from('route_stops')
        .select('*')
        .eq('id', id)
        .single();

      if (stopError || !stop) {
        return res.status(404).json({ error: 'Route stop not found' });
      }

      // 2. Fetch associated route to verify volunteer ownership
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select('*')
        .eq('id', stop.route_id)
        .single();

      if (routeError || !route) {
        return res.status(404).json({ error: 'Associated route not found' });
      }

      // Verify caller is the assigned volunteer (or admin)
      if (route.volunteer_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // 3. Update status to DONE
      const { data: updatedStop, error: updateError } = await supabase
        .from('route_stops')
        .update({ status: 'DONE' })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.json(updatedStop);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
