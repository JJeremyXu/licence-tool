export const HID_CONSTANTS = {
  // Dongle USB IDs
  VENDOR_ID: 0x0483,
  PRODUCT_ID: 0x5732,
  USAGE_PAGE: 0xff00,
  REPORT_SIZE: 64,
  
  // Dongle Report IDs
  REPORT_ID: {
    GET_LICENSE_IN: 0x01,
    GET_LICENSE_OUT: 0x02,
    GET_COUNTER_IN: 0x03,
    GET_COUNTER_OUT: 0x04,
  },

  // Target Device USB IDs
  TARGET_VENDOR_ID: 0x0a12,
  TARGET_PRODUCT_ID: 0x4007,

  // Target Device Report IDs
  TARGET_REPORT_ID: {
    GET_UUID_REQUEST: 0x80,
    GET_UUID_RESPONSE: 0x81,
    STORE_LICENSE: 0x82,
  },
};
