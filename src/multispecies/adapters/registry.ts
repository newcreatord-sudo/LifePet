import type { DeviceAdapter } from "@/multispecies/adapters/DeviceAdapter";
import { ALL_MOCK_ADAPTERS } from "@/multispecies/adapters/mock/mockAdapters";
import { VENDOR_ADAPTERS } from "@/multispecies/adapters/vendors/vendorAdapters";

export const ALL_ADAPTERS: DeviceAdapter[] = [...ALL_MOCK_ADAPTERS, ...VENDOR_ADAPTERS];

export const ADAPTERS_BY_TYPE: Record<string, DeviceAdapter> = Object.fromEntries(ALL_ADAPTERS.map((a) => [a.identify().adapterType, a]));

export function getAdapter(adapterType: string) {
  return ADAPTERS_BY_TYPE[adapterType] ?? null;
}

