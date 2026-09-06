import { registerGlobals } from '@livekit/react-native';

/**
 * LiveKit needs WebRTC globals installed before any room code runs. Importing
 * this module once from the root layout is the whole contract; it is a module
 * side effect so it cannot be accidentally skipped by a re-render.
 */
registerGlobals();
