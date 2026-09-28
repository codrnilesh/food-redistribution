const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireRole } = require('../middleware/auth');
const { requestSchema } = require('../validation/requestSchema');
const { haversineKm } = require('../algorithms/haversine');

// GET / - recipient sees only their own rows; admin sees all
router.get('/', async (req, res) => {
  try {
    const nowIso = new Date().toISOString();

    // Auto-expire active requests whose needed_by time has passed
    await supabase
      .from('requests')
      .update({ status: 'EXPIRED' })
      .in('status', ['OPEN', 'PARTIALLY_FULFILLED'])
      .lt('needed_by', nowIso);

    let query = supabase.from('requests').select('*');

    if (req.user.role === 'admin') {
      // admin sees all
    } else if (req.user.role === 'recipient') {
      query = query.eq('recipient_id', req.user.id);
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST / - recipient only, validate with zod, set remaining_quantity = original_quantity, compute nearest_hub_id
router.post('/', requireRole('recipient'), async (req, res) => {
  try {
    const parseResult = requestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { category, original_quantity, unit, urgency_level, needed_by, lat, lng } = parseResult.data;

    // Find nearest hub
    const { data: hubs, error: hubsError } = await supabase
      .from('hubs')
      .select('id, lat, lng');

    if (hubsError) {
      return res.status(500).json({ error: hubsError.message });
    }

    let nearest_hub_id = null;
    if (Array.isArray(hubs) && hubs.length > 0) {
      let minDistance = Infinity;
      for (const hub of hubs) {
        if (hub.lat != null && hub.lng != null) {
          const dist = haversineKm(lat, lng, Number(hub.lat), Number(hub.lng));
          if (dist < minDistance) {
            minDistance = dist;
            nearest_hub_id = hub.id;
          }
        }
      }
    }

    const formattedNeededBy = typeof needed_by === 'string'
      ? new Date(needed_by).toISOString()
      : needed_by.toISOString();

    const insertPayload = {
      recipient_id: req.user.id,
      category,
      original_quantity,
      remaining_quantity: original_quantity,
      unit,
      urgency_level,
      needed_by: formattedNeededBy,
      lat,
      lng,
      nearest_hub_id,
      status: 'OPEN',
    };

    const { data, error } = await supabase
      .from('requests')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /:id - owner only, can only update status to CANCELLED, cannot change quantities directly
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: requestItem, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !requestItem) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Owner only check
    if (requestItem.recipient_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Cannot change quantities directly
    if (req.body.original_quantity !== undefined || req.body.remaining_quantity !== undefined) {
      return res.status(400).json({ error: 'Cannot change quantities directly' });
    }

    // Can only update status to CANCELLED
    if (req.body.status !== undefined && req.body.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Status can only be updated to CANCELLED' });
    }

    // Cannot cancel an expired request
    const isExpired =
      requestItem.status === 'EXPIRED' ||
      (requestItem.needed_by && new Date(requestItem.needed_by).getTime() <= Date.now());
    if (isExpired && req.body.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot cancel an expired request' });
    }

    const updates = {};
    if (req.body.status === 'CANCELLED') {
      updates.status = 'CANCELLED';
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json(updatedRequest);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
