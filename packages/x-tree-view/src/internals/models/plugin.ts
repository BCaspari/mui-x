import * as React from 'react';
import { EventHandlers } from '@mui/base/utils';
import { TreeViewModel } from './treeView';
import type { MergePluginsProperty, OptionalIfEmpty } from './helpers';
import { TreeViewEventLookupElement } from './events';
import type { TreeViewCorePluginsSignature } from '../corePlugins';
import type { TreeItemProps } from '../../TreeItem';

export interface TreeViewPluginOptions<TSignature extends TreeViewAnyPluginSignature> {
  instance: TreeViewUsedInstance<TSignature>;
  params: TreeViewUsedDefaultizedParams<TSignature>;
  state: TreeViewUsedState<TSignature>;
  models: TreeViewUsedModels<TSignature>;
  setState: React.Dispatch<React.SetStateAction<TreeViewUsedState<TSignature>>>;
  rootRef: React.RefObject<HTMLUListElement>;
}

type TreeViewModelsInitializer<TSignature extends TreeViewAnyPluginSignature> = {
  [TControlled in keyof TSignature['models']]: {
    controlledProp: TControlled;
    defaultProp: keyof TSignature['params'];
  };
};

type TreeViewResponse<TSignature extends TreeViewAnyPluginSignature> = {
  getRootProps?: <TOther extends EventHandlers = {}>(
    otherHandlers: TOther,
  ) => React.HTMLAttributes<HTMLUListElement>;
} & OptionalIfEmpty<'contextValue', TSignature['contextValue']>;

export type TreeViewPluginSignature<
  TParams extends {},
  TDefaultizedParams extends {},
  TInstance extends {},
  TEvents extends { [key in keyof TEvents]: TreeViewEventLookupElement },
  TState extends {},
  TContextValue extends {},
  TModelNames extends keyof TDefaultizedParams,
  TDependantPlugins extends readonly TreeViewAnyPluginSignature[],
> = {
  params: TParams;
  defaultizedParams: TDefaultizedParams;
  instance: TInstance;
  state: TState;
  models: {
    [TControlled in TModelNames]-?: TreeViewModel<
      Exclude<TDefaultizedParams[TControlled], undefined>
    >;
  };
  events: TEvents;
  contextValue: TContextValue;
  dependantPlugins: TDependantPlugins;
};

export type TreeViewAnyPluginSignature = {
  state: any;
  instance: any;
  params: any;
  defaultizedParams: any;
  dependantPlugins: any;
  events: any;
  contextValue: any;
  models: any;
};

type TreeViewUsedPlugins<TSignature extends TreeViewAnyPluginSignature> = [
  TreeViewCorePluginsSignature,
  ...TSignature['dependantPlugins'],
];

type TreeViewUsedParams<TSignature extends TreeViewAnyPluginSignature> = TSignature['params'] &
  MergePluginsProperty<TreeViewUsedPlugins<TSignature>, 'params'>;

type TreeViewUsedDefaultizedParams<TSignature extends TreeViewAnyPluginSignature> =
  TSignature['defaultizedParams'] &
    MergePluginsProperty<TreeViewUsedPlugins<TSignature>, 'defaultizedParams'>;

export type TreeViewUsedInstance<TSignature extends TreeViewAnyPluginSignature> =
  TSignature['instance'] &
    MergePluginsProperty<TreeViewUsedPlugins<TSignature>, 'instance'> & {
      /**
       * Private property only defined in TypeScript to be able to access the plugin signature from the instance object.
       */
      $$signature: TSignature;
    };

type TreeViewUsedState<TSignature extends TreeViewAnyPluginSignature> = TSignature['state'] &
  MergePluginsProperty<TreeViewUsedPlugins<TSignature>, 'state'>;

export type TreeViewUsedModels<TSignature extends TreeViewAnyPluginSignature> =
  TSignature['models'] & MergePluginsProperty<TreeViewUsedPlugins<TSignature>, 'models'>;

export type TreeViewUsedEvents<TSignature extends TreeViewAnyPluginSignature> =
  TSignature['events'] & MergePluginsProperty<TreeViewUsedPlugins<TSignature>, 'events'>;

export interface TreeViewItemPluginOptions {
  props: TreeItemProps;
  ref: React.Ref<HTMLLIElement>;
}

export interface TreeViewItemPluginResponse {
  /**
   * Props enriched by the plugin.
   */
  props?: TreeItemProps;
  /**
   * Ref enriched by the plugin
   */
  ref?: React.Ref<HTMLLIElement>;
  /**
   * Render function used to add React wrappers around the TreeItem.
   * @param {React.ReactNode} children The TreeItem node before this plugin execution.
   * @returns {React.ReactNode} The wrapped TreeItem.
   */
  wrapItem?: (children: React.ReactNode) => React.ReactNode;
}

export type TreeViewItemPlugin = (
  options: TreeViewItemPluginOptions,
) => void | TreeViewItemPluginResponse;

export type TreeViewPlugin<TSignature extends TreeViewAnyPluginSignature> = {
  (options: TreeViewPluginOptions<TSignature>): void | TreeViewResponse<TSignature>;
  getDefaultizedParams?: (
    params: TreeViewUsedParams<TSignature>,
  ) => TSignature['defaultizedParams'];
  getInitialState?: (params: TreeViewUsedDefaultizedParams<TSignature>) => TSignature['state'];
  models?: TreeViewModelsInitializer<TSignature>;
  params: Record<keyof TSignature['params'], true>;
  itemPlugin?: TreeViewItemPlugin;
};
