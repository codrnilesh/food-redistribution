import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ErrorBox from '../components/ErrorBox';
import LocationPicker from '../components/LocationPicker';
import { CATEGORIES, UNITS } from '../lib/options';

export default function DonorDashboard() {
  // Donations state
  const [donations, setDonations] = useState([]);
  const [loadingDonations, setLoadingDonations] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [prepTime, setPrepTime] = useState('');
  const [expiryTime, setExpiryTime] = useState('');
  const [coords, setCoords] = useState({ lat: '', lng: '' });

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Fetch donor's donations
  const loadDonations = useCallback(async () => {
    try {
      setLoadingDonations(true);
      const data = await apiGet('/donations');
      setDonations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load donations');
    } finally {
      setLoadingDonations(false);
    }
  }, []);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

  // Handle donation form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    const numQuantity = parseFloat(quantity);
    if (!quantity || isNaN(numQuantity) || numQuantity <= 0) {
      setError('Quantity must be a positive number greater than 0');
      return;
    }

    if (!expiryTime) {
      setError('Expiry time is required');
      return;
    }

    const expiryDate = new Date(expiryTime);
    if (isNaN(expiryDate.getTime()) || expiryDate.getTime() <= Date.now()) {
      setError('Expiry time must be in the future');
      return;
    }

    if (
      coords.lat === '' ||
      coords.lng === '' ||
      coords.lat == null ||
      coords.lng == null ||
      isNaN(parseFloat(coords.lat)) ||
      isNaN(parseFloat(coords.lng))
    ) {
      setError('Location coordinates (latitude and longitude) are required');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        category,
        original_quantity: numQuantity,
        unit,
        expiry_time: new Date(expiryTime).toISOString(),
        lat: parseFloat(coords.lat),
        lng: parseFloat(coords.lng),
      };

      if (description.trim()) {
        payload.description = description.trim();
      }

      if (prepTime) {
        payload.prep_time = new Date(prepTime).toISOString();
      }

      await apiPost('/donations', payload);

      // Reset form on success
      setCategory(CATEGORIES[0]);
      setDescription('');
      setQuantity('');
      setUnit(UNITS[0]);
      setPrepTime('');
      setExpiryTime('');
      setCoords({ lat: '', lng: '' });

      // Reload donations list
      await loadDonations();
    } catch (err) {
      setError(err.message || 'Failed to create donation');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle donation cancellation
  const handleCancel = async (id) => {
    const confirmed = window.confirm('Are you sure you want to cancel this donation?');
    if (!confirmed) return;

    setError('');
    setCancellingId(id);

    try {
      await apiPatch(`/donations/${id}`, { status: 'CANCELLED' });
      await loadDonations();
    } catch (err) {
      setError(err.message || 'Failed to cancel donation');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="dashboard-container">
      <h2>Donor Dashboard</h2>

      <ErrorBox message={error} />

      {/* New Donation Form */}
      <section className="card form-card">
        <h3>New Donation</h3>
        <form onSubmit={handleSubmit} className="donation-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="donation-category">Category</label>
              <select
                id="donation-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="donation-quantity">Quantity</label>
              <input
                id="donation-quantity"
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="donation-unit">Unit</label>
              <select
                id="donation-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={submitting}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="donation-prep-time">Prep Time (optional)</label>
              <input
                id="donation-prep-time"
                type="datetime-local"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="donation-expiry-time">Expiry Time</label>
              <input
                id="donation-expiry-time"
                type="datetime-local"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="donation-description">Description (optional)</label>
            <input
              id="donation-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 20 freshly boxed vegetable curries"
              disabled={submitting}
            />
          </div>

          <LocationPicker
            lat={coords.lat}
            lng={coords.lng}
            onChange={(newCoords) => setCoords(newCoords)}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? 'Submitting donation…' : 'Create Donation'}
          </button>
        </form>
      </section>

      {/* My Donations List */}
      <section className="card list-card">
        <h3>My Donations</h3>

        {loadingDonations && donations.length === 0 ? (
          <p className="loading-text">Loading donations…</p>
        ) : donations.length === 0 ? (
          <p className="empty-message">No donations yet</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Original Quantity</th>
                  <th>Remaining Quantity</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <code title={d.id}>{d.id.length > 8 ? `${d.id.slice(0, 8)}…` : d.id}</code>
                    </td>
                    <td>{d.category}</td>
                    <td>
                      {d.original_quantity} {d.unit}
                    </td>
                    <td>
                      {d.remaining_quantity} {d.unit}
                    </td>
                    <td>{new Date(d.expiry_time).toLocaleString()}</td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      {d.status === 'AVAILABLE' ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm btn-danger-hover"
                          disabled={cancellingId === d.id}
                          onClick={() => handleCancel(d.id)}
                        >
                          {cancellingId === d.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
