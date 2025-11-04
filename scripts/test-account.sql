INSERT INTO "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "banned", "banReason", "banExpires") VALUES
('oYQQn2wKmxQfGkNqDIw9Tr6cEQFl8WD3', 'Bob', 'bob@bob.bob', 0, NULL, '2025-10-25T20:58:21.484Z', '2025-10-25T20:58:21.484Z', 'user', 0, NULL, NULL);

INSERT INTO "account" ("id", "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", "scope", "password", "createdAt", "updatedAt") VALUES
('juc1l6Du7e41ZHmP0moA2BZBFgfExIhr', 'oYQQn2wKmxQfGkNqDIw9Tr6cEQFl8WD3', 'credential', 'oYQQn2wKmxQfGkNqDIw9Tr6cEQFl8WD3', NULL, NULL, NULL, NULL, NULL, NULL, 'e073d858cb8044003a1414888b070256:61cc3a7b463ae310ff78591ea62dfacfaeb80f89e89ee02fb780641387c20217ddba2efe0a051d01b5b0662d4db86b1a23497062e732e30513cf1f2dbe32ddf9', '2025-10-25T20:58:21.495Z', '2025-10-25T20:58:21.495Z');

INSERT INTO "session" ("id", "expiresAt", "token", "createdAt", "updatedAt", "ipAddress", "userAgent", "userId", "impersonatedBy", "activeOrganizationId") VALUES
('mHMvySSR7Td94XZJpwmkkSBAhBkydBet', '2025-11-01T20:58:21.497Z', 'dyp3cqhmGaLoux3PR2l6tsZMQouyw1UX', '2025-10-25T20:58:21.497Z', '2025-10-25T20:58:30.129Z', '', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 'oYQQn2wKmxQfGkNqDIw9Tr6cEQFl8WD3', NULL, 'iNauxb61kdmL6RTjCMtHZ');

INSERT INTO "organization" ("id", "name", "slug", "logo", "createdAt", "metadata") VALUES
('iNauxb61kdmL6RTjCMtHZ', 'Bob', 'bob', NULL, '2025-10-25T20:58:21.492Z', '{"type":"personal"}');

INSERT INTO
    "member" (
        "id",
        "organizationId",
        "userId",
        "role",
        "createdAt"
    )
VALUES
    (
        'mlFS2OeFI2ayieWYnIKYR',
        'iNauxb61kdmL6RTjCMtHZ',
        'oYQQn2wKmxQfGkNqDIw9Tr6cEQFl8WD3',
        'owner',
        '2025-10-25T20:58:21.493Z'
    );