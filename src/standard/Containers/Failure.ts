import { Exception, ExceptionData, Serializer } from "../../base";
import { HttpStatus } from "../../util";

type FailureData = ExceptionData & { status: number };

export class Failure extends Exception<FailureData> {
  get [HttpStatus](): number {
    return this._data.status;
  }

  export() {
    return this.data;
  }

  static import(data: FailureData | Failure): Failure {
    return data instanceof Failure ? data : new Failure(data);
  }

  static BadRequest(message?: string) {
    return new Failure({ type: 'BAD_REQUEST', status: 400, message });
  }
  static Unauthorized(message?: string) {
    return new Failure({ type: 'UNAUTHORIZED', status: 401, message });
  }
  static Forbidden(message?: string) {
    return new Failure({ type: 'FORBIDDEN', status: 403, message });
  }
  static NotFound(message?: string) {
    return new Failure({ type: 'NOT_FOUND', status: 404, message });
  }
  static Conflict(message?: string) {
    return new Failure({ type: 'CONFLICT', status: 409, message });
  }
}

Serializer.declare(Failure);
