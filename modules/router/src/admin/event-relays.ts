import { status } from '@grpc/grpc-js';
import {
  GrpcError,
  ParsedRouterRequest,
  Query,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash-es';
import { EventRelay } from '../models/index.js';
import { EventRelayManager } from '../event-relays/EventRelayManager.js';
import { EventRelayInput, validateEventRelayInput } from '../event-relays/validation.js';
import { EventRelayValidationError } from '../event-relays/validationError.js';
import { renderMessageTemplate } from '../event-relays/template.js';
import { buildSearchQuery, parsePagination } from '../event-relays/search.js';
import { assertJsonPayloadSize } from '../event-relays/process.js';

export class EventRelayAdmin {
  constructor(private readonly manager: EventRelayManager) {}

  async listEventRelays(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit } = parsePagination(
      call.request.params.skip,
      call.request.params.limit,
    );
    const { search } = call.request.params;
    const query = buildSearchQuery(search) as Query<EventRelay>;
    const relays = await EventRelay.getInstance().findMany(query, {
      skip,
      limit,
      sort: { updatedAt: -1 },
    });
    const count = await EventRelay.getInstance().countDocuments(query);
    return { relays, count };
  }

  async getEventRelay(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const relay = await EventRelay.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(relay)) {
      throw new GrpcError(status.NOT_FOUND, 'Event relay not found');
    }
    return relay;
  }

  async createEventRelay(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const input = parseInput(call.request.params as EventRelayInput);
    await assertUniqueName(input.name);
    const relay = await EventRelay.getInstance().create({
      ...input,
      messageTemplate: input.messageTemplate as EventRelay['messageTemplate'],
    });
    await this.manager.notifyChanged();
    return relay;
  }

  async previewEventRelay(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { messageTemplate, samplePayload } = call.request.params as {
      messageTemplate: unknown;
      samplePayload: unknown;
    };
    try {
      assertJsonPayloadSize(samplePayload);
      const rendered = renderMessageTemplate(messageTemplate, samplePayload);
      return { rendered };
    } catch (err) {
      if (err instanceof EventRelayValidationError) {
        throw new GrpcError(status.INVALID_ARGUMENT, err.message);
      }
      throw err;
    }
  }

  async patchEventRelay(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const existing = await EventRelay.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(existing)) {
      throw new GrpcError(status.NOT_FOUND, 'Event relay not found');
    }

    const merged: EventRelayInput = {
      name: call.request.params.name ?? existing.name,
      notes:
        call.request.params.notes === undefined
          ? existing.notes
          : call.request.params.notes,
      active:
        call.request.params.active === undefined
          ? existing.active
          : call.request.params.active,
      busEvent: call.request.params.busEvent ?? existing.busEvent,
      socketEvent: call.request.params.socketEvent ?? existing.socketEvent,
      resourceType: call.request.params.resourceType ?? existing.resourceType,
      resourceIdPath: call.request.params.resourceIdPath ?? existing.resourceIdPath,
      permission: call.request.params.permission ?? existing.permission,
      messageTemplate:
        call.request.params.messageTemplate === undefined
          ? existing.messageTemplate
          : call.request.params.messageTemplate,
    };
    const input = parseInput(merged);
    if (input.name !== existing.name) {
      await assertUniqueName(input.name, existing._id);
    }

    const updated = await EventRelay.getInstance().findByIdAndUpdate(existing._id, {
      ...input,
      messageTemplate: input.messageTemplate as EventRelay['messageTemplate'],
    });
    const evictRelayIds: string[] = [];
    if (!input.active) {
      evictRelayIds.push(existing._id);
    } else if (
      input.permission !== existing.permission ||
      input.resourceType !== existing.resourceType
    ) {
      evictRelayIds.push(existing._id);
    }
    await this.manager.notifyChanged({
      evictRelayIds: evictRelayIds.length ? evictRelayIds : undefined,
    });
    return updated!;
  }

  async deleteEventRelay(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const existing = await EventRelay.getInstance().findOne({
      _id: call.request.params.id,
    });
    if (isNil(existing)) {
      throw new GrpcError(status.NOT_FOUND, 'Event relay not found');
    }
    await EventRelay.getInstance().deleteOne({ _id: existing._id });
    await this.manager.notifyChanged({ evictRelayIds: [existing._id] });
    return { message: 'Event relay deleted' };
  }
}

function parseInput(params: EventRelayInput): EventRelayInput {
  try {
    return validateEventRelayInput(params);
  } catch (err) {
    if (err instanceof EventRelayValidationError) {
      throw new GrpcError(status.INVALID_ARGUMENT, err.message);
    }
    throw err;
  }
}

async function assertUniqueName(name: string, excludeId?: string): Promise<void> {
  const existing = await EventRelay.getInstance().findOne({ name });
  if (existing && existing._id !== excludeId) {
    throw new GrpcError(
      status.ALREADY_EXISTS,
      `An event relay named '${name}' already exists`,
    );
  }
}
