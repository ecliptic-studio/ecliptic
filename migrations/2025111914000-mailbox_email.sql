CREATE TABLE IF NOT EXISTS mailbox_email (
    id TEXT NOT NULL PRIMARY KEY,
    external_id TEXT UNIQUE, -- expect that external mail provider will provide a unique id for each email
    mailbox_email TEXT NOT NULL REFERENCES mailbox(email) ON DELETE CASCADE,

    bcc_recipients TEXT NOT NULL DEFAULT '[]', -- {name: string, value: string}[]
    cc_recipients TEXT NOT NULL DEFAULT '[]', -- {name: string, value: string}[]
    to_recipients TEXT NOT NULL DEFAULT '[]', -- {name: string, value: string}[]
    "from" TEXT, -- {name: string, value: string}
    conversation_id TEXT,
    conversation_index TEXT,
    has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
    created_date_time TEXT,
    sent_date_time TEXT,
    received_date_time TEXT,
    body TEXT, -- {contentType: 'text' | 'html', content: string}
    subject TEXT NOT NULL,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_mailbox_email_conversation_index ON mailbox_email(conversation_index);
CREATE INDEX IF NOT EXISTS idx_mailbox_email_external_id ON mailbox_email(external_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_email_conversation_id ON mailbox_email(conversation_id);
CREATE INDEX IF NOT EXISTS idx_mailbox_email_created_date_time ON mailbox_email(created_date_time);
CREATE INDEX IF NOT EXISTS idx_mailbox_email_is_draft ON mailbox_email(is_draft);
CREATE INDEX IF NOT EXISTS idx_mailbox_email_from ON mailbox_email("from");
