const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireRole } = require('../middleware/auth');
const { donationSchema } = require('../validation/donationSchema');
const { haversineKm } = require('../algorithms/haversine');

// GET / - donor sees only their own rows; admin sees all
router.get('/', async (req, res) => {
  try {
    let query = supabase.from('donations').select('*');

    if (req.user.role === 'admin') {
      // admin sees all
    } else if (req.user.role === 'donor') {
      query = query.eq('donor_id', req.user.id);
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

// POST / - donor only, validate with zod, set remaining_quantity = original_quantity, compute nearest_hub_id
router.post('/', requireRole('donor'), async (req, res) => {
  try {
    const parseResult = donationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const { category, description, original_quantity, unit, expiry_time, lat, lng } = parseResult.data;

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

    const formattedExpiry = typeof expiry_time === 'string'
      ? new Date(expiry_time).toISOString()
      : expiry_time.toISOString();

    const insertPayload = {
      donor_id: req.user.id,
      category,
      description: description || null,
      original_quantity,
      remaining_quantity: original_quantity,
      unit,
      expiry_time: formattedExpiry,
      lat,
      lng,
      nearest_hub_id,
      status: 'AVAILABLE',
    };

    const { data, error } = await supabase
      .from('donations')
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

// PATCH /:id - owner only, can only update description/status to CANCELLED, cannot change quantities directly
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: donation, error: fetchError } = await supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    // Owner only check
    if (donation.donor_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Cannot change quantities directly
    if (req.body.original_quantity !== undefined || req.body.remaining_quantity !== undefined) {
      return res.status(400).json({ error: 'Cannot change quantities directly' });
    }

    // Can only update description and/or status to CANCELLED
    if (req.body.status !== undefined && req.body.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Status can only be updated to CANCELLED' });
    }

    const updates = {};
    if (req.body.description !== undefined) {
      updates.description = req.body.description;
    }
    if (req.body.status === 'CANCELLED') {
      updates.status = 'CANCELLED';
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    const { data: updatedDonation, error: updateError } = await supabase
      .from('donations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json(updatedDonation);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
