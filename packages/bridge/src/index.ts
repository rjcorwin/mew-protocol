import { ConfigManager } from './config/ConfigManager';
import { BridgeService } from './services/BridgeService';

export { BridgeService, ConfigManager };
export * from './types/config';
export * from './types/mcpx';
export * from './services/MCPxClient';
export * from './services/MCPServerClient';

// Main entry point for programmatic usage
export async function startBridge(configPath?: string): Promise<BridgeService> {
  const configManager = new ConfigManager(configPath);
  const config = configManager.loadConfig();
  
  const bridge = new BridgeService(config);
  await bridge.start();
  
  return bridge;
}

// CLI entry point
if (require.main === module) {
  console.log('Use `mcpx-bridge` CLI command instead of running this file directly.');
  process.exit(1);
}