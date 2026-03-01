import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { TradingRule, loadRules, saveRules, checkAllRules, executeAction } from "./rules";

export type SchedulerInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "daily";

export interface ScheduledTask {
  id: string;
  name: string;
  enabled: boolean;
  interval: SchedulerInterval;
  rules: TradingRule[];
  lastRun?: number;
  nextRun?: number;
  onExecute?: (results: { rule: TradingRule; result: { success: boolean; message: string } }[]) => void;
}

export interface SchedulerConfig {
  enabled: boolean;
  defaultInterval: SchedulerInterval;
  checkOnStart: boolean;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  enabled: true,
  defaultInterval: "5m",
  checkOnStart: true,
};

const INTERVAL_MS: Record<SchedulerInterval, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

function getSchedulerConfigPath(): string {
  return join(homedir(), ".polymarket-tui", "scheduler.json");
}

export function loadSchedulerConfig(): SchedulerConfig {
  try {
    const path = getSchedulerConfigPath();
    if (existsSync(path)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(path, "utf-8")) };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveSchedulerConfig(config: SchedulerConfig): void {
  const path = getSchedulerConfigPath();
  try {
    writeFileSync(path, JSON.stringify(config, null, 2));
  } catch {
    console.error("Failed to save scheduler config");
  }
}

export class RuleScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private intervals: Map<string, number> = new Map();
  private running: boolean = false;
  private config: SchedulerConfig;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  createTask(name: string, interval: SchedulerInterval = "5m", rules?: TradingRule[]): ScheduledTask {
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      interval,
      rules: rules || [],
      nextRun: Date.now(),
    };
    this.tasks.set(task.id, task);
    return task;
  }

  addRuleToTask(taskId: string, rule: TradingRule): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.rules.push(rule);
      saveRules(task.rules);
    }
  }

  removeRuleFromTask(taskId: string, ruleId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.rules = task.rules.filter((r) => r.id !== ruleId);
      saveRules(task.rules);
    }
  }

  enableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = true;
      task.nextRun = Date.now();
    }
  }

  disableTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.enabled = false;
      task.nextRun = undefined;
    }
  }

  removeTask(taskId: string): void {
    this.stopTask(taskId);
    this.tasks.delete(taskId);
  }

  private startTask(task: ScheduledTask): void {
    if (this.intervals.has(task.id)) return;

    const runTask = async () => {
      if (!task.enabled || task.rules.length === 0) return;

      const results: { rule: TradingRule; result: { success: boolean; message: string } }[] = [];
      const enabledRules = task.rules.filter((r) => r.enabled);

      for (const rule of enabledRules) {
        const context = {};
        const result = await executeAction(rule.action, context);
        results.push({ rule, result });
        rule.lastTriggered = Date.now();
      }

      task.lastRun = Date.now();
      task.nextRun = Date.now() + INTERVAL_MS[task.interval];

      if (task.onExecute) {
        task.onExecute(results);
      }

      saveRules(task.rules);
    };

    runTask();
    const intervalId = setInterval(runTask, INTERVAL_MS[task.interval]);
    this.intervals.set(task.id, intervalId);
  }

  private stopTask(taskId: string): void {
    const intervalId = this.intervals.get(taskId);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(taskId);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.startTask(task);
      }
    }
  }

  stop(): void {
    for (const taskId of this.intervals.keys()) {
      this.stopTask(taskId);
    }
    this.running = false;
  }

  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  isRunning(): boolean {
    return this.running;
  }

  getNextRun(taskId: string): number | undefined {
    return this.tasks.get(taskId)?.nextRun;
  }

  getLastRun(taskId: string): number | undefined {
    return this.tasks.get(taskId)?.lastRun;
  }

  runOnce(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      const runTask = async () => {
        if (!task.enabled || task.rules.length === 0) return;

        const results: { rule: TradingRule; result: { success: boolean; message: string } }[] = [];
        const context = {};

        for (const rule of task.rules.filter((r) => r.enabled)) {
          const result = await executeAction(rule.action, context);
          results.push({ rule, result });
          rule.lastTriggered = Date.now();
        }

        task.lastRun = Date.now();
        if (task.onExecute) {
          task.onExecute(results);
        }
      };
      runTask();
    }
  }
}

let schedulerInstance: RuleScheduler | null = null;

export function getScheduler(config?: Partial<SchedulerConfig>): RuleScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new RuleScheduler(config);
  }
  return schedulerInstance;
}

export function startScheduler(config?: Partial<SchedulerConfig>): RuleScheduler {
  const scheduler = getScheduler(config);
  scheduler.start();
  return scheduler;
}

export function stopScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
  }
}
