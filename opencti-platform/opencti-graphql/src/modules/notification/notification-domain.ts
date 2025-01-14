import type { AuthContext, AuthUser } from '../../types/user';
import {
  createEntity,
  deleteElementById,
  patchAttribute,
  updateAttribute
} from '../../database/middleware';
import { notify } from '../../database/redis';
import { BUS_TOPICS } from '../../config/conf';
import type {
  EditInput,
  QueryNotificationsArgs,
  QueryTriggersArgs,
  TriggerDigestAddInput,
  TriggerLiveAddInput
} from '../../generated/graphql';
import {
  internalFindByIds,
  listEntitiesPaginated,
  storeLoadById,
} from '../../database/middleware-loader';
import {
  BasicStoreEntityLiveTrigger,
  BasicStoreEntityNotification,
  BasicStoreEntityTrigger,
  ENTITY_TYPE_NOTIFICATION,
  ENTITY_TYPE_TRIGGER,
  NOTIFICATION_NUMBER,
  NotificationAddInput
} from './notification-types';
import { now } from '../../utils/format';
import { elCount } from '../../database/engine';
import { READ_INDEX_INTERNAL_OBJECTS } from '../../database/utils';

// Outcomes

// Triggers
export const addLiveTrigger = async (context: AuthContext, user: AuthUser, trigger: TriggerLiveAddInput): Promise<BasicStoreEntityLiveTrigger> => {
  const defaultOpts = { trigger_type: 'live', user_ids: [user.id], group_ids: [], created: now(), updated: now() };
  const liveTrigger = { ...trigger, ...defaultOpts };
  const created = await createEntity(context, user, liveTrigger, ENTITY_TYPE_TRIGGER);
  return notify(BUS_TOPICS[ENTITY_TYPE_TRIGGER].ADDED_TOPIC, created, user);
};
export const addDigestTrigger = async (context: AuthContext, user: AuthUser, trigger: TriggerDigestAddInput) => {
  const defaultOpts = { trigger_type: 'digest', user_ids: [user.id], group_ids: [], created: now(), updated: now() };
  const digestTrigger = { ...trigger, ...defaultOpts };
  const created = await createEntity(context, user, digestTrigger, ENTITY_TYPE_TRIGGER);
  return notify(BUS_TOPICS[ENTITY_TYPE_TRIGGER].ADDED_TOPIC, created, user);
};
export const triggerGet = (context: AuthContext, user: AuthUser, triggerId: string): BasicStoreEntityTrigger => {
  return storeLoadById(context, user, triggerId, ENTITY_TYPE_TRIGGER) as unknown as BasicStoreEntityTrigger;
};

export const triggersGet = (context: AuthContext, user: AuthUser, triggerIds: string[]): BasicStoreEntityTrigger[] => {
  return internalFindByIds(context, user, triggerIds) as unknown as BasicStoreEntityTrigger[];
};

export const triggerEdit = async (context: AuthContext, user: AuthUser, triggerId: string, input: EditInput[]) => {
  const { element: updatedElem } = await updateAttribute(context, user, triggerId, ENTITY_TYPE_TRIGGER, input);
  return notify(BUS_TOPICS[ENTITY_TYPE_TRIGGER].EDIT_TOPIC, updatedElem, user);
};
export const triggerDelete = async (context: AuthContext, user: AuthUser, triggerId: string) => {
  const element = await deleteElementById(context, user, triggerId, ENTITY_TYPE_TRIGGER);
  await notify(BUS_TOPICS[ENTITY_TYPE_TRIGGER].DELETE_TOPIC, element, user);
  return triggerId;
};
export const triggersFind = (context: AuthContext, user: AuthUser, opts: QueryTriggersArgs) => {
  return listEntitiesPaginated<BasicStoreEntityTrigger>(context, user, [ENTITY_TYPE_TRIGGER], opts);
};

export const myTriggersFind = (context: AuthContext, user: AuthUser, opts: QueryTriggersArgs) => {
  const queryFilters = [...(opts.filters || []), { key: 'user_ids', values: [user.id] }];
  const queryArgs = { ...opts, filters: queryFilters };
  return listEntitiesPaginated<BasicStoreEntityTrigger>(context, user, [ENTITY_TYPE_TRIGGER], queryArgs);
};

// region Notifications
export const notificationGet = (context: AuthContext, user: AuthUser, narrativeId: string): BasicStoreEntityNotification => {
  return storeLoadById(context, user, narrativeId, ENTITY_TYPE_NOTIFICATION) as unknown as BasicStoreEntityNotification;
};

export const notificationsFind = (context: AuthContext, user: AuthUser, opts: QueryNotificationsArgs) => {
  return listEntitiesPaginated<BasicStoreEntityNotification>(context, user, [ENTITY_TYPE_NOTIFICATION], opts);
};

export const myNotificationsFind = (context: AuthContext, user: AuthUser, opts: QueryNotificationsArgs) => {
  const queryFilters = [...(opts.filters || []), { key: 'user_id', values: [user.id] }];
  const queryArgs = { ...opts, filters: queryFilters };
  return listEntitiesPaginated<BasicStoreEntityNotification>(context, user, [ENTITY_TYPE_NOTIFICATION], queryArgs);
};

export const myUnreadNotificationsCount = async (context: AuthContext, user: AuthUser, userId = null) => {
  const queryFilters = [{ key: 'user_id', values: [userId ?? user.id] }, { key: 'is_read', values: [false] }];
  const queryArgs = { filters: queryFilters };
  return elCount(context, user, READ_INDEX_INTERNAL_OBJECTS, { ...queryArgs, types: [ENTITY_TYPE_NOTIFICATION] });
};

export const notificationDelete = async (context: AuthContext, user: AuthUser, notificationId: string) => {
  const notification = await notificationGet(context, user, notificationId);
  await deleteElementById(context, user, notificationId, ENTITY_TYPE_NOTIFICATION);
  const unreadNotificationsCount = await myUnreadNotificationsCount(context, user);
  await notify(BUS_TOPICS[NOTIFICATION_NUMBER].EDIT_TOPIC, { count: unreadNotificationsCount, user_id: notification.user_id }, user);
  return notificationId;
};

export const notificationEditRead = async (context: AuthContext, user: AuthUser, notificationId: string, read: boolean) => {
  const { element } = await patchAttribute(context, user, notificationId, ENTITY_TYPE_NOTIFICATION, { is_read: read });
  const unreadNotificationsCount = await myUnreadNotificationsCount(context, user);
  await notify(BUS_TOPICS[NOTIFICATION_NUMBER].EDIT_TOPIC, { count: unreadNotificationsCount, user_id: element.user_id }, user);
  return notify(BUS_TOPICS[ENTITY_TYPE_NOTIFICATION].EDIT_TOPIC, element, user);
};

export const addNotification = async (context: AuthContext, user: AuthUser, notification: NotificationAddInput) => {
  const created = await createEntity(context, user, notification, ENTITY_TYPE_NOTIFICATION);
  const unreadNotificationsCount = await myUnreadNotificationsCount(context, user, created.user_id);
  await notify(BUS_TOPICS[NOTIFICATION_NUMBER].EDIT_TOPIC, { count: unreadNotificationsCount, user_id: created.user_id }, user);
  return notify(BUS_TOPICS[ENTITY_TYPE_NOTIFICATION].ADDED_TOPIC, created, user);
};
// endregion
