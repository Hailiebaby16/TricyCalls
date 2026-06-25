import type { Driver, Ride, RideStatus, Toda, TodaQueueRecord } from './types';

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

export async function listTodas(): Promise<Toda[]> {
  const response = await request<ListResponse<Toda>>('/api/todas');
  return response.data;
}

export async function createToda(input: Toda): Promise<Toda> {
  return await request<Toda>('/api/todas', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateToda(id: string, input: Partial<Toda>): Promise<Toda> {
  return await request<Toda>(`/api/todas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
}

export async function assignDriverToToda(todaId: string, driverId: string): Promise<Toda> {
  return await request<Toda>(`/api/todas/${todaId}/drivers/${driverId}`, {
    method: 'POST'
  });
}

export async function removeDriverFromToda(todaId: string, driverId: string): Promise<Toda> {
  return await request<Toda>(`/api/todas/${todaId}/drivers/${driverId}`, {
    method: 'DELETE'
  });
}

export async function getTodaQueue(todaId: string): Promise<TodaQueueRecord[]> {
  const response = await request<ListResponse<TodaQueueRecord>>(`/api/todas/${todaId}/queue`);
  return response.data;
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
