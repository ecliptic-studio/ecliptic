import type { TErrTriple, TExternalRollback } from "./error-code.types";
import { tExternal } from "./t-error";

/**
 * Executes a (nested) list of rollbacks in reverse order.
 * Returns a list of logs
 */
export async function executeRollbacks(rollbacks: TExternalRollback[]): Promise<string[]> {
  const results: string[] = []
  for (const rollback of rollbacks.reverse()) {
    const [rollbackRes, rollbackResError, rollbackResRollbacks] = await rollback().catch(e => {
      return [null, {
        code: 'ROLLBACK_EXCEPTION',
        statusCode: 'Internal Server Error',
        internal: `Rollback exception: ${e}`,
        external: {
          en: 'Rollback exception',
          de: 'Rollback-Ausnahme',
        }
      }, []] as TErrTriple<string>
    })
    const rollbackResRollbacksResults = await executeRollbacks(rollbackResRollbacks)
    if (rollbackResRollbacksResults) {
      results.push(...rollbackResRollbacksResults)
    }
    if (rollbackResError) {
      console.error(rollbackResError)
      results.push(tExternal('en', rollbackResError))
    }
    if (rollbackRes) {
      results.push(rollbackRes)
    }
  }
  return results
}