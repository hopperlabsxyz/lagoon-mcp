/**
 * Service Registry
 *
 * Central registry for all domain services.
 * Services are organized by domain and use dependency injection.
 */

// NOTE: Service wrappers temporarily commented out
// These will be completed during the tool integration phase when we refactor tools
// to use the DI container pattern. The service layer infrastructure (BaseService,
// ServiceContainer) is ready, but individual service implementations need to match
// actual utility function signatures.

// import { ServiceContainer } from '../core/container.js';

// Vault services
// import { SimulationService } from './vault/simulation.service.js';
// import { APRService } from './vault/apr.service.js';

// Analytics services
// import { RiskService } from './analytics/risk.service.js';
// import { PredictionService } from './analytics/prediction.service.js';
// import { ComparisonService } from './analytics/comparison.service.js';

// Portfolio services
// import { OptimizationService } from './portfolio/optimization.service.js';

// Export services
// import { CSVService } from './export/csv.service.js';

/**
 * Service collection interface
 */
// export interface Services {
//   // Vault domain
//   vault: {
//     simulation: SimulationService;
//     apr: APRService;
//   };
//
//   // Analytics domain
//   analytics: {
//     risk: RiskService;
//     prediction: PredictionService;
//     comparison: ComparisonService;
//   };
//
//   // Portfolio domain
//   portfolio: {
//     optimization: OptimizationService;
//   };
//
//   // Export domain
//   export: {
//     csv: CSVService;
//   };
// }

/**
 * Create all services with dependency injection
 *
 * Factory function that instantiates all domain services with the provided container.
 * Services are organized by domain for clarity.
 *
 * @param container - Service container with dependencies
 * @returns Complete service collection
 *
 * @example
 * ```typescript
 * const container = createContainer(graphqlClient, cache, config);
 * const services = createServices(container);
 *
 * // Use services
 * const riskAnalysis = services.analytics.risk.analyze(vault, globalTVL);
 * const simulation = services.vault.simulation.simulate(vault, newAssets);
 * ```
 */
// export function createServices(container: ServiceContainer): Services {
//   return {
//     vault: {
//       simulation: new SimulationService(container),
//       apr: new APRService(container),
//     },
//     analytics: {
//       risk: new RiskService(container),
//       prediction: new PredictionService(container),
//       comparison: new ComparisonService(container),
//     },
//     portfolio: {
//       optimization: new OptimizationService(container),
//     },
//     export: {
//       csv: new CSVService(container),
//     },
//   };
// }

// Re-export service classes for direct instantiation
// export {
//   SimulationService,
//   APRService,
//   RiskService,
//   PredictionService,
//   ComparisonService,
//   OptimizationService,
//   CSVService,
// };

// Re-export base service
export { BaseService } from './base.service.js';
