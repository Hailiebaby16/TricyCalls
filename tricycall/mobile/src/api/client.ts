import type { CreateRideInput, FareEstimate, LocationPoint, LoginResponse, Ride } from '../types';

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type FareEstimateInput = {
  pickup: LocationPoint;
  dropoff: LocationPoint;
};


export async function loginUser(input: { email: string; password: string }): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function estimateFare(input: FareEstimateInput): Promise<FareEstimate> {
  return request<FareEstimate>('/api/fare-estimates', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function createRide(input: CreateRideInput): Promise<Ride> {
  return request<Ride>('/api/rides', {
    method: 'POST',
    body: JSON.stringify(input)
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
    const message = body?.error?.message ?? 'Request failed';
    throw new Error(message);
  }

  return body as T;
}
