// Un solo tipo de error de aplicación. No hay jerarquía: el status ES la semántica.
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = "HttpError"
  }
}
