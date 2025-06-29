type ObjectType = Record<string, any>;

interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  json?: boolean;
  query?: ObjectType;
  headers?: { [key: string]: string };
  mimeType?: string;
}

interface Limits {
  fee?: number;
  storageLimit?: number;
  gasLimit?: number;
}
