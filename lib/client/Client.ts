/** Represents the format of a standard response from a Synapse API  */
export interface Response {
  /** A message describing the response. */
  message: string;
  /** The state of the requested resource. */
  payload: any;
  /** The normalized _query string_ that uniquely represents the request. */
  query: string;
  /** The HTTP status code of the response. */
  status: number;
  /** The class name of the requested resource. All responses from a Synapse API are objects that derive from {@linkcode State}. */
  type: string;
}

/** Wrapper for the standard WebSocket object. Instances of Client represent a single WebSocket connection to a Synapse server. */
export default class Client {
  /** The WebSocket connection to the server. */
  private ws: WebSocket;

  /** Stores the number of requests that have been processed by the instance. Used to tag requests with a unique identifier. */
  private index: number;

  /** Stores callback functions associated with request strings. */
  private callbacks: object;

  /** Static factory method which asynchronously produces a new instance of {@linkcode Client}.
   * @param uri A WebSocket connection URI.
   * @param onClose A callback function to be executed whenever the connection is closed.
   */
  static async connect(uri: string, onClose: Function = null): Promise<Client> {
    return new Promise((resolve, reject) => {
      const instance = new Client();

      const ws = new WebSocket(uri);
      ws.onopen = () => {
        resolve(instance);
      };
      ws.onerror = reject;
      ws.onclose = <any>onClose || undefined;
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        Object.entries(data).forEach(([req, res]) => {
          instance.callbacks[req](res);
        });
      };

      instance.ws = ws;
      instance.index = 0;
      instance.callbacks = {};
    });
  }

  /** Sends a request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param method An HTTP method, or ```SUBSCRIBE``` / ```UNSUBSCRIBE```.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  private async request(method: string, path: string, args: object = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      const req = `${method} ${path} ${this.index++}`;
      this.callbacks[req] = (res) => {
        delete this.callbacks[req];
        resolve(res);
      };
      this.ws.send(JSON.stringify({ [req]: args }));
    });
  }

  /** Sends a ```GET``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  async get(path: string, args: object = {}): Promise<Response> {
    return this.request('GET', path, args);
  }

  /** Sends a ```POST``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  async post(path: string, args: object = {}): Promise<Response> {
    return this.request('POST', path, args);
  }

  /** Sends a ```PUT``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  async put(path: string, args: object = {}): Promise<Response> {
    return this.request('PUT', path, args);
  }

  /** Sends a ```PATCH``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  async patch(path: string, args: object = {}): Promise<Response> {
    return this.request('PATCH', path, args);
  }

  /** Sends a ```DELETE``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  async delete(path: string, args: object = {}): Promise<Response> {
    return this.request('DELETE', path, args);
  }

  /** Sends an ```OPTIONS``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   */
  async options(path: string, args: object = {}): Promise<Response> {
    return this.request('OPTIONS', path, args);
  }

  /** Sends a ```SUBSCRIBE``` request to the server and returns a Promise resolving to its eventual {@linkcode Response}. The response to a ```SUBSCRIBE``` request is identical to an equivalent ```GET``` request—if successful, its ```payload``` property will contain the initial state of the resource its```query``` property will contain the query string that can be passed to {@linkcode Client.unsubscribe|Client.prototype.unsubscribe} to cancel the subscription. Any updates to the subscribed resource's state will be passed to the provided callback function ```onChange```.
   * @param path The resource _path_.
   * @param args The arguments to accompany the request.
   * @param onChange A function to be invoked with the new state of the subscribed resource, whenever it's state changes.
   */
  async subscribe(path: string, args: object = {}, onChange: Function = null): Promise<Response> {
    return this.request('SUBSCRIBE', path, args).then((res: Response) => {
      if (res.status.toString()[0] !== '2') {
        return Promise.reject(res);
      }

      this.callbacks[res.query] = (state: any) => {
        if (onChange) {
          onChange(state, res.query);
        }
      };

      return res;
    });
  }

  /** Cancels any subscription associated with the given _query string_, which can be obtained from the initial response to a call to {@linkcode Client.subscribe|Client.prototype.subscribe}.
   * @param query A _query string_.
   */
  async unsubscribe(query: string): Promise<Response> {
    return this.request('UNSUBSCRIBE', query).then((res: Response) => {
      if (res.status.toString()[0] !== '2') {
        return Promise.reject(res)
      }
      delete this.callbacks[res.query];
      return res;
    });
  }

  /** Closes the WebSocket connection. */
  disconnect() {
    this.ws.close();
  }
}
