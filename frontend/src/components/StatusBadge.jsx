import React from 'react';

const STATUS_COLOR_MAP = {
  // Green / Success
  AVAILABLE: 'badge-green',
  OPEN: 'badge-green',
  CONFIRMED: 'badge-green',
  COMPLETED: 'badge-green',
  DONE: 'badge-green',

  // Blue / Info / Active
  PARTIALLY_ALLOCATED: 'badge-blue',
  PARTIALLY_FULFILLED: 'badge-blue',
  PLANNED: 'badge-blue',
  ASSIGNED: 'badge-blue',

  // Purple / Full
  FULLY_ALLOCATED: 'badge-purple',
  FULFILLED: 'badge-purple',

  // Amber / Warning / Pending
  PROPOSED: 'badge-amber',
  PENDING: 'badge-amber',
  IN_PROGRESS: 'badge-amber',

  // Red / Danger / Cancelled
  CANCELLED: 'badge-red',
  DISCARDED: 'badge-red',

  // Gray / Inactive
  EXPIRED: 'badge-gray',
};

export default function StatusBadge({ status }) {
  if (!status) return null;

  const normalized = String(status).trim().toUpperCase();
  const colorClass = STATUS_COLOR_MAP[normalized] || 'badge-default';

  return (
    <span className={`status-badge ${colorClass}`} data-status={normalized}>
      {status}
    </span>
  );
}
