import winston from 'winston';
import { randomUUID } from 'node:crypto';

// Generate request ID for each request
export const generateRequestId = (): string => {
  return randomUUID();
};

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'excelai-backend' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          const reqId = requestId ? `[${requestId}]` : '';
          return `${timestamp} ${level} ${reqId} ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Logger with request ID support
export const createLogger = (requestId?: string) => {
  return {
    error: (message: string, meta?: any) => {
      logger.error(message, { requestId, ...meta });
    },
    warn: (message: string, meta?: any) => {
      logger.warn(message, { requestId, ...meta });
    },
    info: (message: string, meta?: any) => {
      logger.info(message, { requestId, ...meta });
    },
    debug: (message: string, meta?: any) => {
      logger.debug(message, { requestId, ...meta });
    },
  };
};

// Default logger (without request ID)
export default createLogger();
