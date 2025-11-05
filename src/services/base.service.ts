/**
 * Base Service Class
 *
 * Provides common functionality for all domain services.
 * Services encapsulate business logic and interact with the container.
 */

import { ServiceContainer } from '../core/container.js';
import { CacheService } from '../core/cache-adapter.js';
import { GraphQLClient } from 'graphql-request';
import { Config } from '../config.js';

/**
 * Base service interface
 */
export interface Service {
  readonly name: string;
  readonly container: ServiceContainer;
}

/**
 * Abstract base service class
 * All domain services should extend this class
 */
export abstract class BaseService implements Service {
  constructor(
    public readonly name: string,
    public readonly container: ServiceContainer
  ) {}

  /**
   * Access cache service
   */
  protected get cache(): CacheService {
    return this.container.cache;
  }

  /**
   * Access GraphQL client
   */
  protected get client(): GraphQLClient {
    return this.container.graphqlClient;
  }

  /**
   * Access configuration
   */
  protected get config(): Config {
    return this.container.config;
  }
}
