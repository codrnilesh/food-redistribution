import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPatch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ErrorBox from '../components/ErrorBox';
import LocationPicker from '../components/LocationPicker';
import { CATEGORIES, UNITS, URGENCY_OPTIONS } from '../lib/options';

export default function RecipientDashboard() {
  // Requests state
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(UNITS[0]);
  const [urgencyLevel, setUrgencyLevel] = useState(1);
  const [neededBy, setNeededBy] = useState('');
  const [coords, setCoords] = useState({ lat: '', lng: '' });

  // Action states
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Fetch recipient's requests
  const loadRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const data = await apiGet('/requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle request form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validations
    const numQuantity = parseFloat(quantity);
    if (!quantity || isNaN(numQuantity) || numQuantity <= 0) {
      setError('Quantity must be a positive number greater than 0');
      return;
    }

    if (!neededBy) {
      setError('Needed-by time is required');
      return;
    }

    const neededByDate = new Date(neededBy);
    if (isNaN(neededByDate.getTime()) || neededByDate.getTime() <= Date.now()) {
      setError('Needed-by time must be in the future');
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
        urgency_level: Number(urgencyLevel),
        needed_by: new Date(neededBy).toISOString(),
        lat: parseFloat(coords.lat),
        lng: parseFloat(coords.lng),
      };

      await apiPost('/requests', payload);

      // Reset form on success
      setCategory(CATEGORIES[0]);
      setQuantity('');
      setUnit(UNITS[0]);
      setUrgencyLevel(1);
      setNeededBy('');
      setCoords({ lat: '', lng: '' });

      // Reload requests list
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle request cancellation
  const handleCancel = async (id) => {
    const confirmed = window.confirm('Are you sure you want to cancel this request?');
    if (!confirmed) return;

    setError('');
    setCancellingId(id);

    try {
      await apiPatch(`/requests/${id}`, { status: 'CANCELLED' });
      await loadRequests();
    } catch (err) {
      setError(err.message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const formatUrgency = (level) => {
    const opt = URGENCY_OPTIONS.find((o) => o.value === level);
    return opt ? opt.label : level;
  };

  return (
    <div className="dashboard-container">
      <h2>Recipient Dashboard</h2>

      <ErrorBox message={error} />

      {/* New Request Form */}
      <section className="card form-card">
        <h3>New Request</h3>
        <form onSubmit={handleSubmit} className="donation-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="request-category">Category</label>
              <select
                id="request-category"
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
              <label htmlFor="request-quantity">Quantity</label>
              <input
                id="request-quantity"
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 15"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="request-unit">Unit</label>
              <select
                id="request-unit"
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
              <label htmlFor="request-urgency">Urgency</label>
              <select
                id="request-urgency"
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(Number(e.target.value))}
                disabled={submitting}
              >
                {URGENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="request-needed-by">Needed By</label>
              <input
                id="request-needed-by"
                type="datetime-local"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
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
            {submitting ? 'Submitting request…' : 'Create Request'}
          </button>
        </form>
      </section>

      {/* My Requests List */}
      <section className="card list-card">
        <h3>My Requests</h3>

        {loadingRequests && requests.length === 0 ? (
          <p className="loading-text">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="empty-message">No requests yet</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Category</th>
                  <th>Original Qty</th>
                  <th>Remaining Qty</th>
                  <th>Urgency</th>
                  <th>Needed By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code title={r.id}>{r.id.length > 8 ? `${r.id.slice(0, 8)}…` : r.id}</code>
                    </td>
                    <td>{r.category}</td>
                    <td>
                      {r.original_quantity} {r.unit}
                    </td>
                    <td>
                      {r.remaining_quantity} {r.unit}
                    </td>
                    <td>{formatUrgency(r.urgency_level)}</td>
                    <td>{new Date(r.needed_by).toLocaleString()}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      {r.status === 'OPEN' ? (
                        <button
                          type="button"
                          className="btn-secondary btn-sm btn-danger-hover"
                          disabled={cancellingId === r.id}
                          onClick={() => handleCancel(r.id)}
                        >
                          {cancellingId === r.id ? 'Cancelling…' : 'Cancel'}
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
