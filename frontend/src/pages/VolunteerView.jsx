import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ErrorBox from '../components/ErrorBox';

export default function VolunteerView() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStopId, setUpdatingStopId] = useState(null);

  const loadRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet('/routes/mine');
      setRoutes(Array.isArray(data) ? data : (Array.isArray(data?.routes) ? data.routes : []));
    } catch (err) {
      setError(err.message || 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const handleMarkDone = async (stopId) => {
    setError('');
    setUpdatingStopId(stopId);

    try {
      await apiPatch(`/route-stops/${stopId}`, { status: 'DONE' });
      await loadRoutes();
    } catch (err) {
      setError(err.message || 'Failed to update stop status');
    } finally {
      setUpdatingStopId(null);
    }
  };

  const isBusy = loading || updatingStopId !== null;

  return (
    <div className="dashboard-container">
      <div className="view-header">
        <h2>Volunteer View</h2>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={loadRoutes}
          disabled={isBusy}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <ErrorBox message={error} />

      {loading && routes.length === 0 ? (
        <p className="loading-text">Loading assigned routes…</p>
      ) : routes.length === 0 ? (
        <div className="card">
          <p className="empty-message">No routes assigned yet.</p>
        </div>
      ) : (
        <div className="routes-list">
          {routes.map((route) => {
            const stops = Array.isArray(route.stops) ? route.stops : [];
            const sortedStops = [...stops].sort(
              (a, b) => (a.stop_order || 0) - (b.stop_order || 0)
            );
            const totalStops = sortedStops.length;
            const doneStops = sortedStops.filter((s) => s.status === 'DONE').length;

            return (
              <div key={route.id} className="card route-card">
                <div className="route-header">
                  <div className="route-title-group">
                    <h3>
                      Route <code className="route-id-code" title={route.id}>{route.id}</code>
                    </h3>
                    <StatusBadge status={route.status} />
                  </div>
                  <div className="route-meta">
                    <span className="route-date">
                      Created: {route.created_at ? new Date(route.created_at).toLocaleString() : 'N/A'}
                    </span>
                    <span className="route-progress">
                      {doneStops} of {totalStops} stops done
                    </span>
                  </div>
                </div>

                <div className="stops-section">
                  <h4>Delivery Stops</h4>
                  {sortedStops.length === 0 ? (
                    <p className="empty-stops">No stops for this route.</p>
                  ) : (
                    <ol className="stops-list">
                      {sortedStops.map((stop) => (
                        <li key={stop.id} className="stop-item">
                          <div className="stop-main-info">
                            <span className="stop-order-number">#{stop.stop_order}</span>
                            <span
                              className={`stop-type-label stop-type-${stop.stop_type?.toLowerCase()}`}
                            >
                              {stop.stop_type}
                            </span>
                            <span className="stop-coords">
                              Lat: {Number(stop.lat).toFixed(4)}, Lng: {Number(stop.lng).toFixed(4)}
                            </span>
                            <span className="stop-allocation">
                              Allocation: <code title={stop.allocation_id}>{stop.allocation_id || '—'}</code>
                            </span>
                          </div>

                          <div className="stop-actions-info">
                            <StatusBadge status={stop.status} />
                            {stop.status === 'PENDING' && (
                              <button
                                type="button"
                                className="btn-primary btn-sm"
                                disabled={isBusy}
                                onClick={() => handleMarkDone(stop.id)}
                              >
                                {updatingStopId === stop.id ? 'Marking done…' : 'Mark done'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
