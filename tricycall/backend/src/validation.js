export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(createHttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(createHttpError(400, 'INVALID_JSON', 'Request body must be valid JSON'));
      }
    });

    req.on('error', reject);
  });
}

export function validateLocation(value, fieldName) {
  if (!value || typeof value !== 'object') {
    throw createHttpError(422, 'VALIDATION_ERROR', `${fieldName} is required`);
  }

  if (typeof value.name !== 'string' || value.name.trim().length < 2) {
    throw createHttpError(422, 'VALIDATION_ERROR', `${fieldName}.name must be at least 2 characters`);
  }

  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) {
    throw createHttpError(422, 'VALIDATION_ERROR', `${fieldName}.lat and ${fieldName}.lng must be numbers`);
  }

  return {
    name: value.name.trim(),
    lat: value.lat,
    lng: value.lng
  };
}

export function validateRideRequest(body) {
  const passengerName =
    typeof body.passengerName === 'string' && body.passengerName.trim()
      ? body.passengerName.trim()
      : 'Guest Passenger';

  return {
    passengerName,
    pickup: validateLocation(body.pickup, 'pickup'),
    dropoff: validateLocation(body.dropoff, 'dropoff'),
    notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 180) : ''
  };
}

export function createHttpError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}
