import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: any;

  constructor(config: ConfigService) {
    let dbUrl = config.get<string>('DATABASE_URL') || '';
    
    // Dynamically optimize database connection pool parameters
    if (dbUrl) {
      try {
        const urlObj = new URL(dbUrl);
        urlObj.searchParams.set('connection_limit', '5'); // Reduce to 5 to prevent connection exhaustion during dev hot-reloads
        urlObj.searchParams.set('pool_timeout', '20'); // Timeout faster internally to trigger retries
        urlObj.searchParams.set('connect_timeout', '20');
        dbUrl = urlObj.toString();
      } catch (e) {
        // Fallback in case the URL format is non-standard
      }
    }

    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    });

    const baseClient = this;
    const maxRetries = 3;
    const baseDelay = 300; // ms

    // Implement a global transparent query-level retry using Prisma Client Extension
    this.client = (this as any).$extends({
      query: {
        $allOperations: async ({ model, operation, args, query }: any) => {
          let attempt = 1;
          const executeWithRetry = async (): Promise<any> => {
            try {
              return await query(args);
            } catch (error: any) {
              const isTransient =
                error.code === 'P1001' || // Can't reach database server
                error.code === 'P2024' || // Connection pool timeout
                error.message?.includes('connection pool') ||
                error.message?.includes('Can\'t reach database server') ||
                error.message?.includes('Timed out fetching a new connection');

              if (isTransient && attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 300ms, 600ms
                baseClient.logger.warn(
                  `Database transient error (${error.code || 'UNKNOWN'}). Retrying query on model '${model}' operation '${operation}' (Attempt ${attempt}/${maxRetries}) in ${delay}ms...`
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
                attempt++;
                return executeWithRetry();
              }
              throw error;
            }
          };

          return executeWithRetry();
        },
      },
    });

    // Use a Proxy wrapper so that calls to PrismaService are seamlessly forwarded to the extended client
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === 'logger' ||
          prop === 'client' ||
          prop === '$connect' ||
          prop === '$disconnect'
        ) {
          return Reflect.get(target, prop, receiver);
        }

        if (target.client && prop in target.client) {
          const value = target.client[prop];
          if (typeof value === 'function') {
            return value.bind(target.client);
          }
          return value;
        }

        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}