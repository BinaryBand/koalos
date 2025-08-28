interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  timeout?: number;
  json?: boolean;
  query?: Record<string, unknown>;
  headers?: { [key: string]: string };
  mimeType?: string;
}
