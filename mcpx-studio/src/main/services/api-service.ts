import axios from 'axios';

export interface APIResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export class APIService {
  private client: any;
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3100') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // System status
  async getStatus(): Promise<APIResult> {
    try {
      const response = await this.client.get('/api/status');
      return response.data;
    } catch (error: any) {
      console.error('API Error (getStatus):', error);
      return { success: false, error: error.message };
    }
  }

  // Agents
  async getAgents(): Promise<APIResult> {
    try {
      const response = await this.client.get('/api/agents');
      return response.data;
    } catch (error: any) {
      console.error('API Error (getAgents):', error);
      return { success: false, error: error.message };
    }
  }

  async createAgent(name: string, template: string, options: any): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/agents', {
        name,
        template,
        ...options
      });
      return response.data;
    } catch (error: any) {
      console.error('API Error (createAgent):', error);
      return { success: false, error: error.message };
    }
  }

  async startAgent(name: string): Promise<APIResult> {
    try {
      const response = await this.client.post(`/api/agents/${name}/start`);
      return response.data;
    } catch (error: any) {
      console.error('API Error (startAgent):', error);
      return { success: false, error: error.message };
    }
  }

  async stopAgent(name: string): Promise<APIResult> {
    try {
      const response = await this.client.post(`/api/agents/${name}/stop`);
      return response.data;
    } catch (error: any) {
      console.error('API Error (stopAgent):', error);
      return { success: false, error: error.message };
    }
  }

  async deleteAgent(name: string): Promise<APIResult> {
    try {
      const response = await this.client.delete(`/api/agents/${name}`);
      return response.data;
    } catch (error: any) {
      console.error('API Error (deleteAgent):', error);
      return { success: false, error: error.message };
    }
  }

  // Server
  async startServer(): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/server/start');
      return response.data;
    } catch (error: any) {
      console.error('API Error (startServer):', error);
      return { success: false, error: error.message };
    }
  }

  async stopServer(): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/server/stop');
      return response.data;
    } catch (error: any) {
      console.error('API Error (stopServer):', error);
      return { success: false, error: error.message };
    }
  }

  // Frontend
  async startFrontend(): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/frontend/start');
      return response.data;
    } catch (error: any) {
      console.error('API Error (startFrontend):', error);
      return { success: false, error: error.message };
    }
  }

  async stopFrontend(): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/frontend/stop');
      return response.data;
    } catch (error: any) {
      console.error('API Error (stopFrontend):', error);
      return { success: false, error: error.message };
    }
  }

  // Bridges
  async getBridges(): Promise<APIResult> {
    try {
      const response = await this.client.get('/api/bridges');
      return response.data;
    } catch (error: any) {
      console.error('API Error (getBridges):', error);
      return { success: false, error: error.message };
    }
  }

  async createBridge(name: string, options: any): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/bridges', {
        name,
        ...options
      });
      return response.data;
    } catch (error: any) {
      console.error('API Error (createBridge):', error);
      return { success: false, error: error.message };
    }
  }

  async startBridge(name: string): Promise<APIResult> {
    try {
      const response = await this.client.post(`/api/bridges/${name}/start`);
      return response.data;
    } catch (error: any) {
      console.error('API Error (startBridge):', error);
      return { success: false, error: error.message };
    }
  }

  async stopBridge(name: string): Promise<APIResult> {
    try {
      const response = await this.client.post(`/api/bridges/${name}/stop`);
      return response.data;
    } catch (error: any) {
      console.error('API Error (stopBridge):', error);
      return { success: false, error: error.message };
    }
  }

  // System control
  async startSystem(options: any = {}): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/system/start', options);
      return response.data;
    } catch (error: any) {
      console.error('API Error (startSystem):', error);
      return { success: false, error: error.message };
    }
  }

  async stopSystem(): Promise<APIResult> {
    try {
      const response = await this.client.post('/api/system/stop');
      return response.data;
    } catch (error: any) {
      console.error('API Error (stopSystem):', error);
      return { success: false, error: error.message };
    }
  }

  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}