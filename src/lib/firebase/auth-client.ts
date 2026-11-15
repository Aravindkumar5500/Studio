"use client";

import { getFirebaseAuth } from "./client";

/**
 * Returns the current Firebase ID token if a user is signed in,
 * or null if unauthenticated or Firebase client is unconfigured.
 */
export async function getClientAuthToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (err) {
    console.warn("Failed to retrieve Firebase ID token:", err);
    return null;
  }
}

/**
 * Builds standard headers object with `Authorization: Bearer <idToken>`
 * attached whenever a signed-in user is available.
 */
export async function getAuthHeaders(
  customHeaders?: Record<string, string> | HeadersInit,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(customHeaders)) {
      for (const [key, value] of customHeaders) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, customHeaders);
    }
  }

  const token = await getClientAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Production-ready fetch wrapper that automatically injects the Firebase ID token
 * into the Authorization header for every API route request.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = await getAuthHeaders(init?.headers);
  return fetch(input, {
    ...init,
    headers,
  });
}

