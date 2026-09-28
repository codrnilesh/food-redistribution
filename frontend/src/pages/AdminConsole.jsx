import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ErrorBox from '../components/ErrorBox';
import { URGENCY_OPTIONS } from '../lib/options';

// Safe format helpers to avoid any render crashes
const formatId = (id) => {
  if (id === null || id === undefined) return '—';
  const str = String(id);
  return str.length > 8 ? `${str.slice(0, 8)}…` : str;
};

const formatDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
};

const formatDistance = (dist) => {
  if (dist === null || dist === undefined || isNaN(Number(dist))) return '—';
  return `${Number(dist).toFixed(1)} km`;
};

export default function AdminConsole() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [donations, setDonations] = useState([]);
  const [requests, setRequests] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Allocation Tab State
  const [selectedRun, setSelectedRun] = useState(null);
  const [runningAllocation, setRunningAllocation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState(null);
  const [zeroAllocationsMsg, setZeroAllocationsMsg] = useState('');
  const [skippedAllocations, setSkippedAllocations] = useState(null);

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
    if (val === null || val === undefined) return '—';
    const found = URGENCY_OPTIONS.find((o) => o.value === Number(val));
    return found ? found.label : String(val);
  };

  const getDonationInfo = (donationId) => {
    if (donationId === null || donationId === undefined) return { category: '—', unit: '' };
    const donation = donations.find((d) => String(d.id) === String(donationId));
    return {
      category: donation?.category || '—',
      unit: donation?.unit || '',
    };
  };

  const getRequestInfo = (requestId) => {
    if (requestId === null || requestId === undefined) return { urgency: '—', unit: '' };
    const req = requests.find((r) => String(r.id) === String(requestId));
    return {
      urgency: req ? getUrgencyLabel(req.urgency_level) : '—',
      unit: req?.unit || '',
    };
  };

  // 1) Run allocation
  const handleRunAllocation = async () => {
    setRunningAllocation(true);
    setError('');
    setZeroAllocationsMsg('');
    setSkippedAllocations(null);

    try {
      const data = await apiPost('/allocation-runs');
      if (data && typeof data === 'object') {
        setSelectedRun(data);
        const allocations = Array.isArray(data.allocations) ? data.allocations : [];
        if (allocations.length === 0) {
          setZeroAllocationsMsg(
            'No feasible matches — check that there are open requests and available donations of the same category within range and not expired.'
          );
        }
      }

      // Reload lists so previous runs and any changed data are up to date
      await loadOverviewData();
    } catch (err) {
      setError(err.message || 'Failed to run allocation');
    } finally {
      setRunningAllocation(false);
    }
  };

  // 4) Confirm run
  const handleConfirmRun = async (runId) => {
    if (!window.confirm('Are you sure you want to confirm this allocation run? This will update remaining quantities.')) {
      return;
    }

    setActionLoading(true);
    setError('');
    setZeroAllocationsMsg('');
    setSkippedAllocations(null);

    try {
      const res = await apiPost(`/allocation-runs/${runId}/confirm`);
      if (Array.isArray(res?.skipped) && res.skipped.length > 0) {
        setSkippedAllocations(res.skipped);
      }

      // Reload the run
      const updatedRun = await apiGet(`/allocation-runs/${runId}`);
      setSelectedRun(updatedRun);

      // Reload all overview data & runs list
      await loadOverviewData();
    } catch (err) {
      setError(err.message || 'Failed to confirm allocation run');
    } finally {
      setActionLoading(false);
    }
  };

  // 4) Discard run
  const handleDiscardRun = async (runId) => {
    if (!window.confirm('Are you sure you want to discard this allocation run and its proposed allocations?')) {
      return;
    }

    setActionLoading(true);
    setError('');
    setZeroAllocationsMsg('');
    setSkippedAllocations(null);

    try {
      await apiPost(`/allocation-runs/${runId}/discard`);

      // Reload the run
      const updatedRun = await apiGet(`/allocation-runs/${runId}`);
      setSelectedRun(updatedRun);

      // Reload all overview data & runs list
      await loadOverviewData();
    } catch (err) {
      setError(err.message || 'Failed to discard allocation run');
    } finally {
      setActionLoading(false);
    }
  };

  // 5) Load specific run into card
  const handleLoadRun = async (runId) => {
    setLoadingRunId(runId);
    setError('');
    setZeroAllocationsMsg('');
    setSkippedAllocations(null);

    try {
      const data = await apiGet(`/allocation-runs/${runId}`);
      setSelectedRun(data);
    } catch (err) {
      setError(err.message || 'Failed to load allocation run details');
    } finally {
      setLoadingRunId(null);
    }
  };

  const isBusy = loading || runningAllocation || actionLoading || loadingRunId !== null;

  return (
    <div className="dashboard-container">
      <div className="view-header">
        <h2>Admin Console</h2>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={loadOverviewData}
          disabled={isBusy}
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

      {/* ================= OVERVIEW TAB ================= */}
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
                          <code title={String(d.id)}>
                            {formatId(d.id)}
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
                          <code title={String(r.id)}>
                            {formatId(r.id)}
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
                          {formatDate(r.needed_by)}
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
                          <code title={String(run.id)}>
                            {formatId(run.id)}
                          </code>
                        </td>
                        <td>
                          {formatDate(run.run_at)}
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

      {/* ================= ALLOCATION TAB ================= */}
      {activeTab === 'Allocation' && (
        <div className="allocation-tab-content">
          {/* Action Header Card */}
          <div className="card allocation-action-card">
            <div className="allocation-action-header">
              <div>
                <h3>Automated Allocation Engine</h3>
                <p className="text-muted">
                  Execute max-flow matching algorithm between active donations and open requests.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={isBusy}
                onClick={handleRunAllocation}
              >
                {runningAllocation ? 'Running…' : 'Run allocation'}
              </button>
            </div>

            {zeroAllocationsMsg && (
              <div className="warning-box zero-alloc-box">
                <p>{zeroAllocationsMsg}</p>
              </div>
            )}
          </div>

          {/* Warning Box for Skipped Allocations */}
          {skippedAllocations && skippedAllocations.length > 0 && (
            <div className="warning-box skipped-warning-box">
              <p className="warning-title">
                <strong>Notice:</strong> these allocations could not be confirmed because the remaining quantity changed:
              </p>
              <ul className="skipped-list">
                {skippedAllocations.map((item, idx) => (
                  <li key={item?.id || idx}>
                    Allocation <code>{formatId(item?.id)}</code> — Qty: {item?.allocated_quantity} (Donation: {formatId(item?.donation_id)} → Request: {formatId(item?.request_id)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Active / Selected Run Card */}
          {selectedRun ? (
            <section className="card run-card">
              <div className="run-card-header">
                <div className="run-title-group">
                  <h3>
                    Allocation Run <code className="run-id-code" title={String(selectedRun.id)}>{formatId(selectedRun.id)}</code>
                  </h3>
                  <StatusBadge status={selectedRun.status || 'PROPOSED'} />
                </div>
                <span className="run-timestamp">
                  {formatDate(selectedRun.run_at)}
                </span>
              </div>

              {/* Summary line */}
              {(() => {
                const allocations = Array.isArray(selectedRun.allocations) ? selectedRun.allocations : [];
                const totalProposedQty = allocations.reduce(
                  (sum, a) => sum + Number(a?.allocated_quantity || 0),
                  0
                );
                return (
                  <div className="run-summary-line">
                    <span className="summary-pill">
                      <strong>Total Proposed Quantity:</strong> {totalProposedQty}
                    </span>
                    <span className="summary-pill">
                      <strong>Allocations:</strong> {allocations.length}
                    </span>
                    {selectedRun.unmatched_donations !== undefined && selectedRun.unmatched_donations !== null && (
                      <span className="summary-pill">
                        <strong>Unmatched Donations:</strong> {String(selectedRun.unmatched_donations)}
                      </span>
                    )}
                    {selectedRun.unmatched_requests !== undefined && selectedRun.unmatched_requests !== null && (
                      <span className="summary-pill">
                        <strong>Unmatched Requests:</strong> {String(selectedRun.unmatched_requests)}
                      </span>
                    )}
                    {selectedRun.execution_time_ms !== undefined && selectedRun.execution_time_ms !== null && (
                      <span className="summary-pill">
                        <strong>Execution Time:</strong> {String(selectedRun.execution_time_ms)} ms
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Action buttons (only when status is PROPOSED) */}
              {selectedRun.status === 'PROPOSED' && (
                <div className="run-actions">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={isBusy}
                    onClick={() => handleConfirmRun(selectedRun.id)}
                  >
                    {actionLoading ? 'Processing…' : 'Confirm'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm btn-danger-hover"
                    disabled={isBusy}
                    onClick={() => handleDiscardRun(selectedRun.id)}
                  >
                    {actionLoading ? 'Processing…' : 'Discard'}
                  </button>
                </div>
              )}

              {/* Proposed Allocations Table */}
              <div className="proposed-allocations-section">
                <h4>Proposed Allocations ({Array.isArray(selectedRun.allocations) ? selectedRun.allocations.length : 0})</h4>
                {!Array.isArray(selectedRun.allocations) || selectedRun.allocations.length === 0 ? (
                  <p className="empty-message">No allocations in this run.</p>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Allocation ID</th>
                          <th>Donation</th>
                          <th>Request</th>
                          <th>Allocated Qty</th>
                          <th>Distance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRun.allocations.map((alloc) => {
                          const donInfo = getDonationInfo(alloc.donation_id);
                          const reqInfo = getRequestInfo(alloc.request_id);
                          const unit = donInfo.unit || reqInfo.unit || '';

                          return (
                            <tr key={alloc.id}>
                              <td>
                                <code title={String(alloc.id)}>
                                  {formatId(alloc.id)}
                                </code>
                              </td>
                              <td>
                                <code title={String(alloc.donation_id)}>
                                  {formatId(alloc.donation_id)}
                                </code>{' '}
                                <span className="meta-tag">({donInfo.category})</span>
                              </td>
                              <td>
                                <code title={String(alloc.request_id)}>
                                  {formatId(alloc.request_id)}
                                </code>{' '}
                                <span className="meta-tag">({reqInfo.urgency})</span>
                              </td>
                              <td>
                                {alloc.allocated_quantity} {unit}
                              </td>
                              <td>
                                {formatDistance(alloc.distance_km)}
                              </td>
                              <td>
                                <StatusBadge status={alloc.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <div className="card">
              <p className="empty-message">
                No allocation run selected. Click "Run allocation" above or choose a previous run below.
              </p>
            </div>
          )}

          {/* Previous Runs List */}
          <section className="card list-card">
            <h3>Previous Runs ({runs.length})</h3>
            {runs.length === 0 ? (
              <p className="empty-message">No previous runs.</p>
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
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr
                        key={r.id}
                        className={selectedRun?.id === r.id ? 'row-selected' : ''}
                      >
                        <td>
                          <code title={String(r.id)}>
                            {formatId(r.id)}
                          </code>
                        </td>
                        <td>{formatDate(r.run_at)}</td>
                        <td>
                          <StatusBadge status={r.status} />
                        </td>
                        <td>{r.allocation_count ?? r.allocations_count ?? r.count ?? 0}</td>
                        <td>{r.notes || '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={isBusy}
                            onClick={() => handleLoadRun(r.id)}
                          >
                            {loadingRunId === r.id
                              ? 'Loading…'
                              : selectedRun?.id === r.id
                              ? 'Viewing'
                              : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ================= LOGISTICS TAB ================= */}
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
