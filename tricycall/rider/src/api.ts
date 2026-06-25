import type { Driver, QueueStatus, Ride, RideStatus, Toda } from './types';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type ListResponse<T> = {
  data: T[];
};

export async function listRides(): Promise<Ride[]> {
  const response = await request<ListResponse<Ride>>('/api/rides');
  return response.data;
}

export async function listDrivers(): Promise<Driver[]> {
  const response = await request<ListResponse<Driver>>('/api/drivers');
  return response.data;
}

export async function updateRideStatus(id: string, status: RideStatus): Promise<Ride> {
  return await request<Ride>(`/api/rides/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

export async function acceptRide(id: string, driverId: string): Promise<Ride> {
  return await request<Ride>(`/api/rides/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ driverId })
  });
}

export async function rejectRide(id: string, driverId: string): Promise<Ride> {
  return await request<Ride>(`/api/rides/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ driverId })
  });
}

export async function getDriverToda(driverId: string): Promise<Toda | null> {
  return await request<Toda | null>(`/api/drivers/${driverId}/toda`);
}

export async function getDriverQueue(driverId: string): Promise<QueueStatus> {
  return await request<QueueStatus>(`/api/drivers/${driverId}/queue`);
}

export async function updateDriverLocation(
  driverId: string,
  input: { lat: number; lng: number; joinQueue?: boolean; isOnline?: boolean }
): Promise<QueueStatus> {
  return await request<QueueStatus>(`/api/drivers/${driverId}/location`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function leaveQueue(driverId: string): Promise<QueueStatus> {
  return await request<QueueStatus>(`/api/drivers/${driverId}/queue`, {
    method: 'DELETE'
  });
}

export async function registerPushToken(driverId: string, pushToken: string): Promise<void> {
  await request(`/api/drivers/${driverId}/push-token`, {
    method: 'POST',
    body: JSON.stringify({ pushToken })
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Request failed with ${response.status}`);
  }

  return body as T;
}
