/**
 * Calculates the great-circle distance between two points on the Earth
 * using the Haversine formula.
 *
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lng1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lng2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's mean radius in kilometers
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

haversineKm.haversineKm = haversineKm;
module.exports = haversineKm;
module.exports.haversineKm = haversineKm;
