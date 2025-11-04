import { defaultErrorMap, replaceParams, t, type TLang } from "@public/i18n/t";
import type { TErrorStatus, TErrorEntry, TErrTuple } from "./error-code.types";

export class TErrorBuilder {
  private errorEntry: Partial<TErrorEntry> = {};

  constructor(code?: string, external?: Partial<Record<TLang, string>> & { fallback?: string }) {
    if (code) this.errorEntry.code = code ?? 'UNKNOWN_ERROR';
    if (external) this.errorEntry.external = external ?? defaultErrorMap;
  }

  statusCode(statusCode: TErrorStatus): TErrorBuilder {
    this.errorEntry.statusCode = statusCode;
    return this;
  }

  code(code: string): TErrorBuilder {
    this.errorEntry.code = code;
    return this;
  }

  params(params: Record<string, string>): TErrorBuilder {
    this.errorEntry.params = params;
    return this;
  }

  external(external: Partial<Record<TLang, string>> & { fallback?: string }): TErrorBuilder {
    this.errorEntry.external = external;
    return this;
  }

  internal(internal: string): TErrorBuilder {
    this.errorEntry.internal = internal;
    return this;
  }

  shouldLog(shouldLog?: boolean): TErrorBuilder {
    this.errorEntry.shouldLog = shouldLog ?? true;
    return this;
  }

  appId(appId?: string): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.appId = appId;
    return this;
  }

  appBranchName(appBranchName?: string): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.appBranchName = appBranchName;
    return this;
  }

  environment(environment?: string): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.environment = environment;
    return this;
  }

  serviceId(serviceId?: string): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.serviceId = serviceId;
    return this;
  }

  serviceResourceId(serviceResourceId?: string): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.serviceResourceId = serviceResourceId;
    return this;
  }

  needsAction(needsAction?: boolean): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.needsAction = needsAction;
    return this;
  }

  isResolved(isResolved?: boolean): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.isResolved = isResolved;
    return this;
  }

  needsActionReason(reason?: string): TErrorBuilder {
    if (!this.errorEntry.logParams) {
      this.errorEntry.logParams = {};
    }
    this.errorEntry.logParams.needsAction = true;
    this.errorEntry.logParams.needsActionReason = reason;
    return this;
  }

  logParams(logParams: TErrorEntry['logParams']): TErrorBuilder {
    this.errorEntry.logParams = logParams;
    return this;
  }

  buildEntry(): TErrorEntry {
    return this.errorEntry as TErrorEntry;
  }

  buildTErrTuple<T>(): TErrTuple<T> {
    return [null, this.buildEntry()];
  }
}

export function createError(code?: string, external?: Partial<Record<TLang, string>> & { fallback?: string }): TErrorBuilder {
  return new TErrorBuilder(code, external);
}

// fall back to external if internal is not set
export function tInternal(lang: TLang, err: TErrorEntry): string {
  return err.internal ? replaceParams(err.internal, err.params ?? {}) : tExternal(lang, err);
}

export function tExternal(lang: TLang, err: TErrorEntry): string {
  return t(lang, err.external ?? defaultErrorMap, err.params);
}