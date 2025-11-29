/**
 * Feature Flags
 *
 * Used for safe migration from old to new implementations
 */

/**
 * Use XState state machine for scanner (BarcodeScannerV2)
 * Phase 2: Dev only (__DEV__)
 * Phase 3: TestFlight (Platform.OS === 'ios')
 * Phase 4: Production (true)
 */
export const USE_STATE_MACHINE = __DEV__;
