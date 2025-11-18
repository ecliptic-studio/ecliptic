import type { GraphServiceClient } from "@microsoft/msgraph-sdk";
import { ErrorCode } from "@server/error/error-code.enum";
import type { TErrTuple } from "@server/error/error-code.types";
import { createError } from "@server/error/t-error";
import "@microsoft/msgraph-sdk-users";

type TMailboxCheckResult = {
  email: string;
  accessible: boolean;
  displayName?: string;
  mailboxType: 'personal' | 'shared' | 'unknown';
};

/**
 * Checks if a mailbox is accessible with the given Graph client
 * This is an effectful function (.fx) that reads from Microsoft Graph API
 *
 * @param portal - Portal object containing graphClient
 * @param args - Arguments containing email to check
 * @returns TErrTuple with mailbox check result or error
 */
export async function checkMailboxAccessFx(
  portal: { graphClient: GraphServiceClient },
  args: { email: string }
): Promise<TErrTuple<TMailboxCheckResult>> {
  try {
    // First, try to get the authenticated user's info
    let authenticatedUserEmail: string | undefined;
    try {
      const meResponse = await portal.graphClient.me.get();
      const mail = meResponse?.mail;
      const userPrincipalName = meResponse?.userPrincipalName;
      authenticatedUserEmail = mail ?? userPrincipalName ?? undefined;
    } catch (meError) {
      // If /me fails, we might not have user.read permission, but we can still try the mailbox
      console.warn('Failed to get /me, will try mailbox directly:', meError);
    }

    // Check if the email matches the authenticated user (personal mailbox)
    const isPersonalMailbox = authenticatedUserEmail?.toLowerCase() === args.email.toLowerCase();

    // Try to access messages from the mailbox
    try {
      let messagesResponse;

      if (isPersonalMailbox) {
        // Access personal mailbox via /me/messages
        messagesResponse = await portal.graphClient.me.messages.get({
          queryParameters: {
            top: 1, // Only fetch 1 message to verify access
            select: ['id', 'subject'],
          },
        });
      } else {
        // Access shared mailbox via /users/{email}/messages
        messagesResponse = await portal.graphClient.users.byUserId(args.email).messages.get({
          queryParameters: {
            top: 1,
            select: ['id', 'subject'],
          },
        });
      }

      // If we got here, the mailbox is accessible
      return [
        {
          email: args.email,
          accessible: true,
          displayName: authenticatedUserEmail,
          mailboxType: isPersonalMailbox ? 'personal' : 'shared',
        },
        null,
      ];
    } catch (messagesError: any) {
      // Failed to access messages - mailbox not accessible
      console.error('Failed to access mailbox messages:', messagesError);

      return [
        null,
        createError(ErrorCode.SR_MICROSOFT_MAILBOX_NOT_ACCESSIBLE)
          .statusCode(403)
          .internal(`Failed to access mailbox ${args.email}: ${messagesError.message || messagesError}`)
          .external({
            en: `Cannot access mailbox "${args.email}". Please ensure the account has read/write permissions to this mailbox.`,
            de: `Kann Mailbox "${args.email}" nicht zugreifen. Bitte stellen Sie sicher, dass der Account Lese- und Schreibzugriff auf diese Mailbox hat.`
          })
          .shouldLog(true)
          .buildEntry(),
      ];
    }
  } catch (error: any) {
    // General error during mailbox check
    console.error('Mailbox check failed:', error);

    return [
      null,
      createError(ErrorCode.SR_MICROSOFT_MAILBOX_CHECK_FAILED)
        .statusCode(500)
        .internal(`Mailbox check failed for ${args.email}: ${error.message || error}`)
        .external({
          en: 'Failed to verify mailbox access. Please try again.',
          de: 'Fehler beim Überprüfen des Mailbox-Zugriffs. Bitte versuchen Sie es erneut.'
        })
        .shouldLog(true)
        .buildEntry(),
    ];
  }
}
