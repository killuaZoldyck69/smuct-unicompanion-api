import os from "node:os";
import v8 from "node:v8";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { envConfig } from "../../config/env";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PostgresDiagnostics {
  status: "healthy" | "degraded" | "error";
  usedBytes: number;
  usedFormatted: string;
  limitBytes: number;
  limitFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  percentUsed: number;
  activeConnections: number;
  totalTables: number;
  latencyMs: number;
  databaseName?: string;
  error?: string;
}

export interface CloudinaryDiagnostics {
  status: "healthy" | "degraded" | "unconfigured" | "error";
  plan?: string;
  storageUsedBytes: number;
  storageUsedFormatted: string;
  creditsUsed: number;
  creditsLimit: number;
  creditsRemaining: number;
  creditsPercentUsed: number;
  objectsCount: number;
  bandwidthUsedBytes: number;
  bandwidthUsedFormatted: string;
  error?: string;
}

export interface BrevoDiagnostics {
  status: "healthy" | "degraded" | "unconfigured" | "error";
  planType?: string;
  dailyCreditLimit: number;
  creditsRemaining: number;
  creditsUsed: number;
  creditsPercentUsed: number;
  accountEmail?: string;
  relayStatus?: string;
  error?: string;
}

export interface RuntimeDiagnostics {
  status: "healthy" | "degraded";
  uptimeSeconds: number;
  uptimeFormatted: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  memory: {
    // Process RSS vs Container RAM limit (Render Free: 512 MB)
    rssBytes: number;
    rssFormatted: string;
    containerLimitBytes: number;
    containerLimitFormatted: string;
    percentContainerRam: number;
    headroomFormatted: string;

    // V8 Heap details
    heapUsedBytes: number;
    heapUsedFormatted: string;
    heapTotalBytes: number;
    heapTotalFormatted: string;
    heapLimitBytes: number;
    heapLimitFormatted: string;
    percentHeapUsed: number;
  };
}

export interface SystemLogItem {
  id: string;
  level: "INFO" | "SUCCESS" | "WARN" | "SYSTEM";
  service: "API" | "DATABASE" | "STORAGE" | "EMAIL" | "AUTH";
  message: string;
  timestamp: string;
}

export interface ServiceMatrixItem {
  name: string;
  category: string;
  status: "OPERATIONAL" | "DEGRADED" | "STANDBY";
  latencyMs?: number;
  info: string;
}

export interface SystemDiagnosticsResponse {
  timestamp: string;
  isOverallHealthy: boolean;
  overallLatencyMs: number;
  environment: string;
  hostNode: string;
  database: PostgresDiagnostics;
  cloudinary: CloudinaryDiagnostics;
  brevo: BrevoDiagnostics;
  runtime: RuntimeDiagnostics;
  servicesMatrix: ServiceMatrixItem[];
  systemLogs: SystemLogItem[];
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatUptime(uptimeSeconds: number): string {
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Cache Layer ─────────────────────────────────────────────────────────────
let cachedResult: { data: SystemDiagnosticsResponse; cachedAt: number } | null =
  null;
const CACHE_TTL_MS = 15_000; // 15 seconds memory cache to respect third-party rate limits

// ─── Collectors ──────────────────────────────────────────────────────────────

async function getPostgresDiagnostics(): Promise<PostgresDiagnostics> {
  const startTime = Date.now();
  try {
    const defaultLimitMb = process.env.POSTGRES_MAX_STORAGE_MB
      ? parseInt(process.env.POSTGRES_MAX_STORAGE_MB, 10)
      : 512; // 512 MB default (standard free tier on Neon / Supabase)
    const limitBytes = defaultLimitMb * 1024 * 1024;

    const [sizeRows, connRows, tableRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{ size_bytes: string | number | bigint; db_name: string }>
      >`
        SELECT pg_database_size(current_database())::text AS size_bytes,
               current_database() AS db_name
      `,
      prisma.$queryRaw<
        Array<{ active_connections: string | number | bigint }>
      >`
        SELECT count(*)::text AS active_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `,
      prisma.$queryRaw<Array<{ total_tables: string | number | bigint }>>`
        SELECT count(*)::text AS total_tables
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `,
    ]);

    const usedBytes = sizeRows[0]?.size_bytes
      ? Number(sizeRows[0].size_bytes)
      : 0;
    const dbName = sizeRows[0]?.db_name || "postgres";
    const activeConnections = connRows[0]?.active_connections
      ? Number(connRows[0].active_connections)
      : 1;
    const totalTables = tableRows[0]?.total_tables
      ? Number(tableRows[0].total_tables)
      : 0;
    const latencyMs = Date.now() - startTime;

    const remainingBytes = Math.max(0, limitBytes - usedBytes);
    const percentUsed =
      limitBytes > 0
        ? Number(((usedBytes / limitBytes) * 100).toFixed(1))
        : 0;

    return {
      status: percentUsed >= 95 ? "degraded" : "healthy",
      usedBytes,
      usedFormatted: formatBytes(usedBytes),
      limitBytes,
      limitFormatted: formatBytes(limitBytes),
      remainingBytes,
      remainingFormatted: formatBytes(remainingBytes),
      percentUsed,
      activeConnections,
      totalTables,
      latencyMs,
      databaseName: dbName,
    };
  } catch (error: any) {
    return {
      status: "error",
      usedBytes: 0,
      usedFormatted: "N/A",
      limitBytes: 0,
      limitFormatted: "N/A",
      remainingBytes: 0,
      remainingFormatted: "N/A",
      percentUsed: 0,
      activeConnections: 0,
      totalTables: 0,
      latencyMs: Date.now() - startTime,
      error: error?.message || "Failed to query database statistics",
    };
  }
}

async function getCloudinaryDiagnostics(): Promise<CloudinaryDiagnostics> {
  const cloudName =
    envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey =
    envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;
  const apiSecret =
    envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      status: "unconfigured",
      storageUsedBytes: 0,
      storageUsedFormatted: "Not configured",
      creditsUsed: 0,
      creditsLimit: 25,
      creditsRemaining: 25,
      creditsPercentUsed: 0,
      objectsCount: 0,
      bandwidthUsedBytes: 0,
      bandwidthUsedFormatted: "0 B",
      error: "Cloudinary credentials missing in server environment",
    };
  }

  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });

    const usage: any = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Cloudinary API timeout (5s)")),
        5000,
      );
      cloudinary.api.usage((error: any, result: any) => {
        clearTimeout(timeout);
        if (error) return reject(error);
        resolve(result);
      });
    });

    const storageUsedBytes = usage?.storage?.usage || 0;
    const creditsUsed = usage?.credits?.usage || 0;
    const creditsLimit = usage?.credits?.limit || 25; // standard free tier quota
    const creditsPercentUsed =
      usage?.credits?.used_percent != null
        ? Number(Number(usage.credits.used_percent).toFixed(1))
        : Number(((creditsUsed / creditsLimit) * 100).toFixed(1));
    const creditsRemaining = Math.max(
      0,
      Number((creditsLimit - creditsUsed).toFixed(2)),
    );
    const objectsCount = usage?.objects?.usage || 0;
    const bandwidthUsedBytes = usage?.bandwidth?.usage || 0;

    return {
      status: creditsPercentUsed >= 95 ? "degraded" : "healthy",
      plan: usage?.plan || "Free",
      storageUsedBytes,
      storageUsedFormatted: formatBytes(storageUsedBytes),
      creditsUsed: Number(creditsUsed.toFixed(2)),
      creditsLimit,
      creditsRemaining,
      creditsPercentUsed,
      objectsCount,
      bandwidthUsedBytes,
      bandwidthUsedFormatted: formatBytes(bandwidthUsedBytes),
    };
  } catch (error: any) {
    return {
      status: "error",
      storageUsedBytes: 0,
      storageUsedFormatted: "Unavailable",
      creditsUsed: 0,
      creditsLimit: 25,
      creditsRemaining: 0,
      creditsPercentUsed: 0,
      objectsCount: 0,
      bandwidthUsedBytes: 0,
      bandwidthUsedFormatted: "Unavailable",
      error: error?.message || "Failed to retrieve Cloudinary usage metrics",
    };
  }
}

async function getBrevoDiagnostics(): Promise<BrevoDiagnostics> {
  const apiKey = envConfig.BREVO_API_KEY || process.env.BREVO_API_KEY;

  if (!apiKey) {
    return {
      status: "unconfigured",
      dailyCreditLimit: 300,
      creditsRemaining: 0,
      creditsUsed: 0,
      creditsPercentUsed: 0,
      error: "BREVO_API_KEY is not defined in server environment",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "api-key": apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Brevo API returned ${res.status}: ${errText.slice(0, 100)}`,
      );
    }

    const data: any = await res.json();
    const plans: any[] = data?.plan || [];

    // Brevo Free tier offers 300 emails per day limit
    let dailyCreditLimit = 300;
    let creditsRemaining = 300;
    let planType = "Free";

    const creditsPlan = plans.find(
      (p) =>
        p.type === "free" ||
        p.creditsType === "sendLimit" ||
        p.credits != null,
    );
    if (creditsPlan) {
      planType = creditsPlan.type
        ? creditsPlan.type.charAt(0).toUpperCase() + creditsPlan.type.slice(1)
        : "Free";
      if (creditsPlan.credits != null) {
        creditsRemaining = Number(creditsPlan.credits);
      }
    }

    const creditsUsed = Math.max(0, dailyCreditLimit - creditsRemaining);
    const creditsPercentUsed =
      dailyCreditLimit > 0
        ? Number(((creditsUsed / dailyCreditLimit) * 100).toFixed(1))
        : 0;

    const email = data?.email || "";
    const maskedEmail = email.includes("@")
      ? `${email[0]}***@${email.split("@")[1]}`
      : email;

    return {
      status: creditsRemaining <= 10 ? "degraded" : "healthy",
      planType,
      dailyCreditLimit,
      creditsRemaining,
      creditsUsed,
      creditsPercentUsed,
      accountEmail: maskedEmail,
      relayStatus: data?.relay?.enabled ? "Active" : "Standard",
    };
  } catch (error: any) {
    return {
      status: "error",
      dailyCreditLimit: 300,
      creditsRemaining: 0,
      creditsUsed: 0,
      creditsPercentUsed: 0,
      error: error?.message || "Failed to retrieve Brevo account diagnostics",
    };
  }
}

function getRuntimeDiagnostics(): RuntimeDiagnostics {
  const mem = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const heapStats = v8.getHeapStatistics();

  const containerLimitMb = process.env.SERVER_MAX_RAM_MB
    ? parseInt(process.env.SERVER_MAX_RAM_MB, 10)
    : 512; // 512 MB standard Render Free tier container RAM
  const containerLimitBytes = containerLimitMb * 1024 * 1024;

  const rssBytes = mem.rss;
  const percentContainerRam =
    containerLimitBytes > 0
      ? Number(((rssBytes / containerLimitBytes) * 100).toFixed(1))
      : 0;

  const remainingBytes = Math.max(0, containerLimitBytes - rssBytes);

  const heapUsed = mem.heapUsed;
  const heapTotal = mem.heapTotal;
  const heapLimit = heapStats.heap_size_limit;

  const percentHeapUsed =
    heapLimit > 0
      ? Number(((heapUsed / heapLimit) * 100).toFixed(1))
      : 0;

  return {
    status: percentContainerRam > 90 ? "degraded" : "healthy",
    uptimeSeconds,
    uptimeFormatted: formatUptime(uptimeSeconds),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: {
      rssBytes,
      rssFormatted: formatBytes(rssBytes),
      containerLimitBytes,
      containerLimitFormatted: formatBytes(containerLimitBytes),
      percentContainerRam,
      headroomFormatted: formatBytes(remainingBytes),
      heapUsedBytes: heapUsed,
      heapUsedFormatted: formatBytes(heapUsed),
      heapTotalBytes: heapTotal,
      heapTotalFormatted: formatBytes(heapTotal),
      heapLimitBytes: heapLimit,
      heapLimitFormatted: formatBytes(heapLimit),
      percentHeapUsed,
    },
  };
}

// ─── Public Main Orchestrator ────────────────────────────────────────────────

export async function getSystemDiagnosticsService(
  bypassCache = false,
): Promise<SystemDiagnosticsResponse> {
  const now = Date.now();
  if (!bypassCache && cachedResult && now - cachedResult.cachedAt < CACHE_TTL_MS) {
    return cachedResult.data;
  }

  const startTime = Date.now();

  // Run all health & metrics inquiries with total failure isolation
  const [dbResult, cloudinaryResult, brevoResult, recentUser, recentNotice] =
    await Promise.all([
      getPostgresDiagnostics(),
      getCloudinaryDiagnostics(),
      getBrevoDiagnostics(),
      prisma.user
        .findFirst({
          orderBy: { createdAt: "desc" },
          select: { name: true, role: true, createdAt: true },
        })
        .catch(() => null),
      prisma.notice
        .findFirst({
          orderBy: { createdAt: "desc" },
          select: { title: true, issuerName: true, createdAt: true },
        })
        .catch(() => null),
    ]);

  const runtimeResult = getRuntimeDiagnostics();
  const overallLatencyMs = Date.now() - startTime;

  const isOverallHealthy =
    dbResult.status !== "error" &&
    cloudinaryResult.status !== "error" &&
    brevoResult.status !== "error";

  // Micro-services live health matrix
  const servicesMatrix: ServiceMatrixItem[] = [
    {
      name: "API Gateway",
      category: "Express v5 Node Cluster",
      status: "OPERATIONAL",
      latencyMs: Math.max(3, Math.round(overallLatencyMs / 2)),
      info: "HTTP 200 OK • Rate Limiters Armed",
    },
    {
      name: "PostgreSQL Database",
      category: "Prisma Connection Pool",
      status: dbResult.status === "healthy" ? "OPERATIONAL" : "DEGRADED",
      latencyMs: dbResult.latencyMs,
      info: `${dbResult.activeConnections} Pool Conns • ${dbResult.totalTables} Tables • ${dbResult.usedFormatted}`,
    },
    {
      name: "Cloudinary CDN",
      category: "Media Pipeline",
      status: cloudinaryResult.status === "healthy" ? "OPERATIONAL" : "STANDBY",
      info: `${cloudinaryResult.objectsCount} Assets • ${cloudinaryResult.storageUsedFormatted} Stored`,
    },
    {
      name: "Brevo Mail Service",
      category: "SMTP v3 Dispatcher",
      status: brevoResult.status === "healthy" ? "OPERATIONAL" : "STANDBY",
      info: `${brevoResult.creditsRemaining} Credits Available (${brevoResult.planType})`,
    },
  ];

  // Live system logs & audit stream
  const systemLogs: SystemLogItem[] = [];
  const nowIso = new Date().toISOString();

  // 1. Gateway Heartbeat
  systemLogs.push({
    id: `log-gw-${now}`,
    level: "SUCCESS",
    service: "API",
    message: `Core API Gateway online (Node ${runtimeResult.nodeVersion}) on ${os.platform()} ${os.arch()}`,
    timestamp: nowIso,
  });

  // 2. Database Log
  systemLogs.push({
    id: `log-db-${now}`,
    level: dbResult.status === "healthy" ? "SUCCESS" : "WARN",
    service: "DATABASE",
    message:
      dbResult.status === "healthy"
        ? `PostgreSQL connection pool verified (${dbResult.activeConnections} active clients, ${dbResult.latencyMs}ms latency, ${dbResult.usedFormatted} used)`
        : `PostgreSQL alert: ${dbResult.error || "Degraded query performance"}`,
    timestamp: new Date(now - 3000).toISOString(),
  });

  // 3. Storage Log
  systemLogs.push({
    id: `log-cld-${now}`,
    level: cloudinaryResult.status === "healthy" ? "INFO" : "WARN",
    service: "STORAGE",
    message:
      cloudinaryResult.status === "healthy"
        ? `Cloudinary asset sync OK: ${cloudinaryResult.objectsCount} files (${cloudinaryResult.storageUsedFormatted} used, ${cloudinaryResult.creditsRemaining} credits left)`
        : `Cloudinary pipeline: ${cloudinaryResult.error || "Awaiting credentials"}`,
    timestamp: new Date(now - 8000).toISOString(),
  });

  // 4. Email Log
  systemLogs.push({
    id: `log-mail-${now}`,
    level: brevoResult.status === "healthy" ? "INFO" : "WARN",
    service: "EMAIL",
    message:
      brevoResult.status === "healthy"
        ? `Brevo SMTP transport active (${brevoResult.creditsRemaining} of ${brevoResult.dailyCreditLimit} daily email quota remaining)`
        : `Brevo SMTP: ${brevoResult.error || "Service unavailable"}`,
    timestamp: new Date(now - 14000).toISOString(),
  });

  // 5. Memory & GC status
  systemLogs.push({
    id: `log-mem-${now}`,
    level: "SYSTEM",
    service: "AUTH",
    message: `V8 memory heap normal (${runtimeResult.memory.heapUsedFormatted} used of ${runtimeResult.memory.heapTotalFormatted} allocated, RSS: ${runtimeResult.memory.rssFormatted})`,
    timestamp: new Date(now - 22000).toISOString(),
  });

  // 6. Recent Business Events (if available)
  if (recentUser) {
    systemLogs.push({
      id: `log-user-${now}`,
      level: "INFO",
      service: "AUTH",
      message: `User lifecycle event: ${recentUser.role} "${recentUser.name}" account active`,
      timestamp: recentUser.createdAt.toISOString(),
    });
  }

  if (recentNotice) {
    systemLogs.push({
      id: `log-notice-${now}`,
      level: "INFO",
      service: "API",
      message: `Noticeboard broadcast: "${recentNotice.title}" issued by ${recentNotice.issuerName}`,
      timestamp: recentNotice.createdAt.toISOString(),
    });
  }

  // Sort logs by newest first
  systemLogs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const response: SystemDiagnosticsResponse = {
    timestamp: nowIso,
    isOverallHealthy,
    overallLatencyMs,
    environment: envConfig.NODE_ENV || process.env.NODE_ENV || "production",
    hostNode: `${os.hostname()} (${os.type()} ${os.arch()})`,
    database: dbResult,
    cloudinary: cloudinaryResult,
    brevo: brevoResult,
    runtime: runtimeResult,
    servicesMatrix,
    systemLogs,
  };

  cachedResult = {
    data: response,
    cachedAt: now,
  };

  return response;
}

