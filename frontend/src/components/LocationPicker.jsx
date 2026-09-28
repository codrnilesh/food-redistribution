import React, { useState } from 'react';

const PRESET_HUBS = [
  { name: 'Hub North', lat: 21.05, lng: 75.60 },
  { name: 'Hub East', lat: 21.02, lng: 75.65 },
  { name: 'Hub Central', lat: 21.00, lng: 75.58 },
  { name: 'Hub South', lat: 20.95, lng: 75.60 },
  { name: 'Hub West', lat: 21.00, lng: 75.50 },
  { name: 'Hub Depot', lat: 20.98, lng: 75.55 },
];

export default function LocationPicker({ lat, lng, onChange }) {
  const [selectedHub, setSelectedHub] = useState('');

  const emitChange = (nextLat, nextLng) => {
    if (typeof onChange === 'function') {
      onChange({ lat: nextLat, lng: nextLng }, nextLat, nextLng);
    }
  };

  const handlePresetSelect = (e) => {
    const hubName = e.target.value;
    setSelectedHub(hubName);

    const hub = PRESET_HUBS.find((h) => h.name === hubName);
    if (!hub) return;

    // Apply random offset of at most 0.01 degrees in either direction
    const offsetLat = (Math.random() * 0.02 - 0.01);
    const offsetLng = (Math.random() * 0.02 - 0.01);

    const newLat = Number((hub.lat + offsetLat).toFixed(4));
    const newLng = Number((hub.lng + offsetLng).toFixed(4));

    emitChange(newLat, newLng);
  };

  const handleLatChange = (e) => {
    setSelectedHub('');
    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
    emitChange(val, lng);
  };

  const handleLngChange = (e) => {
    setSelectedHub('');
    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
    emitChange(lat, val);
  };

  return (
    <div className="location-picker">
      <div className="form-group">
        <label htmlFor="hub-preset-select">Preset Hub Location</label>
        <select
          id="hub-preset-select"
          value={selectedHub}
          onChange={handlePresetSelect}
        >
          <option value="">-- Choose preset hub location --</option>
          {PRESET_HUBS.map((hub) => (
            <option key={hub.name} value={hub.name}>
              {hub.name} ({hub.lat}, {hub.lng})
            </option>
          ))}
        </select>
      </div>

      <div className="location-coords-row">
        <div className="form-group">
          <label htmlFor="location-lat">Latitude</label>
          <input
            id="location-lat"
            type="number"
            step="any"
            value={lat ?? ''}
            onChange={handleLatChange}
            placeholder="e.g. 21.05"
          />
        </div>

        <div className="form-group">
          <label htmlFor="location-lng">Longitude</label>
          <input
            id="location-lng"
            type="number"
            step="any"
            value={lng ?? ''}
            onChange={handleLngChange}
            placeholder="e.g. 75.60"
          />
        </div>
      </div>
    </div>
  );
}
