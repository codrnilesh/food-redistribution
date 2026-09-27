/**
 * Assumptions on Delivery Speed and Job Windows:
 * - Constant Urban Transit Speed: We assume an average delivery vehicle speed of 30 km/h
 *   (0.5 km per minute) across city roads and distribution corridors.
 * - Job Duration: Derived as duration (hours) = distance_km / 30 km/h.
 *   If distance_km is not provided, a default window duration of 30 minutes (0.5 hours) is used.
 * - Start Offset: Unless explicit { start, end } or start_time is provided on the allocation,
 *   the start time defaults to 0 (or hours offset from the batch dispatch reference time).
 */
const DEFAULT_SPEED_KM_H = 30;

/**
 * Computes or retrieves the job window { start, end } for an allocation.
 *
 * @param {Object} allocation Delivery allocation object
 * @param {number} [speedKmH=30] Assumed constant transit speed in km/h
 * @returns {{ start: number, end: number }} Estimated job window in hours
 */
function getJobWindow(allocation, speedKmH = DEFAULT_SPEED_KM_H) {
  // If explicit start and end are provided (e.g., in unit tests or pre-scheduled runs), use them
  if (allocation.start !== undefined && allocation.end !== undefined) {
    return { start: Number(allocation.start), end: Number(allocation.end) };
  }
  if (
    allocation.window &&
    allocation.window.start !== undefined &&
    allocation.window.end !== undefined
  ) {
    return { start: Number(allocation.window.start), end: Number(allocation.window.end) };
  }

  // Derive duration from distance_km assuming constant vehicle speed
  const dist = Number(allocation.distance_km);
  const durationHours = !isNaN(dist) && dist > 0 ? dist / speedKmH : 0.5;
  const start = Number(allocation.start_time !== undefined ? allocation.start_time : 0);

  return {
    start,
    end: start + durationHours,
  };
}

/**
 * =========================================================================
 * TEXTBOOK ALGORITHM: Classical Greedy Activity Selection (Single-Volunteer Core)
 * =========================================================================
 * Formulated by greedy choice:
 * 1. Sort candidate activities in non-decreasing order of finish (end) times.
 * 2. Greedily select the first activity (earliest finishing job).
 * 3. Iteratively inspect remaining activities; select the next activity whose
 *    start time is greater than or equal to the finish time of the last selected job.
 * This guarantees an optimal (maximum cardinality) mutually compatible set for a single agent.
 *
 * @param {Array<Object>} jobs List of jobs with .window = { start, end }
 * @returns {Array<Object>} Subset of non-overlapping jobs maximizing completed deliveries
 */
function selectCompatibleActivities(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return [];
  }

  // 1. Sort by earliest end time ascending
  const sorted = jobs.slice().sort((a, b) => a.window.end - b.window.end);

  // 2. Greedily pick the earliest finishing activity
  const selected = [sorted[0]];
  let lastEndTime = sorted[0].window.end;

  // 3. Select subsequent compatible activities
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].window.start >= lastEndTime) {
      selected.push(sorted[i]);
      lastEndTime = sorted[i].window.end;
    }
  }

  return selected;
}

/**
 * =========================================================================
 * MULTI-VOLUNTEER WRAPPER: Iterative Multi-Agent Scheduling Loop
 * =========================================================================
 * Given a list of volunteers (in their priority or sign-up order):
 * For each volunteer in turn:
 *   - Execute the single-volunteer greedy activity selection core on the remaining
 *     unassigned pool of allocations.
 *   - Assign the chosen batch to that volunteer.
 *   - Remove the chosen jobs from the pool so subsequent volunteers receive
 *     the remaining tasks.
 * Finally, any tasks that could not be scheduled within any volunteer's schedule
 * are recorded as unassigned.
 *
 * @param {Array<Object>} confirmedAllocations List of confirmed allocation objects
 * @param {Array<Object|string|number>} volunteers List of available volunteer objects or IDs
 * @param {Object} [options={}] Optional configuration (e.g. speedKmH)
 * @returns {{ assignments: Array<{volunteerId: string|number, allocationIds: Array<string|number>}>, unassignedAllocationIds: Array<string|number> }}
 */
function scheduleDeliveries(confirmedAllocations = [], volunteers = [], options = {}) {
  const speed = options.speedKmH || DEFAULT_SPEED_KM_H;

  // Pre-calculate job windows for all allocations
  let remainingPool = confirmedAllocations.map((alloc) => ({
    ...alloc,
    window: getJobWindow(alloc, speed),
  }));

  const assignments = [];

  for (const volunteer of volunteers) {
    const volunteerId =
      volunteer && typeof volunteer === 'object' && 'id' in volunteer
        ? volunteer.id
        : volunteer;

    // Run the textbook activity selection on remaining unassigned allocations
    const chosenJobs = selectCompatibleActivities(remainingPool);
    const chosenIds = chosenJobs.map((job) => job.id);

    assignments.push({
      volunteerId,
      allocationIds: chosenIds,
    });

    // Remove assigned jobs from the remaining pool
    const chosenSet = new Set(chosenIds);
    remainingPool = remainingPool.filter((job) => !chosenSet.has(job.id));
  }

  const unassignedAllocationIds = remainingPool.map((job) => job.id);

  return {
    assignments,
    unassignedAllocationIds,
  };
}

scheduleDeliveries.scheduleDeliveries = scheduleDeliveries;
scheduleDeliveries.getJobWindow = getJobWindow;
module.exports = scheduleDeliveries;
module.exports.scheduleDeliveries = scheduleDeliveries;
