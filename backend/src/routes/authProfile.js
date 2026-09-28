const express = require('express');
const router = express.Router();
const supabase = require('../db/supabaseClient');
const { requireSession, requireAuth } = require('../middleware/auth');
const profileSchema = require('../validation/profileSchema');

// POST /api/auth/profile - Create profile for authenticated session
router.post(
  ['/profile', '/api/auth/profile'],
  requireSession,
  async (req, res) => {
    try {
      // Explicitly reject 'admin' role with 403 Forbidden
      if (req.body && req.body.role === 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Validate body with Zod schema
      const parseResult = profileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parseResult.error.errors,
        });
      }

      const { role, name, phone, address, lat, lng } = parseResult.data;

      // Check if profile already exists for this user
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', req.user.id)
        .single();

      if (existingProfile) {
        return res.status(409).json({ error: 'Profile already exists' });
      }

      // Insert new profile row with id = req.user.id
      const insertPayload = {
        id: req.user.id,
        role,
        name,
        phone: phone || null,
        address: address || null,
        lat: lat != null ? lat : null,
        lng: lng != null ? lng : null,
      };

      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          return res.status(409).json({ error: 'Profile already exists' });
        }
        return res.status(500).json({ error: insertError.message });
      }

      return res.status(201).json(createdProfile);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/auth/me - Retrieve caller's profile row
router.get(
  ['/me', '/api/auth/me'],
  requireAuth,
  async (req, res) => {
    try {
      if (req.user && req.user.profile) {
        return res.json(req.user.profile);
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', req.user.id)
        .single();

      if (error || !profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.json(profile);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
