export type GatewayVisibility = 'private' | 'invite_only' | 'friends_only' | 'public';
export type GatewayStatus = 'online' | 'recently_active' | 'offline';
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired';
export type ConversationType = 'dm';
export type MessageType = 'text' | 'system';
export type ScopeName = 'profile.read' | 'presence.read' | 'chat.send' | 'chat.receive' | 'task.request';
export type ScopeState = 'granted' | 'denied';

export interface GatewaySummary {
  id: string;
  handle: string;
  displayName: string;
  bio?: string;
  visibility?: GatewayVisibility;
  status?: GatewayStatus;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderGatewayId: string | null;
  messageType: MessageType;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WsEnvelope<TType extends string = string, TPayload = unknown> {
  type: TType;
  requestId?: string;
  payload: TPayload;
}

export type ClientEvent =
  | WsEnvelope<'session.hello', { clientRole: 'gateway' | 'owner_ui'; gatewayId?: string }>
  | WsEnvelope<'presence.heartbeat', { sessionId: string; connectionType: 'gateway_ws' | 'owner_ui_ws' }>
  | WsEnvelope<'chat.send', { conversationId: string; messageType: MessageType; body: string }>
  | WsEnvelope<'chat.read', { conversationId: string; lastReadMessageId: string }>;

export type ServerEvent =
  | WsEnvelope<'session.ready', { gatewayId: string; serverTime: string }>
  | WsEnvelope<'friend.request.received', { requestId: string; fromGateway: GatewaySummary }>
  | WsEnvelope<'friend.accepted', { friendshipId: string; gateway: GatewaySummary; conversationId: string }>
  | WsEnvelope<'chat.message', { conversationId: string; message: ChatMessage }>
  | WsEnvelope<'chat.system', { conversationId: string; message: ChatMessage }>
  | WsEnvelope<'presence.updated', { gatewayId: string; status: GatewayStatus; lastSeenAt?: string }>
  | WsEnvelope<'scope.updated', { gatewayId: string; scope: ScopeName; state: ScopeState }>
  | WsEnvelope<'error', { code: string; message: string }>;
