const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireRole } = require('../middleware/auth');
const haversineKm = require('../algorithms/haversine');
const computeHubDistanceMatrix = require('../algorithms/hubDistances');
const findExactBundle = require('../algorithms/exactBundleFinder');

/**
 * Calculates straight-line and hub road distance between donation and request.
 */
function getDistanceKm(donation, request, hubDistanceMatrix, hubs = []) {
  if (!donation || !request) return 0;

  const donorCoords =
    donation.lat != null && donation.lng != null
      ? { lat: Number(donation.lat), lng: Number(donation.lng) }
      : null;
  const requestCoords =
    request.lat != null && request.lng != null
      ? { lat: Number(request.lat), lng: Number(request.lng) }
      : null;

  const donorHubId = donation.nearest_hub_id;
  const requestHubId = request.nearest_hub_id;

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

  return Math.round((donorSpoke + hubDist + requestSpoke) * 100) / 100;
}

// POST /requests/:id/exact-bundle (or /:id/exact-bundle) - Admin only
router.post(
  ['/requests/:id/exact-bundle', '/:id/exact-bundle'],
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const nowIso = new Date().toISOString();

      // 1. Load the request
      const { data: request, error: reqError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', id)
        .single();

      if (reqError || !request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (Number(request.remaining_quantity || 0) <= 0) {
        return res.json({
          request_id: request.id,
          target_quantity: 0,
          achieved_sum: 0,
          is_exact_match: false,
          selected_batch_ids: [],
          selected_batches: [],
          status: 'PROPOSED',
        });
      }

      // 2. Load unallocated candidate donation batches with matching category
      const { data: candidateDonations, error: donError } = await supabase
        .from('donations')
        .select('*')
        .in('status', ['AVAILABLE', 'PARTIALLY_ALLOCATED'])
        .gt('remaining_quantity', 0)
        .gt('expiry_time', nowIso);

      if (donError) {
        return res.status(500).json({ error: donError.message });
      }

      // 3. Load hubs and hub edges to compute distance matrix
      const { data: hubs } = await supabase.from('hubs').select('*');
      const { data: hubEdges } = await supabase.from('hub_edges').select('*');
      const hubDistanceMatrix = computeHubDistanceMatrix(hubs || [], hubEdges || []);

      // 4. Filter donations by eligibility rules (category, expiry, radius <= 15 km)
      const neededByMs = new Date(request.needed_by).getTime();
      const eligibleDonations = (candidateDonations || []).filter((d) => {
        // Matching category
        if (
          !d.category ||
          !request.category ||
          d.category.trim().toLowerCase() !== request.category.trim().toLowerCase()
        ) {
          return false;
        }

        // Expiry allows delivery before needed_by
        const expiryMs = new Date(d.expiry_time).getTime();
        if (isNaN(expiryMs) || isNaN(neededByMs) || expiryMs < neededByMs) {
          return false;
        }

        // Total distance within 15 km
        const dist = getDistanceKm(d, request, hubDistanceMatrix, hubs || []);
        d.distance_km = dist;
        return dist <= 15;
      });

      // Map to candidate batches format { id, quantity }
      let candidateBatches = eligibleDonations.map((d) => ({
        id: d.id,
        quantity: Number(d.remaining_quantity),
        distance_km: d.distance_km,
        donation: d,
      }));

      // Sort by distance and quantity, capping at top 25 to respect subset sum constraint
      if (candidateBatches.length > 25) {
        candidateBatches = candidateBatches
          .sort((a, b) => a.distance_km - b.distance_km || b.quantity - a.quantity)
          .slice(0, 25);
      }

      // 5. Run exact bundle finder
      const bundleResult = findExactBundle(
        Number(request.remaining_quantity),
        candidateBatches
      );

      const selectedIdSet = new Set(bundleResult.selectedBatchIds);
      const selectedBatches = candidateBatches
        .filter((b) => selectedIdSet.has(b.id))
        .map((b) => ({
          ...b.donation,
          allocated_quantity: b.quantity,
          distance_km: b.distance_km,
        }));

      return res.json({
        request_id: request.id,
        target_quantity: Number(request.remaining_quantity),
        achieved_sum: bundleResult.achievedSum,
        is_exact_match: bundleResult.isExactMatch,
        selected_batch_ids: bundleResult.selectedBatchIds,
        selected_batches: selectedBatches,
        status: 'PROPOSED',
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
