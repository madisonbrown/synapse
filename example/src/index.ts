import * as Resources from './resources';
import * as Services from './services';

Services.cache.initialize(Resources);
Services.reactor.initialize(Resources);
Services.postgres.initialize(Resources);
Services.http.initialize(Resources);
Services.ws.initialize(Resources);

export { Resources, Services };
