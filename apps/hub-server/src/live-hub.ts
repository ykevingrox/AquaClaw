import { randomUUID } from 'node:crypto';

import type { GatewayStore, SeaEvent, SeaEventLiveSource } from './store.js';

const SEA_DELIVERY_ID_PATTERN = /^sea-delivery-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_MAX_BUFFERED_DELIVERIES = 200;

export interface SeaStreamDelivery {
  id: string;
  seaEvent: SeaEvent;
  activityGatewayIds: string[];
  currentChanged: boolean;
}

export interface SeaReplayWindow {
  retentionPolicy: 'count';
  maxBufferedDeliveries: number;
  retainedDeliveries: number;
  oldestAvailableCursor: string | null;
  latestAvailableCursor: string | null;
}

export type SeaStreamResyncReason = 'cursor_outside_replay_window' | 'invalid_cursor';

export interface SeaStreamResyncRequired {
  reason: SeaStreamResyncReason;
  cursor: string;
  action: 'refetch_and_reconnect';
  replayWindow: SeaReplayWindow;
}

export interface SeaLiveSubscription {
  backlog: SeaStreamDelivery[];
  latestVisibleDeliveryId: string | null;
  replayWindow: SeaReplayWindow;
  resyncRequired: SeaStreamResyncRequired | null;
  unsubscribe: () => void;
}

export interface SeaLiveHubOptions {
  maxBufferedDeliveries?: number;
}

interface Subscriber {
  viewerGatewayId: string;
  push: (delivery: SeaStreamDelivery) => void;
}

export class SeaLiveHub {
  private readonly deliveries: SeaStreamDelivery[] = [];
  private readonly subscribers = new Map<string, Subscriber>();
  private readonly maxBufferedDeliveries: number;

  constructor(
    private readonly store: GatewayStore,
    options: SeaLiveHubOptions = {},
  ) {
    this.maxBufferedDeliveries = Math.max(options.maxBufferedDeliveries ?? DEFAULT_MAX_BUFFERED_DELIVERIES, 1);
  }

  attach(source: SeaEventLiveSource) {
    return source.addSeaEventListener((event) => {
      this.publish(event);
    });
  }

  subscribe(input: {
    viewerGatewayId: string;
    cursor?: string | null;
    push: (delivery: SeaStreamDelivery) => void;
  }): SeaLiveSubscription {
    const cursor = input.cursor?.trim() || null;
    const replayWindow = this.describeReplayWindow();
    const subscriberId = randomUUID();
    this.subscribers.set(subscriberId, {
      viewerGatewayId: input.viewerGatewayId,
      push: input.push,
    });

    let backlogStartIndex = this.deliveries.length;
    let resyncRequired: SeaStreamResyncRequired | null = null;

    if (cursor) {
      if (!SEA_DELIVERY_ID_PATTERN.test(cursor)) {
        resyncRequired = this.createResyncRequired('invalid_cursor', cursor, replayWindow);
      } else {
        const cursorIndex = this.deliveries.findIndex((delivery) => delivery.id === cursor);
        if (cursorIndex >= 0) {
          backlogStartIndex = cursorIndex + 1;
        } else {
          backlogStartIndex = 0;
          resyncRequired = this.createResyncRequired('cursor_outside_replay_window', cursor, replayWindow);
        }
      }
    }

    const backlog = resyncRequired
      ? []
      : this.deliveries
          .slice(backlogStartIndex)
          .filter((delivery) => this.store.canViewSeaEvent(input.viewerGatewayId, delivery.seaEvent));
    const latestVisibleDeliveryId =
      this.findLatestVisibleDeliveryId(input.viewerGatewayId) ?? backlog.at(-1)?.id ?? null;

    return {
      backlog,
      latestVisibleDeliveryId,
      replayWindow,
      resyncRequired,
      unsubscribe: () => {
        this.subscribers.delete(subscriberId);
      },
    };
  }

  private publish(event: SeaEvent) {
    const delivery = this.createDelivery(event);
    this.deliveries.push(delivery);
    if (this.deliveries.length > this.maxBufferedDeliveries) {
      this.deliveries.splice(0, this.deliveries.length - this.maxBufferedDeliveries);
    }

    for (const subscriber of this.subscribers.values()) {
      if (this.store.canViewSeaEvent(subscriber.viewerGatewayId, event)) {
        subscriber.push(delivery);
      }
    }
  }

  private createDelivery(event: SeaEvent): SeaStreamDelivery {
    const activityGatewayIds = Array.from(
      new Set([event.actorGatewayId, event.subjectGatewayId, event.objectGatewayId].filter((value): value is string => Boolean(value))),
    );

    return {
      id: `sea-delivery-${randomUUID()}`,
      seaEvent: { ...event },
      activityGatewayIds,
      currentChanged: event.type === 'current.changed',
    };
  }

  private findLatestVisibleDeliveryId(viewerGatewayId: string) {
    for (let index = this.deliveries.length - 1; index >= 0; index -= 1) {
      const delivery = this.deliveries[index]!;
      if (this.store.canViewSeaEvent(viewerGatewayId, delivery.seaEvent)) {
        return delivery.id;
      }
    }

    return null;
  }

  private describeReplayWindow(): SeaReplayWindow {
    return {
      retentionPolicy: 'count',
      maxBufferedDeliveries: this.maxBufferedDeliveries,
      retainedDeliveries: this.deliveries.length,
      oldestAvailableCursor: this.deliveries[0]?.id ?? null,
      latestAvailableCursor: this.deliveries.at(-1)?.id ?? null,
    };
  }

  private createResyncRequired(
    reason: SeaStreamResyncReason,
    cursor: string,
    replayWindow: SeaReplayWindow,
  ): SeaStreamResyncRequired {
    return {
      reason,
      cursor,
      action: 'refetch_and_reconnect',
      replayWindow,
    };
  }
}
