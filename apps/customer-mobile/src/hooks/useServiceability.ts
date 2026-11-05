import { useMemo } from 'react';
import type { Database } from '@freshkart/shared';

type Address = Database['public']['Tables']['addresses']['Row'];
type StoreSettings = Database['public']['Tables']['store_settings']['Row'];

export interface ServiceabilityResult {
  isServiceable: boolean;
  reason: string | null;
  distanceKm: number | null;
}

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
function calculateHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function useServiceability(
  address: Address | null,
  settings: StoreSettings | null
): ServiceabilityResult {
  return useMemo(() => {
    if (!address) {
      return {
        isServiceable: false,
        reason: 'Please select a delivery address.',
        distanceKm: null,
      };
    }

    if (!settings) {
      return {
        isServiceable: true,
        reason: null,
        distanceKm: null,
      };
    }

    // 1. PIN Code Allowlist Check
    const allowedPincodes = settings.serviceable_pincodes || [];
    if (allowedPincodes.length === 0) {
      return {
        isServiceable: false,
        reason: 'Store delivery zones are not yet configured by the administrator. Orders cannot be accepted at this time.',
        distanceKm: null,
      };
    }

    const cleanPincode = address.pincode ? address.pincode.trim() : '';
    if (!cleanPincode || !allowedPincodes.includes(cleanPincode)) {
      return {
        isServiceable: false,
        reason: `Delivery is currently not available in PIN code ${cleanPincode || 'unknown'}. We currently deliver to: ${allowedPincodes.join(', ')}.`,
        distanceKm: null,
      };
    }

    // 2. Haversine Distance Check & GPS Security (if coordinates exist)
    let distanceKm: number | null = null;
    if (address.latitude !== null && address.longitude !== null) {
      const lat = Number(address.latitude);
      const lon = Number(address.longitude);

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return {
          isServiceable: false,
          reason: 'Invalid GPS coordinates detected on address.',
          distanceKm: null,
        };
      }

      distanceKm = calculateHaversineKm(
        Number(settings.latitude),
        Number(settings.longitude),
        lat,
        lon
      );

      if (distanceKm > Number(settings.delivery_radius_km)) {
        return {
          isServiceable: false,
          reason: `Address is outside our ${settings.delivery_radius_km} km delivery zone (${distanceKm} km away).`,
          distanceKm,
        };
      }
    }

    return {
      isServiceable: true,
      reason: null,
      distanceKm,
    };
  }, [address, settings]);
}

