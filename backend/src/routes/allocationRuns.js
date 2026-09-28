const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireRole } = require('../middleware/auth');
const haversineKm = require('../algorithms/haversine');
const computeHubDistanceMatrix = require('../algorithms/hubDistances');
const buildEligibilityGraph = require('../algorithms/eligibilityGraph');
const sortRequestsByPriority = require('../algorithms/prioritySort');
const runMaxFlowAllocation = require('../algorithms/maxFlowAllocation');

/**
 * Helper to compute distance in km between a donation and request via hubs.
 */
function calculateDistanceKm(d, r, hubDistanceMatrix, hubs = []) {
  if (!d || !r) return 0;

  const donorCoords = d.lat != null && d.lng != null ? { lat: Number(d.lat), lng: Number(d.lng) } : null;
  const requestCoords = r.lat != null && r.lng != null ? { lat: Number(r.lat), lng: Number(r.lng) } : null;

  const donorHubId = d.nearest_hub_id;
  const requestHubId = r.nearest_hub_id;

  const donorHub = Array.isArray(hubs) ? hubs.find((h) => h.id === donorHubId) : null;
  const requestHub = Array.isArray(hubs) ? hubs.find((h) => h.id === requestHubId) : null;

  const donorSpoke =
    donorCoords && donorHub && donorHub.lat != null && donorHub.lng != null
      ? haversineKm(donorCoords.lat, donorCoords.lng, Number(donorHub.lat), Number(donorHub.lng))
      : 0;

  const requestSpoke =
    requestCoords && requestHub && requestHub.lat != null && requestHub.lng != null
      ? haversineKm(requestCoords.lat, requestCoords.lng, Number(requestHub.lat), Number(requestHub.lng))
      : 0;

  let hubDist = 0;
  if (
    donorHubId !== requestHubId &&
    hubDistanceMatrix &&
    hubDistanceMatrix[donorHubId] &&
    hubDistanceMatrix[donorHubId][requestHubId] !== undefined
  ) {
    const val = Number(hubDistanceMatrix[donorHubId][requestHubId]);
    hubDist = val !== Infinity ? val : 0;
  }

  const total = donorSpoke + hubDist + requestSpoke;
  return Math.round(total * 100) / 100;
}

// POST / - Trigger an allocation run (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const nowIso = new Date().toISOString();

    // 1. Load active donations with remaining_quantity > 0 and not expired
    const { data: donations, error: donError } = await supabase
      .from('donations')
      .select('*')
      .in('status', ['AVAILABLE', 'PARTIALLY_ALLOCATED'])
      .gt('remaining_quantity', 0)
      .gt('expiry_time', nowIso);

    if (donError) {
      return res.status(500).json({ error: donError.message });
    }

    // 2. Load active requests with remaining_quantity > 0 and not expired
    const { data: requests, error: reqError } = await supabase
      .from('requests')
      .select('*')
      .in('status', ['OPEN', 'PARTIALLY_FULFILLED'])
      .gt('remaining_quantity', 0)
      .gt('needed_by', nowIso);

    if (reqError) {
      return res.status(500).json({ error: reqError.message });
    }

    // 3. Load hubs and hub edges
    const { data: hubs, error: hubsError } = await supabase.from('hubs').select('*');
    if (hubsError) {
      return res.status(500).json({ error: hubsError.message });
    }

    const { data: hubEdges, error: edgesError } = await supabase.from('hub_edges').select('*');
    if (edgesError) {
      return res.status(500).json({ error: edgesError.message });
    }

    // 4. Compute all-pairs shortest hub road distances (Floyd–Warshall)
    const hubDistanceMatrix = computeHubDistanceMatrix(hubs || [], hubEdges || []);

    // 5. Build eligibility graph
    const eligibilityResult = buildEligibilityGraph(
      donations || [],
      requests || [],
      hubDistanceMatrix,
      { hubs: hubs || [], maxRadiusKm: 15 }
    );

    // 6. Sort requests by priority score descending (Merge Sort)
    const sortedRequests = sortRequestsByPriority(requests || []);
    const priorityOrderedRequestIds = sortedRequests.map((r) => r.id);

    // 7. Run Edmonds-Karp max-flow allocation
    const { edges } = runMaxFlowAllocation(
      donations || [],
      requests || [],
      eligibilityResult.adjacency,
      priorityOrderedRequestIds
    );

    // 8. Insert one allocation_runs row with status PROPOSED
    const { data: run, error: runError } = await supabase
      .from('allocation_runs')
      .insert({
        triggered_by: req.user.id,
        status: 'PROPOSED',
        run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runError) {
      return res.status(500).json({ error: runError.message });
    }

    // 9. Insert allocations rows with status PROPOSED and distance_km
    const donationMap = new Map((donations || []).map((d) => [d.id, d]));
    const requestMap = new Map((requests || []).map((r) => [r.id, r]));

    const allocationsToInsert = edges.map((edge) => {
      const d = donationMap.get(edge.donation_id);
      const r = requestMap.get(edge.request_id);
      const distance_km = calculateDistanceKm(d, r, hubDistanceMatrix, hubs || []);

      return {
        run_id: run.id,
        donation_id: edge.donation_id,
        request_id: edge.request_id,
        allocated_quantity: edge.allocated_quantity,
        distance_km,
        status: 'PROPOSED',
      };
    });

    let createdAllocations = [];
    if (allocationsToInsert.length > 0) {
      const { data: insertedAllocations, error: allocInsertError } = await supabase
        .from('allocations')
        .insert(allocationsToInsert)
        .select();

      if (allocInsertError) {
        return res.status(500).json({ error: allocInsertError.message });
      }
      createdAllocations = insertedAllocations || [];
    }

    return res.status(201).json({
      ...run,
      allocations: createdAllocations,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET / - List 20 most recent allocation runs with allocation count (admin only)
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { data: runs, error: runsError } = await supabase
      .from('allocation_runs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(20);

    if (runsError) {
      return res.status(500).json({ error: runsError.message });
    }

    if (!runs || runs.length === 0) {
      return res.json([]);
    }

    const runIds = runs.map((r) => r.id);
    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select('id, run_id')
      .in('run_id', runIds);

    if (allocError) {
      return res.status(500).json({ error: allocError.message });
    }

    const counts = new Map();
    for (const a of allocations || []) {
      counts.set(a.run_id, (counts.get(a.run_id) || 0) + 1);
    }

    const response = runs.map((r) => ({
      id: r.id,
      run_at: r.run_at,
      status: r.status,
      notes: r.notes !== undefined ? r.notes : null,
      allocation_count: counts.get(r.id) || 0,
      allocations_count: counts.get(r.id) || 0,
      count: counts.get(r.id) || 0,
    }));

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /:id - Retrieve an allocation run and its allocations
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: run, error: runError } = await supabase
      .from('allocation_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      return res.status(404).json({ error: 'Allocation run not found' });
    }

    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select('*')
      .eq('run_id', id);

    if (allocError) {
      return res.status(500).json({ error: allocError.message });
    }

    return res.json({
      ...run,
      allocations: allocations || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /:id/confirm - Confirm an allocation run and update remaining quantities
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: run, error: runError } = await supabase
      .from('allocation_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      return res.status(404).json({ error: 'Allocation run not found' });
    }

    // Fetch allocations for this run
    const { data: allocations, error: allocError } = await supabase
      .from('allocations')
      .select('*')
      .eq('run_id', id);

    if (allocError) {
      return res.status(500).json({ error: allocError.message });
    }

    const allocList = allocations || [];
    const donationIds = [...new Set(allocList.map((a) => a.donation_id))];
    const requestIds = [...new Set(allocList.map((a) => a.request_id))];

    // Re-read current remaining_quantity for every involved donation & request
    const { data: freshDonations, error: freshDError } =
      donationIds.length > 0
        ? await supabase.from('donations').select('*').in('id', donationIds)
        : { data: [], error: null };

    if (freshDError) {
      return res.status(500).json({ error: freshDError.message });
    }

    const { data: freshRequests, error: freshRError } =
      requestIds.length > 0
        ? await supabase.from('requests').select('*').in('id', requestIds)
        : { data: [], error: null };

    if (freshRError) {
      return res.status(500).json({ error: freshRError.message });
    }

    const donationMap = new Map((freshDonations || []).map((d) => [d.id, { ...d }]));
    const requestMap = new Map((freshRequests || []).map((r) => [r.id, { ...r }]));

    const confirmedAllocations = [];
    const skipped = [];
    const nowIso = new Date().toISOString();

    for (const alloc of allocList) {
      const d = donationMap.get(alloc.donation_id);
      const r = requestMap.get(alloc.request_id);

      if (
        d &&
        r &&
        d.remaining_quantity >= alloc.allocated_quantity &&
        r.remaining_quantity >= alloc.allocated_quantity
      ) {
        // Both have enough remaining quantity: decrement running totals
        d.remaining_quantity -= alloc.allocated_quantity;
        r.remaining_quantity -= alloc.allocated_quantity;

        // Update donation in database
        const newDStatus = d.remaining_quantity === 0 ? 'FULLY_ALLOCATED' : 'PARTIALLY_ALLOCATED';
        await supabase
          .from('donations')
          .update({
            remaining_quantity: d.remaining_quantity,
            status: newDStatus,
          })
          .eq('id', d.id);

        // Update request in database
        const newRStatus = r.remaining_quantity === 0 ? 'FULFILLED' : 'PARTIALLY_FULFILLED';
        await supabase
          .from('requests')
          .update({
            remaining_quantity: r.remaining_quantity,
            status: newRStatus,
          })
          .eq('id', r.id);

        // Mark allocation CONFIRMED
        const { data: updatedAlloc } = await supabase
          .from('allocations')
          .update({
            status: 'CONFIRMED',
            confirmed_at: nowIso,
          })
          .eq('id', alloc.id)
          .select()
          .single();

        confirmedAllocations.push(updatedAlloc || { ...alloc, status: 'CONFIRMED', confirmed_at: nowIso });
      } else {
        // Not enough quantity remaining: leave as is and add to skipped list
        skipped.push(alloc);
      }
    }

    // Set allocation_runs.status = CONFIRMED
    const { data: updatedRun, error: updateRunError } = await supabase
      .from('allocation_runs')
      .update({ status: 'CONFIRMED' })
      .eq('id', id)
      .select()
      .single();

    if (updateRunError) {
      return res.status(500).json({ error: updateRunError.message });
    }

    // Fetch full set of allocations for response
    const { data: finalAllocs } = await supabase.from('allocations').select('*').eq('run_id', id);

    return res.json({
      ...(updatedRun || run),
      allocations: finalAllocs || [...confirmedAllocations, ...skipped],
      skipped,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /:id/discard - Discard an allocation run and its proposed allocations
router.post('/:id/discard', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: run, error: runError } = await supabase
      .from('allocation_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (runError || !run) {
      return res.status(404).json({ error: 'Allocation run not found' });
    }

    // Set all its PROPOSED allocations to DISCARDED
    await supabase
      .from('allocations')
      .update({ status: 'DISCARDED' })
      .eq('run_id', id)
      .eq('status', 'PROPOSED');

    // Set allocation_runs.status = DISCARDED
    const { data: updatedRun, error: updateRunError } = await supabase
      .from('allocation_runs')
      .update({ status: 'DISCARDED' })
      .eq('id', id)
      .select()
      .single();

    if (updateRunError) {
      return res.status(500).json({ error: updateRunError.message });
    }

    const { data: allocations } = await supabase
      .from('allocations')
      .select('*')
      .eq('run_id', id);

    return res.json({
      ...(updatedRun || run),
      allocations: allocations || [],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
