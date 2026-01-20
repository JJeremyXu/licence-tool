'use client';

import { HIDProvider } from "@/lib/hid/hid-context";
import AutoLicensePage from "./page";

export default function AutoLicenseLayout() {
  return (
    <HIDProvider>
      <AutoLicensePage />
    </HIDProvider>
  );
}
