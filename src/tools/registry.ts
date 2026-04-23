import { toolDefinitions } from './tool-definitions';
import type { ToolRegistry, ToolHandler } from '../types/index';

function lazyHandler(handlerPath: string): ToolHandler {
  const modulePath = handlerPath.endsWith('.js') ? handlerPath : `${handlerPath}.js`;
  return async (...args: Parameters<ToolHandler>) => {
    const handler = await import(modulePath);
    return handler.default(...args);
  };
}

export const toolRegistry: ToolRegistry = toolDefinitions.reduce<ToolRegistry>(
  (registry, definition) => {
    registry[definition.name] = lazyHandler(definition.handlerPath);
    return registry;
  },
  {}
);

export function getToolHandler(name: string): ToolHandler {
  const handler = toolRegistry[name];
  if (!handler) {
    throw new Error(`No handler registered for tool: ${name}`);
  }
  return handler;
}
