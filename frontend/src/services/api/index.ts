/**
 * API barrel — re-exports the shared axios client (default) plus every
 * domain module's functions and types.
 *
 * Split from the former monolithic `src/services/api.ts` (2.6k LOC) into
 * cohesive per-domain modules. Existing imports keep working unchanged:
 *   import api, { getHeritageItems, type Trail } from '../services/api';
 */
export { default } from './client';

export * from './heritage';
export * from './routes';
export * from './content';
export * from './community';
export * from './agenda';
export * from './user';
export * from './gamification';
export * from './discover';
export * from './mobility';
export * from './audio';
export * from './marine';
export * from './encyclopedia';
export * from './weather';
export * from './accessibility';
export * from './iq';
export * from './smartRoutes';
export * from './planner';
export * from './nature';
export * from './premium';
export * from './uploads';
export * from './analytics';
export * from './itineraries';
export * from './cultural';
