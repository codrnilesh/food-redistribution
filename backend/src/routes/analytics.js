const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireRole } = require('../middleware/auth');
const quickselectMedian = require('../algorithms/quickselect');

// GET /analytics/summary (Admin only)
router.get(
  ['/analytics/summary', '/summary'],
  requireRole('admin'),
  async (req, res) => {
    try {
      // 1. Fetch donations to aggregate counts by status
      const { data: donations, error: donError } = await supabase
        .from('donations')
        .select('status, original_quantity, remaining_quantity, expiry_time');

      if (donError) {
        return res.status(500).json({ error: donError.message });
      }

      const donationsByStatus = {};
      const nowMs = Date.now();
      for (const d of donations || []) {
        const isExpired =
          d.status !== 'CANCELLED' &&
          d.status !== 'FULLY_ALLOCATED' &&
          (d.status === 'EXPIRED' ||
            (d.expiry_time && new Date(d.expiry_time).getTime() <= nowMs));
        const effectiveStatus = isExpired ? 'EXPIRED' : d.status;
        donationsByStatus[effectiveStatus] = (donationsByStatus[effectiveStatus] || 0) + 1;
      }

      // 2. Fetch requests to aggregate counts by status
      const { data: requests, error: reqError } = await supabase
        .from('requests')
        .select('status, original_quantity, remaining_quantity, needed_by');

      if (reqError) {
        return res.status(500).json({ error: reqError.message });
      }

      const requestsByStatus = {};
      for (const r of requests || []) {
        const isExpired =
          r.status !== 'CANCELLED' &&
          r.status !== 'FULFILLED' &&
          (r.status === 'EXPIRED' ||
            (r.needed_by && new Date(r.needed_by).getTime() <= nowMs));
        const effectiveStatus = isExpired ? 'EXPIRED' : r.status;
        requestsByStatus[effectiveStatus] = (requestsByStatus[effectiveStatus] || 0) + 1;
      }

      // 3. Fetch allocations to calculate total allocated and median metrics
      const { data: allocations, error: allocError } = await supabase
        .from('allocations')
        .select('*');

      if (allocError) {
        return res.status(500).json({ error: allocError.message });
      }

      const allocList = allocations || [];

      // Total quantity allocated to date (confirmed allocations or all allocations)
      const confirmedAllocations = allocList.filter((a) => a.status === 'CONFIRMED');
      const totalAllocated = (
        confirmedAllocations.length > 0 ? confirmedAllocations : allocList
      ).reduce((sum, a) => sum + Number(a.allocated_quantity || 0), 0);

      // Median allocation distance_km using Quickselect
      const distances = allocList
        .map((a) => Number(a.distance_km))
        .filter((d) => !isNaN(d) && d > 0);
      const medianDistanceKm = quickselectMedian(distances);

      // Median time-to-confirm in minutes using Quickselect
      const timesToConfirmMinutes = confirmedAllocations
        .filter((a) => a.confirmed_at && a.created_at)
        .map((a) => {
          const startMs = new Date(a.created_at).getTime();
          const endMs = new Date(a.confirmed_at).getTime();
          return (endMs - startMs) / (1000 * 60);
        })
        .filter((t) => !isNaN(t) && t >= 0);

      const medianTimeToConfirmMinutes = quickselectMedian(timesToConfirmMinutes);

      return res.json({
        donations_by_status: donationsByStatus,
        requests_by_status: requestsByStatus,
        total_quantity_allocated: totalAllocated,
        total_quantity_allocated_to_date: totalAllocated,
        median_allocation_distance_km: medianDistanceKm,
        median_time_to_confirm_minutes: medianTimeToConfirmMinutes,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
