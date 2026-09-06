/**
 * Native modules are unavailable under Jest. Anything that must be exercised
 * on real hardware (the replay ring buffer, LiveKit tracks) is verified
 * on-device instead; unit tests cover pure logic such as the pending-replay
 * state machine and the control-message schema.
 */
export {};
