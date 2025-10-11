
import { EventEmitter } from 'events';

// This is a browser-safe event emitter.
class SafeEventEmitter extends EventEmitter {}

export const errorEmitter = new SafeEventEmitter();
