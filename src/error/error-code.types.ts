import type { TLang } from "@public/i18n/t";

// Subset of StatusMap from elysia, only for error codes
export type TErrorStatus = "Bad Request" | "Unauthorized" | "Payment Required" | "Forbidden" | "Not Found" | "Method Not Allowed" | "Not Acceptable" | "Proxy Authentication Required" | "Request Timeout" | "Conflict" | "Gone" | "Length Required" | "Precondition Failed" | "Payload Too Large" | "URI Too Long" | "Unsupported Media Type" | "Range Not Satisfiable" | "Expectation Failed" | "I'm a teapot" | "Enhance Your Calm" | "Misdirected Request" | "Unprocessable Content" | "Locked" | "Failed Dependency" | "Too Early" | "Upgrade Required" | "Precondition Required" | "Too Many Requests" | "Unavailable For Legal Reasons" | "Internal Server Error" | "Not Implemented" | "Bad Gateway" | "Service Unavailable" | "Gateway Timeout" | "HTTP Version Not Supported" | "Variant Also Negotiates" | "Insufficient Storage" | "Loop Detected" | "Not Extended" | "Network Authentication Required"

/**
 * Explaination of the error code:
 * 
 * code: string; Unique identifier for the error code use dot notation to indicate the module and the function that caused the error. E.g. "SR.ON_START_CHECKS_FX.MISSING_SERVER_FILE"
 * params?: Record<string, string>; Optional parameters to be used in the error message. Text replacement look search for "my error message: {param1} {param2}"
 * external: Partial<Record<TLang, string>> & { fallback?: string }; The error message to be displayed to the user. Must be written in a way that is easy to understand and does not expose any internal implementation details.
 * internal?: Partial<Record<TLang, string>> & { fallback?: string }; The error message to be displayed to the developer. Can contain internal implementation details.
 */
export type TErrorEntry = {
  code: string;
  params?: Record<string, string>;
  external?: Partial<Record<TLang, string>> & { fallback?: string };
  internal?: string;
  shouldLog?: boolean;
  statusCode: TErrorStatus;
  logParams?: {
    appId?: string;
    needsAction?: boolean;
    isResolved?: boolean;
    serviceId?: string;
    serviceResourceId?: string;
    needsActionReason?: string;
    metadata?: Record<string, string>;
    environment?: string;
    appBranchName?: string;
  }
}

/**
 * A fn[] that can be used to rollback an external action.
 * Like deleting a neon project or github repo from a different service.
 * In rare cases the rollback might fail and return it's own rollback function.
 * In success full cases the rollback function returns a loggable string.
 * Database rollbacks are not supported. It is expected to use transactions instead.
 * 
 * Note that rollbacks are expected to be executed sequentially in reverse order.
 */
export type TExternalRollback = () => Promise<TErrTriple<string>>;

export type TErrTuple<T> = [T, null] | [null, TErrorEntry];
/**
 * Every effectful function should return a TErrTriple.
 * No Rollback should be internally executed.
 * The caller is responsible for executing the rollbacks in reverse order.
 */
export type TErrTriple<T> = [T, null, TExternalRollback[]] | [null, TErrorEntry, TExternalRollback[]];
