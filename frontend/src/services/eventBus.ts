/**
 * Lightweight client-side event bus for SmartContext invalidation.
 *
 * Decouples module-level events (login, location change, visit recorded,
 * tab change, preferences updated) from the SmartContext orchestrator
 * refetch — instead of polling every 2min, the orchestrator can refresh
 * immediately when something significant happens.
 *
 * Usage:
 *   eventBus.emit('user.login', { userId });
 *   const off = eventBus.on('location.changed', ({ lat, lng }) => { ... });
 *   off(); // unsubscribe
 *
 * Zero deps, fully typed, ~1KB minified.
 */

export type AppEvent =
  | 'user.login'
  | 'user.logout'
  | 'location.changed'
  | 'preferences.updated'
  | 'visit.recorded'
  | 'tab.changed'
  | 'context.invalidate'   // generic: force orchestrator refetch
  | 'favorite.toggled'
  | 'route.completed';

type Listener<T = any> = (payload: T) => void;

class EventBus {
  private listeners = new Map<AppEvent, Set<Listener>>();

  on<T = any>(event: AppEvent, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener);
    return () => this.off(event, listener as Listener);
  }

  off(event: AppEvent, listener: Listener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<T = any>(event: AppEvent, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.forEach((l) => {
      try {
        l(payload);
      } catch (err) {
        // Listeners must not break the bus
        if (typeof console !== 'undefined') {
          console.warn(`[eventBus] listener for "${event}" threw:`, err);
        }
      }
    });
  }

  /** Remove all listeners — used in tests. */
  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
