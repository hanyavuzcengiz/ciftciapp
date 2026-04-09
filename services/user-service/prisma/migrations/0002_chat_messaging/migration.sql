-- Sohbet: mesajlar Postgres’te (messaging-service MESSAGING_DATABASE_URL ile bağlanır).
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_participants (
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_phone VARCHAR(20) NOT NULL,
  PRIMARY KEY (conversation_id, user_phone)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_phone VARCHAR(20) NOT NULL,
  content_ciphertext TEXT NOT NULL,
  message_type VARCHAR(16) NOT NULL,
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_participants_phone ON chat_participants(user_phone);
CREATE INDEX idx_chat_messages_conv_time ON chat_messages(conversation_id, created_at);
