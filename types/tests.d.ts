interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  json?: boolean;
  query?: Record<string, any>;
  headers?: { [key: string]: string };
  mimeType?: string;
}
