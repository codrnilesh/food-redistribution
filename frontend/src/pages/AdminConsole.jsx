import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ErrorBox from '../components/ErrorBox';
import { URGENCY_OPTIONS } from '../lib/options';

export default function AdminConsole() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverviewData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [donationsData, requestsData, runsData] = await Promise.all([
        apiGet('/donations'),
        apiGet('/requests'),
        apiGet('/allocation-runs'),
      ]);
      setDonations(Array.isArray(donationsData) ? donationsData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setRuns(Array.isArray(runsData) ? runsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load admin overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  const getUrgencyLabel = (val) => {
    const found = URGENCY_OPTIONS.find((o) => o.value === val);
    return found ? found.label : val;
  };

  return (
    <div className="dashboard-container">
      <div className="view-header">
        <h2>Admin Console</h2>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={loadOverviewData}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {['Overview', 'Allocation', 'Logistics'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`admin-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />

      {activeTab === 'Overview' && (
        <div className="overview-tab-content">
          {/* All Donations Table */}
          <section className="card list-card">
            <h3>All Donations ({donations.length})</h3>
            {loading && donations.length === 0 ? (
              <p className="loading-text">Loading donations…</p>
            ) : donations.length === 0 ? (
              <p className="empty-message">No donations found.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Category</th>
                      <th>Original Qty</th>
                      <th>Remaining Qty</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <code title={d.id}>
                            {d.id.length > 8 ? `${d.id.slice(0, 8)}…` : d.id}
                          </code>
                        </td>
                        <td>{d.category}</td>
                        <td>
                          {d.original_quantity} {d.unit || ''}
                        </td>
                        <td>
                          {d.remaining_quantity} {d.unit || ''}
                        </td>
                        <td>
                          <StatusBadge status={d.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* All Requests Table */}
          <section className="card list-card">
            <h3>All Requests ({requests.length})</h3>
            {loading && requests.length === 0 ? (
              <p className="loading-text">Loading requests…</p>
            ) : requests.length === 0 ? (
              <p className="empty-message">No requests found.</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <code title={r.id}>
                            {r.id.length > 8 ? `${r.id.slice(0, 8)}…` : r.id}
                          </code>
                        </td>
                        <td>{r.category}</td>
                        <td>
                          {r.original_quantity} {r.unit || ''}
                        </td>
                        <td>
                          {r.remaining_quantity} {r.unit || ''}
                        </td>
                        <td>{getUrgencyLabel(r.urgency_level)}</td>
                        <td>
                          {r.needed_by
                            ? new Date(r.needed_by).toLocaleString()
                            : '—'}
                        </td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent Allocation Runs Table */}
          <section className="card list-card">
            <h3>Recent Allocation Runs ({runs.length})</h3>
            {loading && runs.length === 0 ? (
              <p className="loading-text">Loading allocation runs…</p>
            ) : runs.length === 0 ? (
              <p className="empty-message">No allocation runs found.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Run At</th>
                      <th>Status</th>
                      <th>Allocations Count</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <code title={run.id}>
                            {run.id.length > 8 ? `${run.id.slice(0, 8)}…` : run.id}
                          </code>
                        </td>
                        <td>
                          {run.run_at
                            ? new Date(run.run_at).toLocaleString()
                            : '—'}
                        </td>
                        <td>
                          <StatusBadge status={run.status} />
                        </td>
                        <td>
                          {run.allocation_count ??
                            run.allocations_count ??
                            run.count ??
                            0}
                        </td>
                        <td>{run.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'Allocation' && (
        <div className="card placeholder-card">
          <h3>Allocation</h3>
          <p className="placeholder-tab-text">
            Allocation workflow and matching configuration coming soon.
          </p>
        </div>
      )}

      {activeTab === 'Logistics' && (
        <div className="card placeholder-card">
          <h3>Logistics</h3>
          <p className="placeholder-tab-text">
            Logistics optimization and route management coming soon.
          </p>
        </div>
      )}
    </div>
  );
}
